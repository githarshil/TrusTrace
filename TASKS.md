# Tip Autopsy — Step-by-Step Implementation Plan

**Document status:** Ready for task-by-task execution after blueprint approval  
**Rule:** Execute exactly one task at a time. Stop for review and explicit approval before starting the next task.

---

## 0. Execution Protocol

1. Read `PRD.md`, `ARCHITECTURE.md`, and `AGENTS.md` before selecting work.
2. Select the first unchecked task whose dependencies are complete.
3. Work only on that task. Do not bundle unrelated cleanup, features, or “quick improvements”.
4. Before editing, state the task ID, intended changes, files expected to change, and acceptance criteria.
5. Implement the task and run only the relevant checks plus any required regression tests.
6. Report changed files, commands run, test results, known limitations, and any deviation from the blueprint.
7. Update this file and the relevant blueprint documents only after the task has been reviewed and accepted.
8. Stop and wait for the user's review. Do not begin the next task until approval is explicit.
9. If a task exposes a product or architecture conflict, stop implementation and propose the smallest decision needed. Do not silently rewrite the requirements.

A checked box means the user has reviewed and accepted the task, not merely that code was written.

## Phase 1 — Setup and Foundation

### 1.1 Confirm the project baseline

- [x] Review `PRD.md`, `ARCHITECTURE.md`, and this task plan together.
  - [x] Confirm the MVP boundaries and non-negotiable no-advice rules.
  - [x] Confirm MERN-based stack (React/TypeScript, Node.js/Express/TypeScript), Supabase PostgreSQL, Netlify, and Render as the initial stack.
  - [x] Confirm the zero-login and no-user-data-persistence model.
  - [x] Record decisions on data source access, Supabase project target (`TrustTrace` / `vevrmjlokngcknkidmbc`), and initial methodology parameters.
- [x] Acceptance: the user approves the blueprint and the first implementation task before any application source code is written.

### 1.2 Create the repository scaffold

- [x] Create the monorepo folders for `frontend/`, `backend/`, `supabase/`, and `docs/`.
  - [x] Add only the minimal package and project manifests needed for the selected stack.
  - [x] Pin Node.js runtime versions and add dependency lockfiles.
  - [x] Add `.gitignore` rules for dependencies, build output, local databases, and secrets.
  - [x] Add `.env.example` containing key names and safe example values only.
- [x] Acceptance: a clean clone can install dependencies without committing secrets or generated data.

### 1.3 Establish frontend foundation

- [x] Bootstrap React + TypeScript + Vite.
  - [x] Enable strict TypeScript checking (with JSX/declaration support to import `ui-ux/DashBoardBackground.jsx` verbatim).
  - [x] Configure Tailwind and the approved design tokens from `DESIGN.md`.
  - [x] Copy `ui-ux/DashBoardBackground.jsx` verbatim into `frontend/src/components/` without modifying its Wayglim/Paper Shaders engine.
  - [x] Add routing and the responsive application shell.
  - [x] Add lint, typecheck, and test scripts.
- [x] Acceptance: the frontend runs locally, renders an empty Tip Autopsy shell, and passes lint/typecheck/build.

### 1.4 Establish backend foundation

- [x] Bootstrap Node.js + Express + TypeScript project tooling.
  - [x] Add Zod-validated environment configuration.
  - [x] Add a health endpoint and consistent API error envelope.
  - [x] Configure ESLint, TypeScript (`tsc --noEmit`), Vitest, Supertest, and test settings.
  - [x] Add request IDs and safe structured logging with input redaction.
- [x] Acceptance: the backend starts locally, `/api/health` responds, and baseline tests/lint/type checks pass.

### 1.5 Establish Supabase PostgreSQL and migrations

- [x] Connect the target Supabase project (via Supabase MCP / environment config) and initialize `supabase/migrations/`.
  - [x] Configure server-side Supabase / PostgreSQL connectivity (`@supabase/supabase-js` service role and/or `pg`) with health check verification.
  - [x] Add a first baseline SQL migration and verify migration tracking.
  - [x] Run Supabase advisors (`get_advisors`) and verify RLS posture on `public` tables.
- [x] Acceptance: the Express backend connects to Supabase PostgreSQL, baseline migrations apply cleanly, and `/api/health` reports database readiness.

### 1.6 Add quality gates and CI

- [x] Configure CI for frontend and backend.
  - [x] Run frontend lint, typecheck, unit tests, and production build.
  - [x] Run backend ESLint, TypeScript typecheck, Vitest tests, and build.
  - [x] Add dependency and secret scanning where supported.
  - [x] Fail the pipeline on test, lint, or type errors.
- [x] Acceptance: CI runs on pull requests and reports failures clearly.

### 1.7 Create deployment foundations

- [x] Connect frontend preview deployment to Netlify.
  - [x] Configure production build output and public API base URL.
  - [x] Restrict deployment environment variables to public client values.
- [x] Connect backend preview deployment to Render.
  - [x] Configure build/start commands, health check, and secret environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
  - [x] Ensure staging/preview uses an isolated Supabase database/branch rather than production.
- [x] Acceptance: preview frontend can call the staging backend over HTTPS; production is not modified by this task.

### 1.8 Finalize data-source inventory and methodology plan

- [x] Document intended NSE/BSE, SEBI, enforcement-order, and curated tip/media corpus inputs (`photos/` and `videos/`).
  - [x] Record source URL/provider, retrieval method, access date, usage terms, and expected fields.
  - [x] Confirm whether historical price, volume, market cap, circuit-band, and ASM/GSM snapshots are available for equities (`Borosil Renewables Ltd`, `Sarveshwar Foods`, `Wipro Limited`) and how index option tips (`Sensex 82900 CE`, `Nifty 25500 CE`, `Nifty 25600 CE`) are scoped.
  - [x] Define the hand-labelled Hinglish evaluation corpus plan alongside the `<Influencer>__<Stock>__<Registration>` curated media assets.
  - [x] Define how synthetic records will be labelled and separated from real data.
- [x] Acceptance: no data source is treated as production-ready until access and usage terms are reviewed and its provenance metadata is defined.

### 1.9 Establish the visual foundation

- [x] Implement the responsive color, typography, spacing, and status-token system from `PRD.md` and `DESIGN.md`, aligned with `ui-ux/hero.jpeg` and `ui-ux/DashBoard.png` over the verbatim `DashBoardBackground.jsx` shader canvas.
  - [x] Build the frosted glass dashboard shell, left sidebar rail (`Dashboard`, `New Analysis`, `Demo Corpus`, `How Checks Work`, and `"We grade the information, not the investment."` callout), and accessible buttons, inputs, cards, badges, alerts, and progress indicators.
  - [x] Confirm there is no stock-level red/green verdict treatment, no `"Confidence Score"` / `"Risk Score"`, no persisted `"Past Reports"`, and no `"Live Market Data"` misrepresentation.
  - [x] Verify layout at narrow mobile, tablet, and desktop widths.
- [x] Acceptance: the application shell matches the approved visual direction and passes basic keyboard/contrast review.

## Phase 2 — Core Product Loop

### 2.1 Implement the provenance-aware data model

- [x] Add Supabase PostgreSQL SQL migrations (`supabase/migrations/`) and TypeScript DB types/repositories for `data_snapshot`, `influencer`, `sebi_register_entry`, `stock` (including `instrument_type` `EQUITY`/`DERIVATIVE` and nullable `underlying_ticker`), `price_history`, `stock_info`, `benchmark_history`, `surveillance_entry`, and `tip`.
  - [x] Add foreign keys, unique constraints, indexes, enums, explicit data labels, and RLS enabled on every `public` table.
  - [x] Add ingestion-run audit fields/table.
  - [x] Preserve immutable snapshot references and dates.
  - [x] Confirm no user profile, portfolio, uploaded photo/video storage, pasted-tip history, or personal-data table exists.
  - [x] Run Supabase advisors (`get_advisors`) and verify zero critical security/RLS findings.
- [x] Acceptance: schema migrations apply cleanly in Supabase PostgreSQL and constraints prevent ambiguous provenance records.

### 2.2 Build snapshot ingestion and validation

- [x] Implement repeatable loaders for approved market, Nifty 50 benchmark, SEBI, surveillance, market-cap, and tip datasets.
  - [x] Validate schema, ticker/date formats, duplicates, and numeric values.
  - [x] Record checksum, source, retrieved time, as-of date, dataset version, and Real/Synthetic/Mixed label.
  - [x] Reject or quarantine malformed rows and produce an import summary.
  - [x] Make imports idempotent without overwriting prior snapshots.
- [x] Acceptance: a sample real snapshot and a synthetic tip dataset can be loaded and queried with correct provenance labels.

### 2.3 Seed the demo corpus

- [x] Prepare a curated creator, stock/instrument, and historical-tip dataset incorporating the media assets in `photos/` and `videos/`:
  - [x] `photos/Ashish_Kyal__Sensex_82900_CE__Not_Registered.jpeg`
  - [x] `photos/Chinmay_Dudhane__Nifty_25500_CE__Registered.jpeg`
  - [x] `photos/Harsh_Bhagat__Nifty_25600_CE__Not_Registered.jpeg`
  - [x] `videos/Rakesh_Bansal__Borosil_Renewables_Ltd__Registered.App.mp4`
  - [x] `videos/Rakesh_Bansal__Sarveshwar_Foods__Registered.App.mp4`
  - [x] `videos/Vivek_Rana__Wipro_Limited__Not_Registered.App.mp4`
  - [x] Map each `<Influencer>__<Stock>__<Registration>` asset to curated `influencer` (including channel aliases like `Trading cafe India`), `stock`, `tip`, and dated `sebi_register_entry` snapshot records.
  - [x] Include hand-authored Hinglish examples for missing/gated stop-loss (`SL PAID`, `SL. VIP PREMIUM`), urgency/hype, vague disclosure, and clear disclosure.
  - [x] Include real historical market snapshots only when their source and date are verified.
  - [x] Mark every synthetic/mixed tip at row level and expose that label in API responses.
  - [x] Add data coverage notes and known gaps.
- [x] Acceptance: demo data is reproducible, clearly labelled, and contains no synthetic market values represented as real.

### 2.4 Implement the five deterministic market checks

- [x] Build pure calculation modules for liquidity, market-cap band, volume spike, pre-tip run-up, and surveillance/circuit band.
  - [x] Keep formulas separate from API routes.
  - [x] Add configurable lookback and versioned threshold configuration.
  - [x] Calibrate thresholds against enforcement cases and a normal-stock comparison set.
  - [x] Return `Within normal range`, `Needs attention`, or `Could not verify` with values, dates, sources, and method versions.
  - [x] Add tests for missing data, stale snapshots, non-trading days, zero/invalid volume, insufficient history, and derivative/index-option contracts (`Sensex 82900 CE`, `Nifty 25500 CE`, `Nifty 25600 CE`) returning `Could not verify` for inapplicable equity-only checks.
- [x] Acceptance: each check is deterministic, reproducible from a snapshot ID, and never invents a value when source data is missing.

### 2.5 Implement benchmark-adjusted creator statistics

- [x] Build the historical tip-resolution and Beta-Binomial module.
  - [x] Align stock and Nifty 50 returns over each tip's stated horizon, using the first valid market close strictly after the publication date (or the next trading session when only a date is known).
  - [x] Apply direction-adjusted excess return consistently.
  - [x] Define handling for ties, missing deadlines, and incomplete market history.
  - [x] Implement the versioned prior, credible interval, matched baseline, and provisional minimum-sample policy.
  - [x] Return interval, sample counts, benchmark definition, and `Not enough tips to judge` state.
- [x] Acceptance: unit tests cover wins, losses, ties, insufficient samples, and benchmark alignment; no raw creator accuracy leaderboard is exposed.

### 2.6 Implement template report builder (Information Verdict) and Output Guard

- [x] Create an allowlist of reviewed evidence-only sentence templates for the **Information Verdict (Guarded Facts Card)**.
  - [x] Build facts-card sections from backend-verified values and source references.
  - [x] Add deterministic prohibited-language checks and semantic/adversarial test cases.
  - [x] Add a fixed safe fallback for blocked output.
  - [x] Add the mandatory disclaimer verbatim to all report responses.
  - [x] Ensure quoted creator text is escaped and labelled separately from system narrative.
- [x] Acceptance: all report paths pass through the guard and the test suite produces zero system-authored advice outputs.

### 2.7 Expose the core REST API

- [x] Implement the multimodal tip-parse (photo/video/text + influencer & stock), SEBI lookup, stock lookup, prices, tip-marker, checks, report, snapshot metadata, demo-corpus metadata, dated benchmark overview (`NIFTY_50`, `SENSEX`, `BANKNIFTY`), and health endpoints.
  - [x] Define Zod request/response contracts, Multer in-memory multipart file validation (MIME/magic bytes, size, duration), and stable error codes.
  - [x] Include source snapshot IDs, as-of dates, data labels, and methodology versions.
  - [x] Add integration tests with Supertest/Vitest against Supabase/PostgreSQL fixtures and verify uploaded media is never persisted after request completion.
  - [x] Confirm handlers contain no duplicated market formulas.
- [x] Acceptance: API consumers can submit photo, video, or text with influencer and stock names and retrieve chart data, exact-date tip details, market checks, creator interval, and a guarded Information Verdict (facts card).

### 2.8 Build the Tip Time Machine and evidence UI

- [x] Build price/volume chart with date range controls and tappable tip markers.
  - [x] Add Real/Synthetic labels to markers and selected tip details.
  - [x] Implement exact-date marker selection behavior.
  - [x] Add an accessible list alternative for chart markers.
  - [x] Show loading, no-data, stale-data, and partial-data states.
- [x] Acceptance: marker selection returns only the correct creator-stock-date tip records, and chart provenance is visible.

### 2.9 Build the Multimodal Claim Ledger parser and structured fallback

- [x] Implement the bounded multimodal extraction adapter (photo OCR/vision, short video ASR/frame text extraction, and Hinglish text parsing) plus the Claim Ledger response contract.
  - [x] Accept any photo (`.jpeg`, `.png`, `.webp`), video (`.mp4`, `.webm`, `.mov`), or pasted text alongside user-entered **influencer name** and **stock/instrument name**.
  - [x] Parse stock/instrument, direction, target price, deadline, and stop-loss only (flagging gated terms like `SL PAID` / `SL. VIP PREMIUM` as `Not stated`/gated).
  - [x] Validate source spans against the original/extracted text and discard ephemeral media buffers immediately.
  - [x] Render `Not stated` for missing fields and `Unclear` for ambiguous extraction.
  - [x] Add manual correction and guarantee that user-entered influencer + stock lookup completes the flow even when media extraction or LLM parsing fails or times out.
  - [x] Add provider timeout, invalid JSON, oversized/unsupported media, and unavailable-provider handling.
- [x] Acceptance: media/parser failure never blocks influencer + stock lookup; uploaded media is never persisted; no hallucinated or unsupported field is presented as verified.

### 2.10 Implement Hype Detector and Disclosure Grade

- [x] Add versioned Hinglish/English phrase dictionaries and disclosure rules.
  - [x] Highlight exact phrase spans in the original text.
  - [x] Show evidence supporting Clear/Vague/None grades.
  - [x] Benchmark against the plain `#ad` baseline.
  - [x] Add `Unclear`/unknown handling for ambiguous or insufficient source text.
- [x] Acceptance: flags describe text evidence only and do not label a person or security as fraudulent.

### 2.11 Implement SEBI register identity lookup

- [x] Add deterministic snapshot matching and neutral result rendering.
  - [x] Support exact registration-number matches and conservative name matches.
  - [x] Return `Registered`, `Not found`, or `Unclear` with snapshot date.
  - [x] Prevent ambiguous fuzzy matches from being presented as verified identities.
  - [x] Ensure a missing match does not block the rest of the autopsy.
- [x] Acceptance: lookup behavior is explainable, dated, neutral, and non-blocking.

### 2.12 Build the Information Verdict (facts card) and five-step journey

- [x] Connect the Dashboard Overview (3-column `NIFTY 50` / `SENSEX` / `BANKNIFTY` dated benchmark cards + Curated Demo & In-Session Analyses table over `DashBoardBackground.jsx`), multimodal input (photo, video, or text + influencer name & stock name + curated `photos/`/`videos/` samples), Claim Ledger, identity evidence, market checks, chart, and guarded Information Verdict (facts card).
  - [x] Add progress navigation and return-to-evidence behavior.
  - [x] Show every check's measured value, status, source, as-of date, and explanation.
  - [x] Show creator credible interval or `Not enough tips to judge`.
  - [x] Display the mandatory disclaimer on every Information Verdict / facts card.
- [x] Acceptance: a user can complete the full analysis from photo, video, text, or direct influencer + stock lookup using preloaded snapshots.

### 2.13 Implement Pause & Plan

- [x] Add the three pre-commitment questions before the `I'd act on this` path.
  - [x] Require all three responses before proceeding through that path.
  - [x] Keep answers in client memory only.
  - [x] Add reset and back navigation without persisting answers.
  - [x] Avoid any automated position sizing, exit recommendation, or trade instruction.
- [x] Acceptance: the gate cannot be bypassed through the normal UI and no answers are stored by the backend.

### 2.14 Complete core end-to-end and safety verification

- [x] Add Playwright flows for photo upload, video upload, pasted text, and direct influencer + stock fallback (including curated `photos/` and `videos/` samples).
  - [x] Verify not-found SEBI result continues through the full analysis.
  - [x] Verify unknown/derivative market data renders `Could not verify`.
  - [x] Verify exact-date chart marker behavior.
  - [x] Verify report disclaimer and Output Guard behavior.
  - [x] Verify no uploaded photo/video, user text, or Pause & Plan answers are persisted to browser storage or backend logs/DB.
- [x] Acceptance: all MVP core paths pass on desktop and mobile emulation; failures are documented, not hidden.

## Phase 3 — Polish, Evaluation, and Release Readiness

### 3.1 Responsive, accessible, and interaction polish

- [x] Review mobile layouts, touch targets, keyboard navigation, focus states, labels, contrast, and reduced motion.
  - [x] Add accessible chart summaries and marker list controls.
  - [x] Improve empty, stale, loading, and failure states.
  - [x] Remove unnecessary motion and trading-terminal visual cues.
- [x] Acceptance: no horizontal overflow on supported mobile widths and all primary interactions are keyboard-accessible.

### 3.2 Performance and resilience

- [ ] Measure API response time and client bundle size on the demo dataset.
  - [ ] Cache immutable snapshot queries using snapshot/version-aware keys.
  - [ ] Add provider timeouts, bounded retries, and rate limits.
  - [ ] Confirm parser/voice provider outages do not block structured lookup or facts based on local data.
- [ ] Acceptance: the primary demo path completes using local snapshots even when optional providers are unavailable.

### 3.3 Optional voice readout

- [ ] Integrate Sarvam voice only after the text facts card and guard are stable.
  - [ ] Generate speech only from already-guarded text.
  - [ ] Support Hindi, Kannada, and English where provider capabilities permit.
  - [ ] Add disabled/unavailable state and text-first fallback.
- [ ] Acceptance: voice output cannot introduce new facts or advice and failure does not affect core flow.

### 3.4 Optional coordinated-promotion demo signal

- [ ] Add a clearly labelled synthetic coordinated-promotion example only if time permits.
  - [ ] Keep the feature separate from the five core deterministic checks.
  - [ ] Explain which inputs are synthetic and what the signal cannot establish.
  - [ ] Do not call a creator fraudulent or infer coordination from a single phrase.
- [ ] Acceptance: the demo label and limitations are visible; it is not presented as a production manipulation detector.

### 3.5 Calibrate and report model/check performance

- [ ] Evaluate five-check calibration against historical enforcement cases and normal stocks.
  - [ ] Compare with a naive baseline such as flagging all small-cap stocks.
  - [ ] Report precision, recall, confidence intervals, false positives, and known blind spots.
  - [ ] Revisit lookback, market-cap boundaries, and thresholds with versioned methodology changes.
- [ ] Acceptance: no threshold is described as validated unless the evaluation evidence supports it.

### 3.6 Run the three-arm behavioral study

- [ ] Prepare the study protocol, consent language, task order, and analysis plan.
  - [ ] Recruit at least 40 participants.
  - [ ] Use approximately 20 historical tips with clearly identified synthetic examples where applicable.
  - [ ] Compare Arm A baseline, Arm B leaderboard, and Arm C Tip Autopsy.
  - [ ] Measure collapsed-tip action rate, skipped-successful-tip rate, Brier score, and decision time.
  - [ ] Report inconclusive or negative results and study limitations.
- [ ] Acceptance: the result is reproducible and no claim of decision improvement exceeds the collected evidence.

### 3.7 Complete Output Guard adversarial test campaign

- [ ] Expand test cases for direct instructions, euphemisms, conditional recommendations, Hindi/Hinglish advice terms, and target-price leakage.
  - [ ] Test all system-authored report templates and fallback paths.
  - [ ] Ensure raw creator quotes stay visually and semantically separate.
  - [ ] Block release if any system-authored advice output is found.
- [ ] Acceptance: zero advice outputs in the release test suite; failures are fixed and re-tested.

### 3.8 Production operations and security review

- [ ] Review CORS, HTTPS, secrets, provider retention settings, rate limits, dependency risks, and logging redaction.
  - [ ] Verify database backup and restore.
  - [ ] Verify preview and production isolation.
  - [ ] Test application behavior with LLM and voice integrations disabled.
  - [ ] Document deployment rollback and data snapshot rollback procedures.
- [ ] Acceptance: security checklist and operational runbook are approved before production launch.

### 3.9 Demo rehearsal and release checklist

- [ ] Rehearse the 60-second demo arc.
  - [ ] 0:00–0:15: paste a Hinglish tip and show the Claim Ledger/missing stop-loss/hype phrases.
  - [ ] 0:15–0:35: show SEBI snapshot state, pre-tip run-up, volume spike, chart marker, and Output Guard stress test.
  - [ ] 0:35–0:50: complete Pause & Plan and play an optional short voice readout.
  - [ ] 0:50–1:00: show the three-arm experiment comparison and candid failure modes.
  - [ ] Confirm every screen shows the correct as-of date and Real/Synthetic status.
- [ ] Acceptance: the live demo works from preloaded snapshots without relying on a fragile live API and the limitations are stated honestly.

## Phase 4 — Zero-Cost Real-Time Data, Live Stocks Page & Finfluencer YouTube → WhatsApp Alerts

### 4.1 Update blueprint documentation for Phase 4

- [x] Update `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `AGENTS.md`, and `TASKS.md` to document:
  - [x] Zero-cost real-time Indian market data fetching (Yahoo Finance v8 NSE/BSE + TTL cache + snapshot fallback).
  - [x] Two new workspace pages: Real-Time Stocks (`/stocks`) and Finfluencers (`/finfluencers`).
  - [x] Real-time YouTube video monitoring via official Atom RSS / WebSub, bounded free-tier AI Claim Ledger parsing (Gemini / Groq + deterministic fallback), and Output-Guarded automated WhatsApp alerts (`callmebot`, `meta_cloud`, `dry_run`).
  - [x] Narrow opt-in privacy amendment for encrypted/masked WhatsApp alert subscriptions (while maintaining zero login and zero persistence of user tip uploads, pasted text, or Pause & Plan answers).
- [x] Acceptance: all five blueprint `.md` files are internally consistent and approved by the user before schema or code changes begin.

### 4.2 Add Supabase migration for YouTube analyses and opt-in WhatsApp subscriptions

- [x] Add `supabase/migrations/20261120000004_realtime_finfluencer_alerts.sql` extending `public.influencer` with YouTube channel metadata and creating `public.youtube_video_analysis`, `public.finfluencer_subscription`, and `public.whatsapp_delivery_log`.
  - [x] Enable RLS with explicit `deny_public_access_*` policies on every new table.
  - [x] Enforce idempotency via unique constraints on `video_id`, `(influencer_id, phone_hash)`, and `(subscription_id, video_analysis_id)`.
  - [x] Apply migration to Supabase and verify zero critical security findings via `get_advisors`.
- [x] Acceptance: schema applies cleanly and prevents plaintext exposure, duplicate video alerts, and unauthorized public Data API access.

### 4.3 Implement zero-cost real-time Indian market data adapter and live stocks API

- [x] Build `backend/src/integrations/liveMarketFeed.ts` using free Yahoo Finance v8 chart/quote & search endpoints (`.NS`, `.BO`, `^NSEI`, `^BSESN`, `^NSEBANK`) with TTL caching, strict timeouts, Zod validation, and automatic snapshot fallback.
  - [x] Upgrade `/api/meta/benchmarks`, `/api/stocks/lookup`, `/api/stocks/:ticker/prices`, `/api/stocks/:ticker/checks`, and `/api/report` to fetch live NSE/BSE data when enabled and fall back cleanly to Supabase snapshots or `COULD_NOT_VERIFY`.
  - [x] Add `/api/live/stocks/quotes`, `/api/live/stocks/search`, and `/api/live/stocks/:ticker/detail` endpoints.
  - [x] Add unit and integration tests for live quotes, cache hits, timeouts, and snapshot fallback.
- [x] Acceptance: live quotes and arbitrary NSE/BSE tickers resolve at zero API cost with explicit `LIVE_FEED` vs. `DATED_SNAPSHOT` provenance.

### 4.4 Implement real-time YouTube RSS/WebSub monitor and free-tier bounded AI claim parser

- [x] Build `backend/src/integrations/youtubeMonitor.ts` for official YouTube Atom RSS parsing, WebSub hub verification/push handling, and public caption extraction (with `METADATA_ONLY` fallback).
  - [x] Build `backend/src/integrations/freeLlmClaimParser.ts` supporting Google Gemini free tier (`gemini-2.5-flash`) and Groq free tier (`llama-3.3-70b-versatile`) strictly for Zod-validated Claim Ledger extraction with source-span verification and deterministic Hinglish fallback.
  - [x] Wire `freeLlmClaimParser.ts` into `/api/tips/parse` and the YouTube pipeline.
- [x] Acceptance: new uploads are detected from official YouTube RSS without scraping, and AI extraction cannot emit advice or unverified market facts.

### 4.5 Implement Output-Guarded WhatsApp alert pipeline and subscription APIs

- [x] Build `backend/src/integrations/whatsappNotifier.ts` with AES-256-GCM phone/key encryption, HMAC-SHA256 deduplication hashing, phone masking, and three zero-cost drivers (`callmebot`, `meta_cloud`, `dry_run`).
  - [x] Build `backend/src/domain/finfluencers/youtubeAlertPipeline.ts` enforcing deterministic SEBI + live market checks + template report builder + mandatory `scanSystemAuthoredText()` Output Guard + verbatim disclaimer on every WhatsApp alert.
  - [x] Add `/api/finfluencers/*`, `/api/internal/youtube/poll`, and `/api/webhooks/youtube` routes, plus overlap-guarded background polling in `backend/src/server.ts`.
  - [x] Add adversarial Output Guard tests verifying unsafe candidate WhatsApp messages are blocked (`BLOCKED_BY_GUARD`) and never dispatched.
- [x] Acceptance: subscribing, syncing new YouTube videos, guarded WhatsApp dispatch/preview, idempotency, and one-click unsubscribe all pass automated tests.

### 4.6 Build frontend Real-Time Stocks page (`/stocks`) and live dashboard benchmarks

- [x] Add `Real-Time Stocks` (`/stocks`, Phosphor `ChartLineUp`) and `Finfluencers` (`/finfluencers`, Phosphor `UsersThree`) to `DashboardLayout.tsx` and lazy-loaded routes in `App.tsx`.
  - [x] Build `frontend/src/features/stocks/RealTimeStocksPage.tsx` with live indices, universal NSE/BSE search, curated watchlist, neutral day-change styling, Recharts intraday/3M chart, live IST freshness pill, and one-click `"Run 5-Check Tip Autopsy"` handoff to `/analyze`.
  - [x] Update `DashboardOverviewPage.tsx` to display accurate live vs. dated snapshot provenance on benchmark cards.
- [x] Acceptance: `/stocks` renders cleanly on mobile and desktop with zero red/green BUY/SELL cues and passes lint/typecheck/tests.

### 4.7 Build frontend Finfluencers page (`/finfluencers`) with YouTube feed and WhatsApp subscribe modal

- [x] Build `frontend/src/features/finfluencers/FinfluencersPage.tsx` with SEBI status filters, creator cards, real-time latest YouTube uploads (`Real · YouTube Official RSS`), expandable AI Claim Ledger & Output-Guarded Facts Card viewer, WhatsApp Alert preview, and opt-in Subscribe modal (explicit consent checkbox, CallMeBot 2-step free setup / Meta Cloud / Preview mode, Test Alert trigger, and 1-click Unsubscribe).
- [x] Acceptance: users can inspect live analyzed YouTube videos and subscribe/unsubscribe without creating an account or exposing plaintext phone numbers.

### 4.8 End-to-end, Output Guard, and privacy/RLS verification for Phase 4

- [x] Run backend & frontend lint, typecheck, unit/integration tests, production builds, Supabase `get_advisors`, and Playwright E2E flows covering `/stocks` → `/analyze` and `/finfluencers` → sync → subscribe → guarded WhatsApp preview → unsubscribe.
- [x] Acceptance: all automated suites pass with zero Output Guard leaks, zero RLS advisories, and zero persisted tip/media uploads.

## Phase 5 — Pretend Money: 10-Year Historical Allocation Sandbox (`/pretend-money`)

### 5.1 Build 10-year historical timeline fetcher and deterministic pretend-money simulator

- [x] Extend `backend/src/integrations/liveMarketFeed.ts` with `fetchLiveTenYearTimeline` (`range=10y&interval=1wk` for NSE/BSE stock + aligned `^NSEI` NIFTY 50 benchmark, 10Y historical milestones, and snapshot-anchored `SYNTHETIC` / `DATED_SNAPSHOT` 10-year fallback series).
- [x] Create `backend/src/domain/pretend-money/pretendMoneySimulator.ts` using `decimal.js` for lump-sum and multi-tranche timeline allocations, post-entry max drawdown tracking, optional stop-loss threshold trigger detection, same-date `NIFTY 50` benchmark comparison, and Output-Guarded educational takeaways (`scanSystemAuthoredText`).
- [x] Expose `GET /api/live/stocks/:ticker/timeline-10y` and `POST /api/live/stocks/:ticker/pretend-evaluate` in `backend/src/api/routes/liveStocks.ts`.

### 5.2 Build frontend Pretend Money 10-Year Timeline page (`/pretend-money`)

- [x] Add `frontend/src/features/pretend-money/PretendMoneyPage.tsx` and wire `/pretend-money` into `App.tsx`, `DashboardLayout.tsx` (Phosphor `Coins` icon), and `DashboardOverviewPage.tsx`.
- [x] Provide universal NSE/BSE stock search, starting pretend wallet presets (`₹25k` to `₹10L`), click-to-allocate 10-year Recharts timeline, one-click historical scenarios (*Lump Sum 10Y Start*, *Chased Pre-Tip Run-Up Peak*, *Yearly Staggered Tranches*, *Pullback & Recovery Split*), optional stop-loss rule selector, interactive Time-Travel Evaluation Date scrubber, portfolio vs. `NIFTY 50` curve, and Output-Guarded evidence takeaways with mandatory disclaimer.
- [x] Verify with backend & frontend lint, typecheck, unit/integration tests, and production builds.

## Phase 6 — Progressive Web App (PWA) & 60fps Mobile Animation Polish

### 6.1 Build installable PWA manifest, deterministic brand icons, and privacy-safe Service Worker

- [x] Create `frontend/public/manifest.webmanifest`, `frontend/scripts/generate-pwa-icons.mjs` (`/pwa/icon.svg`, `192×192`, `512×512`, `maskable`, and `/apple-touch-icon.png`), standalone viewport-fit meta tags in `frontend/index.html`, and cache headers in `frontend/netlify.toml`.
- [x] Implement `frontend/public/sw.js` caching static application shell assets while strictly excluding `/api/*` and non-`GET` requests (`NetworkOnly`) to preserve zero-persistence privacy and live vs. dated snapshot provenance.
- [x] Add `frontend/src/lib/pwaClient.ts` and `frontend/src/components/ui/PwaStatusBanner.tsx` for offline provenance status and one-tap app installation.

### 6.2 Polish 60fps mobile animations, safe-area insets, and touch ergonomics (`DESIGN.md`)

- [x] Upgrade `HeroPage.tsx` (floating pill header + `44px × 44px` mobile glass drawer + provenance captions), `HeroStockWave.tsx` (passive `touchmove` candlestick interaction + `document.hidden` loop pause), `StickyBubblyNav` (`44px × 44px` touch targets + resting route label + safe-area bottom inset), `DashboardLayout.tsx`, and `index.css` (`.pt-safe`, `.pb-safe`, `.px-safe`, mobile `blur(10px)` glass performance, and `@media (hover: hover)` hover scoping).
- [x] Verify with frontend ESLint, TypeScript typecheck, Vitest PWA unit tests, and production Vite build.

## Backlog / Deferred Beyond MVP

- [ ] OS-level WhatsApp share-to-app integration, subject to privacy and platform-policy review.
- [ ] Persistent user accounts, logins, portfolios, or saved tip analysis history (not permitted without a separate product/privacy review).
- [ ] Social-platform scraping of Telegram, WhatsApp, or Instagram (permanently excluded from the product direction).
- [ ] Broker integration, trading, portfolio tracking, and buy/sell/hold recommendations (permanently excluded from the product direction).
