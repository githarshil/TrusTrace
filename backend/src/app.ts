import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env as defaultEnv, type AppEnv } from "./core/env.js";
import { buildErrorEnvelope, errorHandler, notFoundHandler } from "./core/errors.js";
import { requestIdMiddleware } from "./api/middleware/requestId.js";
import { createAutopsyRouter } from "./api/routes/autopsy.js";
import { createFinfluencersRouter } from "./api/routes/finfluencers.js";
import { createHealthRouter } from "./api/routes/health.js";
import { createLiveStocksRouter } from "./api/routes/liveStocks.js";
import { createResearchRouter } from "./api/routes/research.js";
import {
  createFinfluencerAlertRepository,
  type FinfluencerAlertRepository,
} from "./db/finfluencerRepository.js";
import { createEvidenceRepository, type EvidenceRepository } from "./db/repository.js";
import type { DatabaseProbeResult } from "./db/supabase.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export interface CreateAppOptions {
  config?: AppEnv;
  probeDb?: (config: AppEnv) => Promise<DatabaseProbeResult>;
  repo?: EvidenceRepository;
  alertRepo?: FinfluencerAlertRepository;
  fetchImpl?: typeof fetch;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const config = options.config ?? defaultEnv;
  const repo = options.repo ?? createEvidenceRepository(config);
  const alertRepo = options.alertRepo ?? createFinfluencerAlertRepository(config);
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow server-to-server / curl requests without an Origin header and configured frontend origins
        if (!origin || config.FRONTEND_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Request-Id", "Authorization"],
    })
  );

  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "256kb" }));

  app.use(
    "/api",
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      handler(req, res) {
        res
          .status(429)
          .json(
            buildErrorEnvelope(
              "RATE_LIMITED",
              "Too many requests. Please pause briefly before trying again.",
              req.requestId ?? "req_unknown",
              true
            )
          );
      },
    })
  );

  app.use("/api", createHealthRouter({ config, probeDb: options.probeDb }));
  app.use("/api", createAutopsyRouter({ config, repo, fetchImpl: options.fetchImpl }));
  app.use("/api", createLiveStocksRouter({ config, repo, fetchImpl: options.fetchImpl }));
  app.use(
    "/api",
    createFinfluencersRouter({
      config,
      evidenceRepo: repo,
      alertRepo,
      fetchImpl: options.fetchImpl,
    })
  );
  app.use(
    "/api",
    createResearchRouter({
      config,
      evidenceRepo: repo,
      alertRepo,
      fetchImpl: options.fetchImpl,
    })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
