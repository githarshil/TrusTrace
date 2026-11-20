import express, { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { AppEnv } from "../../core/env.js";
import { AppError, buildErrorEnvelope } from "../../core/errors.js";
import type { FinfluencerAlertRepository } from "../../db/finfluencerRepository.js";
import type { EvidenceRepository } from "../../db/repository.js";
import {
  analyzeAndStoreYouTubeVideo,
  dispatchAlertsForVideo,
  pollAllTrackedFinfluencers,
  syncInfluencerYouTubeFeed,
} from "../../domain/finfluencers/youtubeAlertPipeline.js";
import { lookupSebiRegister } from "../../domain/sebi/lookup.js";
import {
  decryptSensitiveField,
  encryptSensitiveField,
  generateUnsubscribeToken,
  hashPhoneForDedupe,
  maskPhoneNumber,
  normalizeE164Phone,
  sendGuardedWhatsAppAlert,
} from "../../integrations/whatsappNotifier.js";
import { parseYouTubeAtomXml } from "../../integrations/youtubeMonitor.js";

const SubscribeBodySchema = z.object({
  phone: z.string().min(8).max(24),
  provider: z.enum(["twilio", "callmebot", "meta_cloud", "dry_run"]).default("twilio"),
  callmebot_api_key: z.string().max(120).optional().nullable(),
  consent_accepted: z.literal(true),
});

const TestAlertSchema = z.object({
  subscription_id: z.string().uuid(),
});

const UnsubscribeBodySchema = z.object({
  token: z.string().min(10).max(128),
});

function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

export function createFinfluencersRouter(params: {
  config: AppEnv;
  evidenceRepo: EvidenceRepository;
  alertRepo: FinfluencerAlertRepository;
  fetchImpl?: typeof fetch;
}): Router {
  const { config, evidenceRepo, alertRepo, fetchImpl } = params;
  const router = Router();

  const alertRateLimit = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: Math.min(config.RATE_LIMIT_MAX_REQUESTS, 30),
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      res
        .status(429)
        .json(
          buildErrorEnvelope(
            "RATE_LIMITED",
            "Too many subscription or sync requests. Please pause briefly and try again.",
            req.requestId ?? "req_unknown",
            true
          )
        );
    },
  });

  // 1. GET /api/finfluencers — Directory with SEBI snapshot status, YouTube channel & latest analyzed videos
  router.get(
    "/finfluencers",
    asyncRoute(async (req, res) => {
      const [influencers, sebiData] = await Promise.all([
        evidenceRepo.listInfluencers(),
        evidenceRepo.listSebiEntries(),
      ]);

      const items = await Promise.all(
        influencers.map(async (inf) => {
          const sebi = lookupSebiRegister({
            query: inf.name,
            entries: sebiData.entries,
            aliases: influencers,
            snapshotDate: sebiData.snapshotDate,
            snapshotId: sebiData.snapshotId,
            dataLabel: sebiData.dataLabel,
          });
          const [videos, subscriberCount] = await Promise.all([
            alertRepo.listVideoAnalyses(inf.id, 4),
            alertRepo.countActiveSubscribers(inf.id),
          ]);

          return {
            id: inf.id,
            name: inf.name,
            handle: inf.handle,
            aliases: inf.aliases,
            avatar_initials:
              inf.avatar_initials ??
              inf.name
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join(""),
            bio_summary: inf.bio_summary ?? null,
            youtube_channel_id: inf.youtube_channel_id ?? null,
            youtube_handle: inf.youtube_handle ?? null,
            youtube_channel_url: inf.youtube_channel_url ?? null,
            has_realtime_youtube_feed: Boolean(inf.youtube_channel_id),
            sebi_status: sebi.status,
            sebi_registration_no: sebi.registration_no,
            sebi_category: sebi.category,
            sebi_snapshot_date: sebi.snapshot_date,
            sebi_explanation: sebi.explanation,
            active_subscriber_count: subscriberCount,
            latest_videos: videos,
          };
        })
      );

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        fetched_at: new Date().toISOString(),
        twilio_whatsapp_configured: Boolean(
          config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN
        ),
        whatsapp_meta_configured: Boolean(
          config.META_WHATSAPP_ACCESS_TOKEN && config.META_WHATSAPP_PHONE_NUMBER_ID
        ),
        llm_provider: config.LLM_PROVIDER,
        items,
      });
    })
  );

  // 2. GET /api/finfluencers/:id/videos?refresh=true|false
  router.get(
    "/finfluencers/:id/videos",
    asyncRoute(async (req, res) => {
      const influencerId = String(req.params.id ?? "");
      const refresh = req.query.refresh === "true";
      const influencer = await evidenceRepo.findInfluencerById(influencerId);
      if (!influencer) {
        throw new AppError({
          code: "DATA_NOT_AVAILABLE",
          message: "Finfluencer record was not found.",
          statusCode: 404,
          retryable: false,
        });
      }

      if (refresh && influencer.youtube_channel_id) {
        const synced = await syncInfluencerYouTubeFeed({
          influencer,
          config,
          evidenceRepo,
          alertRepo,
          dispatchToSubscribers: false,
          limit: 5,
          fetchImpl,
        });
        res.status(200).json({
          request_id: req.requestId ?? "req_unknown",
          influencer_id: influencer.id,
          influencer_name: influencer.name,
          refreshed: true,
          fetched_from_rss: synced.fetched_from_rss,
          newly_analyzed: synced.newly_analyzed,
          videos: synced.videos,
        });
        return;
      }

      const videos = await alertRepo.listVideoAnalyses(influencer.id, 8);
      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        influencer_id: influencer.id,
        influencer_name: influencer.name,
        refreshed: false,
        fetched_from_rss: 0,
        newly_analyzed: 0,
        videos,
      });
    })
  );

  // 3. POST /api/finfluencers/:id/sync — Live RSS check + AI analysis + guarded WhatsApp alert fan-out
  router.post(
    "/finfluencers/:id/sync",
    alertRateLimit,
    asyncRoute(async (req, res) => {
      const influencerId = String(req.params.id ?? "");
      const influencer = await evidenceRepo.findInfluencerById(influencerId);
      if (!influencer) {
        throw new AppError({
          code: "DATA_NOT_AVAILABLE",
          message: "Finfluencer record was not found.",
          statusCode: 404,
          retryable: false,
        });
      }

      const synced = await syncInfluencerYouTubeFeed({
        influencer,
        config,
        evidenceRepo,
        alertRepo,
        dispatchToSubscribers: true,
        limit: 5,
        fetchImpl,
      });

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        ...synced,
      });
    })
  );

  // 4. POST /api/finfluencers/:id/subscribe — Opt-in encrypted WhatsApp alert subscription
  router.post(
    "/finfluencers/:id/subscribe",
    alertRateLimit,
    asyncRoute(async (req, res) => {
      const influencerId = String(req.params.id ?? "");
      const influencer = await evidenceRepo.findInfluencerById(influencerId);
      if (!influencer) {
        throw new AppError({
          code: "DATA_NOT_AVAILABLE",
          message: "Finfluencer record was not found.",
          statusCode: 404,
          retryable: false,
        });
      }

      const body = SubscribeBodySchema.parse(req.body ?? {});
      const e164 = normalizeE164Phone(body.phone);
      if (!e164) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Enter a valid WhatsApp phone number in E.164 format (for example +919876543210).",
          statusCode: 400,
          retryable: false,
        });
      }

      if (body.provider === "callmebot" && (!body.callmebot_api_key || !body.callmebot_api_key.trim())) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message:
            "CallMeBot requires your free CallMeBot API key. Use Preview (Dry-Run) mode if you want to preview guarded alerts without setting up CallMeBot.",
          statusCode: 400,
          retryable: false,
        });
      }

      const secret = config.SUBSCRIPTION_ENCRYPTION_KEY;
      const phoneHash = hashPhoneForDedupe(e164, secret);
      const phoneMasked = maskPhoneNumber(e164);
      const phoneEncrypted = encryptSensitiveField(e164, secret);
      const providerConfigEncrypted =
        body.provider === "callmebot" && body.callmebot_api_key
          ? encryptSensitiveField(body.callmebot_api_key.trim(), secret)
          : null;
      const unsubscribeToken = generateUnsubscribeToken();

      const saved = await alertRepo.upsertSubscription({
        influencer_id: influencer.id,
        phone_hash: phoneHash,
        phone_masked: phoneMasked,
        phone_encrypted: phoneEncrypted,
        provider: body.provider,
        provider_config_encrypted: providerConfigEncrypted,
        is_active: true,
        unsubscribe_token: unsubscribeToken,
      });

      res.status(201).json({
        request_id: req.requestId ?? "req_unknown",
        subscription: {
          id: saved.id,
          influencer_id: saved.influencer_id,
          influencer_name: influencer.name,
          phone_masked: saved.phone_masked,
          provider: saved.provider,
          is_active: saved.is_active,
          consent_given_at: saved.consent_given_at,
          unsubscribe_token: saved.unsubscribe_token,
        },
        message:
          saved.provider === "dry_run"
            ? "Subscribed in Preview (Dry-Run) mode. Use 'Send Test Alert Now' to preview the exact Output-Guarded WhatsApp message."
            : "Subscribed for automated Output-Guarded WhatsApp alerts when new YouTube videos are analyzed.",
      });
    })
  );

  // 5. POST /api/finfluencers/:id/test-alert — Send or preview latest analyzed video alert
  router.post(
    "/finfluencers/:id/test-alert",
    alertRateLimit,
    asyncRoute(async (req, res) => {
      const influencerId = String(req.params.id ?? "");
      const body = TestAlertSchema.parse(req.body ?? {});

      const [influencer, subscription] = await Promise.all([
        evidenceRepo.findInfluencerById(influencerId),
        alertRepo.findSubscriptionById(body.subscription_id),
      ]);

      if (!influencer || !subscription || subscription.influencer_id !== influencer.id) {
        throw new AppError({
          code: "DATA_NOT_AVAILABLE",
          message: "Active subscription for this finfluencer was not found.",
          statusCode: 404,
          retryable: false,
        });
      }

      let videos = await alertRepo.listVideoAnalyses(influencer.id, 1);
      if (videos.length === 0 && influencer.youtube_channel_id) {
        const synced = await syncInfluencerYouTubeFeed({
          influencer,
          config,
          evidenceRepo,
          alertRepo,
          dispatchToSubscribers: false,
          limit: 2,
          fetchImpl,
        });
        videos = synced.videos;
      }

      const latestVideo = videos[0];
      if (!latestVideo) {
        throw new AppError({
          code: "DATA_NOT_AVAILABLE",
          message:
            "No analyzed YouTube video is available yet for this creator. Sync a creator with a linked YouTube channel first.",
          statusCode: 404,
          retryable: true,
        });
      }

      const phoneE164 = decryptSensitiveField(
        subscription.phone_encrypted,
        config.SUBSCRIPTION_ENCRYPTION_KEY
      );
      const callMeBotKey = subscription.provider_config_encrypted
        ? decryptSensitiveField(
            subscription.provider_config_encrypted,
            config.SUBSCRIPTION_ENCRYPTION_KEY
          )
        : null;

      const delivery = await sendGuardedWhatsAppAlert({
        phoneE164,
        provider: subscription.provider,
        message: latestVideo.whatsapp_summary_text,
        callMeBotApiKey: callMeBotKey,
        twilioAccountSid: config.TWILIO_ACCOUNT_SID,
        twilioAuthToken: config.TWILIO_AUTH_TOKEN,
        twilioWhatsAppFrom: config.TWILIO_WHATSAPP_FROM,
        metaAccessToken: config.META_WHATSAPP_ACCESS_TOKEN,
        metaPhoneNumberId: config.META_WHATSAPP_PHONE_NUMBER_ID,
        fetchImpl,
      });

      await alertRepo.recordDeliveryLog({
        subscription_id: subscription.id,
        video_analysis_id: latestVideo.id,
        provider: subscription.provider,
        delivery_status: delivery.status,
        message_preview: delivery.messagePreview,
        error_code: delivery.errorCode,
      });

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        video_id: latestVideo.video_id,
        video_title: latestVideo.title,
        delivery_status: delivery.status,
        provider: delivery.provider,
        phone_masked: subscription.phone_masked,
        message_preview: delivery.messagePreview,
        wa_me_url: delivery.waMeUrl,
        error_code: delivery.errorCode,
      });
    })
  );

  // 6. One-click unsubscribe (POST or GET)
  router.post(
    "/finfluencers/unsubscribe",
    asyncRoute(async (req, res) => {
      const body = UnsubscribeBodySchema.parse(req.body ?? {});
      const result = await alertRepo.unsubscribeByToken(body.token);
      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        ...result,
      });
    })
  );

  router.get(
    "/finfluencers/unsubscribe",
    asyncRoute(async (req, res) => {
      const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
      if (token.length < 10) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Missing or invalid unsubscribe token.",
          statusCode: 400,
          retryable: false,
        });
      }
      const result = await alertRepo.unsubscribeByToken(token);
      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        ...result,
      });
    })
  );

  // 7. POST /api/internal/youtube/poll — Secret-protected cron hook for free external schedulers
  router.post(
    "/internal/youtube/poll",
    asyncRoute(async (req, res) => {
      if (config.INTERNAL_CRON_SECRET) {
        const authHeader = req.header("authorization") ?? "";
        const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (provided !== config.INTERNAL_CRON_SECRET) {
          throw new AppError({
            code: "UNAUTHORIZED",
            message: "Invalid internal poll secret.",
            statusCode: 401,
            retryable: false,
          });
        }
      }
      const results = await pollAllTrackedFinfluencers({
        config,
        evidenceRepo,
        alertRepo,
        dispatchToSubscribers: true,
        fetchImpl,
      });
      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        polled_channels: results.length,
        newly_analyzed: results.reduce((sum, r) => sum + r.newly_analyzed, 0),
        alerts_dispatched: results.reduce((sum, r) => sum + r.alerts_dispatched, 0),
      });
    })
  );

  // 8. Official YouTube WebSub (PubSubHubbub) verification + Atom push webhook
  router.get("/webhooks/youtube", (req, res) => {
    const challenge = typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : "";
    if (!challenge) {
      res.status(400).send("Missing hub.challenge");
      return;
    }
    res.status(200).type("text/plain").send(challenge);
  });

  router.post(
    "/webhooks/youtube",
    express.text({ type: ["application/atom+xml", "application/xml", "text/xml"], limit: "256kb" }),
    asyncRoute(async (req, res) => {
      const xml = typeof req.body === "string" ? req.body : "";
      const entries = parseYouTubeAtomXml(xml);
      const influencers = await evidenceRepo.listInfluencers();
      let processed = 0;

      for (const video of entries) {
        const matched = influencers.find(
          (inf) => inf.youtube_channel_id && inf.youtube_channel_id === video.channel_id
        );
        if (!matched) continue;
        const { analysis, isNew } = await analyzeAndStoreYouTubeVideo({
          influencer: matched,
          video,
          config,
          evidenceRepo,
          alertRepo,
          fetchImpl,
        });
        if (isNew) {
          await dispatchAlertsForVideo({ analysis, config, alertRepo, fetchImpl });
          processed += 1;
        }
      }

      res.status(202).json({
        request_id: req.requestId ?? "req_unknown",
        accepted_entries: entries.length,
        newly_processed: processed,
      });
    })
  );

  return router;
}
