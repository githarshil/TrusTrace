# Tip Autopsy — Design System Specification (`DESIGN.md`)

**Version:** 2.0  
**Product:** Tip Autopsy (Problem F3: Signal vs. Noise for Retail Investors — The Big Hack 2.0, Bengaluru)  
**Core Product Rule:** *We grade the information, not the investment.*  
**Single Source of Truth:** This document governs all frontend design tokens, layout geometry, glass surfaces, interactive components, animations, accessibility rules, and product safety guardrails for **Tip Autopsy**.

---

## 1. Design Philosophy

Tip Autopsy is engineered as a calm, high-craft financial intelligence interface inspired by Apple’s human interface discipline and restrained **Liquid Glass** surfaces. Retail investors evaluating stock tips from Telegram, WhatsApp, Instagram Reels, or YouTube are routinely subjected to manufactured urgency, misleading hit-rate leaderboards, and ambiguous social proof. The interface counters this noise with quiet precision, generous negative space, legible tabular data, and objective evidence.

### Core Principles
1. **Trust and Transparency:** Every metric carries a visible `as-of` date and a clear `Real` or `Synthetic / Demo` provenance label. Uncertainty is never hidden behind synthetic certainty—missing fields explicitly display `Not stated`, thin evidence states `Not enough tips to judge`, and unavailable data states `Could not verify`.
2. **Financial Intelligence Without Verdict Theater:** The system surfaces facts—SEBI register snapshot lookup status, pre-tip price run-ups, volume spikes, liquidity, market cap band, exchange surveillance status, disclosure clarity, and Nifty-50 benchmark-adjusted credible intervals—without ever issuing `BUY`, `SELL`, or `HOLD` labels, price targets, trust scores, or fraud accusations.
3. **Simplicity and Clarity:** Information is arranged in scannable glass cards with strict typographic hierarchy and disciplined spacing. Complex statistical concepts (such as Beta-Binomial credible ranges and volume z-scores) pair concise numbers with plain-language explanations.
4. **Premium Craftsmanship:** Inspired by Apple’s hardware-software harmony and subtle Liquid Glass depth: translucent surfaces sit over warm ivory and soft sage ambient gradients, separated by crisp hairline borders (`1px`), restrained ambient shadows, and tabular numerals (`tabular-nums`).
5. **Restraint Over Clutter:** Glassmorphism is applied selectively to floating navigation, primary cards, modals, drawers, and status pills—never stacked indiscriminately across dense data rows where high contrast and fast scanning take priority.

---

## 2. Brand Identity

### Brand Voice & Positioning
* **Name:** Tip Autopsy
* **Eyebrow Tagline:** `Signal vs. Noise for Retail Investors`
* **Hero Headline:** `Think Before You Trust.` (with `Trust` rendered in the primary sage-forest accent)
* **Core Rule:** *We grade the information, not the investment.*
* **Mandatory Disclaimer Posture:** Informative, neutral, matter-of-fact, and non-advisory. Never sensationalist, punitive, or predictive.

### Neutral Evidence Vocabulary (Mandatory)
All UI states, badges, and cards must use neutral evidence language rather than investment verdicts or accusations:
* **Information Verdict (Facts Card):** Non-advisory evidence summary grading information completeness, disclosure, SEBI snapshot status, and historical market context—never a stock action recommendation
* **SEBI Register Status:** `Registered` · `Not found in SEBI register` · `Unclear`
* **Market & Lateness Checks:** `Within normal range` · `Needs attention` · `Could not verify`
* **Creator Track Record:** Credible range (e.g., `30% to 60%` vs. Nifty 50) or `Not enough tips to judge`
* **Claim Extraction:** Extracted value with highlighted source reference, or `Not stated` (with gated/paywalled note when a tip states `SL PAID` or `SL. VIP PREMIUM`)
* **Disclosure Grade:** `Clear disclosure` · `Vague` · `None`
* **Data Provenance:** `Real · Live Feed (fetched HH:MM IST)` · `Real · Dated Snapshot` · `Real · YouTube Official RSS` · `Synthetic / Demo` · `Mixed (Labelled)`

### Prohibited Labels & Concepts
The UI must **never** display:
* Overall trust scores or single aggregated risk scores
* `BUY`, `SELL`, or `HOLD` badges, buttons, or stock recommendations
* Target prices, guaranteed return claims, or future price predictions
* `Scammer`, `fraud`, or moral/legal verdicts on individuals
* Red/green stock recommendation coloring

---

## 3. Color System

The color palette translates a warm ivory editorial canvas and subtle sage-mint atmospheric gradients into a disciplined fintech token set. **Green tones signify calm analytical clarity, positive benchmark-adjusted intervals, or clear disclosure—never a "Buy" signal. Warm amber/ochre signals factual attention (such as a volume spike, missing disclosure, or surveillance listing)—never a "Sell" command.**

### 3.1 Core Surface & Background Tokens

| Token Name | HEX | RGBA / Usage | Role |
| :--- | :--- | :--- | :--- |
| `--bg-canvas-primary` | `#FAF8F4` | Warm ivory / off-white | Primary page and workspace background (pairs with `DashBoardBackground.jsx` fallback `#F3EFE7` / `rgb(243, 239, 231)`) |
| `--bg-canvas-secondary` | `#F3F0EA` | Very light warm grey | Secondary sections, subtle alternating rows, inset wells |
| `--bg-surface-elevated` | `#FFFFFF` | Pure crisp white | High-contrast cards, chart containers, active inputs |
| `--bg-ambient-sage` | `#E6EFEA` | Soft muted sage wash | Ambient radial/linear gradient glow in hero & header |
| `--bg-ambient-mint` | `#DCECE4` | Delicate mint wash | Secondary soft atmospheric gradient accent |
| `--bg-well-muted` | `#EFECE6` | Warm stone tint | Recessed containers, empty state wells, code/ledger chips |
| `--bg-dashboard-shader` | `ui-ux/DashBoardBackground.jsx` | Wayglim WebGL2 animated halo/grain shader (`rgb(243, 239, 231)` base) | Full-bleed animated gradient canvas behind the frosted glass dashboard shell |

### 3.2 Text Hierarchy Tokens

| Token Name | HEX | Contrast vs. `#FAF8F4` | Role |
| :--- | :--- | :--- | :--- |
| `--text-primary` | `#161A18` | `16.4:1` (AAA) | Headlines, primary body copy, key metrics, active labels |
| `--text-secondary` | `#4A524D` | `7.8:1` (AAA) | Supporting descriptions, explanations, secondary metadata |
| `--text-tertiary` | `#6E7771` | `4.6:1` (AA) | Captions, `as-of` timestamps, axis ticks, provenance tags |
| `--text-on-dark` | `#FAF8F4` | `16.9:1` (AAA) | Text inside primary dark charcoal pill buttons (`#161A18`) |
| `--text-on-accent` | `#123528` | `10.9:1` (AAA) | Text inside soft sage/mint badges |

### 3.3 Brand Accents & Interactive Buttons

| Token Name | HEX | Role |
| :--- | :--- | :--- |
| `--accent-sage-primary` | `#4A7C64` | Muted sage green — primary brand accent, highlighted word `"Trust"`, active indicators |
| `--accent-mint-secondary` | `#B8D8C8` | Soft mint — subtle highlight fills, pill tinting, soft chart gradient stop |
| `--accent-forest-deep` | `#1F4D3A` | Deep forest green — high-contrast text accents, active borders, authoritative markers |
| `--btn-primary-bg` | `#161A18` | Rich near-black pill CTA fill (`Analyze a Tip`, `Get Started`) |
| `--btn-primary-hover` | `#29302C` | Elevated charcoal hover fill |
| `--btn-primary-active` | `#0D100E` | Pressed charcoal fill |
| `--btn-secondary-bg` | `rgba(255, 255, 255, 0.72)` | Translucent glass secondary button (`See How It Works`) |
| `--btn-secondary-hover` | `rgba(255, 255, 255, 0.92)` | Brighter glass surface on hover |

### 3.4 Liquid Glass Surfaces, Borders & Shadows

| Token Name | Value | Role |
| :--- | :--- | :--- |
| `--glass-nav` | `rgba(255, 255, 255, 0.74)` | Floating top navigation pill (`backdrop-filter: blur(20px) saturate(150%)`) |
| `--glass-card` | `rgba(255, 255, 255, 0.68)` | Standard modular glass panel (`backdrop-filter: blur(16px) saturate(140%)`) |
| `--glass-card-subtle` | `rgba(250, 248, 244, 0.62)` | Secondary nested glass surface (`backdrop-filter: blur(12px)`) |
| `--glass-overlay` | `rgba(22, 26, 24, 0.28)` | Modal / mobile drawer backdrop scrim |
| `--border-hairline` | `rgba(22, 26, 24, 0.09)` | Crisp structural hairline border |
| `--border-glass-highlight` | `rgba(255, 255, 255, 0.85)` | Top/inner specular edge highlight on glass panels |
| `--border-accent-subtle` | `rgba(74, 124, 100, 0.28)` | Sage-tinted border for active or highlighted cards |
| `--shadow-glass-sm` | `0 4px 16px -2px rgba(22, 26, 24, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)` | Subtle elevation for pills, badges, and compact cards |
| `--shadow-glass-md` | `0 12px 32px -8px rgba(22, 26, 24, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.85)` | Floating navigation bar, primary glass cards, popovers |
| `--shadow-glass-lg` | `0 24px 60px -12px rgba(22, 26, 24, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9)` | Modals, slide-over drawers, and spotlight panels |

### 3.5 Objective Evidence Status & Chart Colors

| Token Name | HEX | Background Tint | Meaning |
| :--- | :--- | :--- | :--- |
| `--status-neutral-ok` | `#2A6F52` | `#E6F2EC` | `Within normal range` · `Registered` · `Clear disclosure` |
| `--status-attention` | `#9A5B13` | `#FDF3E4` | `Needs attention` · `Vague` · Volume spike / pre-tip run-up / watchlist flag |
| `--status-unverified` | `#4E5964` | `#EEF1F4` | `Not found in SEBI register` · `Unclear` · `Could not verify` · `Not enough tips to judge` · `Not stated` |
| `--chart-line-primary` | `#3B8E6A` | `rgba(59, 142, 106, 0.22)` to `rgba(59, 142, 106, 0.0)` | Smooth stock price line and soft area gradient |
| `--chart-candlestick-up` | `#63A98A` | — | Subtle background upward candle / volume bar |
| `--chart-candlestick-down` | `#A7B8B0` | — | Muted cool sage-grey background downward candle / volume bar (avoids aggressive red) |
| `--chart-marker-tip` | `#1F4D3A` | `#D8ECE2` | Historical tip date marker ring and active focus halo |
| `--chart-benchmark-ref` | `#6E7771` | — | Nifty 50 reference line / baseline marker |

---

## 4. Typography System

Typography draws from Apple’s clean geometric-humanist sans-serif cadence: crisp display headlines with tight negative tracking, airy body paragraphs, and strict monospace/tabular numerals for financial metrics, dates, ratios, and percentages.

### 4.1 Font Families
* **Display & UI Sans (`--font-sans`):** `'Plus Jakarta Sans'`, `'Inter'`, `-apple-system`, `BlinkMacSystemFont`, `'SF Pro Display'`, `'SF Pro Text'`, `'Segoe UI'`, `Roboto`, `sans-serif`
* **Monospace / Tabular (`--font-mono`):** `'JetBrains Mono'`, `'SF Mono'`, `ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, `monospace`

All numeric financial figures, prices, percentages, credible intervals (`30% to 60%`), z-scores/multiples (`6.1x`), and timestamps must apply:
```css
font-variant-numeric: tabular-nums lining-nums;
```

### 4.2 Type Scale & Specifications

| Role | Desktop Size | Mobile Size | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Headline (`H1`)** | `64px` (`4rem`) | `38px` (`2.375rem`) | `700` (Bold) | `1.08` | `-0.03em` |
| **Page Title (`H1` App)** | `36px` (`2.25rem`) | `28px` (`1.75rem`) | `700` (Bold) | `1.15` | `-0.025em` |
| **Section Heading (`H2`)** | `24px` (`1.5rem`) | `20px` (`1.25rem`) | `600` (SemiBold) | `1.25` | `-0.02em` |
| **Card / Panel Title (`H3`)** | `18px` (`1.125rem`) | `16px` (`1rem`) | `600` (SemiBold) | `1.3` | `-0.015em` |
| **Subheading (`H4`)** | `15px` (`0.9375rem`) | `14px` (`0.875rem`) | `600` (SemiBold) | `1.4` | `-0.01em` |
| **Body Lead** | `18px` (`1.125rem`) | `16px` (`1rem`) | `400` (Regular) | `1.55` | `-0.005em` |
| **Body Default** | `15px` (`0.9375rem`) | `15px` (`0.9375rem`) | `400` (Regular) | `1.55` | `0em` |
| **UI Label / Field Label** | `13px` (`0.8125rem`) | `13px` (`0.8125rem`) | `500`–`600` | `1.35` | `0.01em` |
| **Eyebrow / Badge** | `12px` (`0.75rem`) | `11.5px` (`0.71875rem`) | `600` (SemiBold) | `1.2` | `0.02em` |
| **Caption / Provenance / Date** | `12px` (`0.75rem`) | `11.5px` (`0.71875rem`) | `400`–`500` | `1.4` | `0.01em` |
| **Financial KPI / Metric Value** | `28px` (`1.75rem`) | `24px` (`1.5rem`) | `700` (Bold) | `1.15` | `-0.02em` (`tabular-nums`) |

---

## 5. Layout and Grid System

### 5.1 Containers & Page Widths
* **Max Content Container:** `1280px` centered (`margin-inline: auto`).
* **Editorial / Hero Text Column:** `760px` max-width centered for effortless reading and balanced visual rhythm.
* **Dashboard Workspace Container:** `1360px` max-width with `24px` horizontal gutter on desktop (`≥1280px`), `20px` on tablet (`768px–1279px`), and `16px` on mobile (`<768px`).

### 5.2 Grid Rules
* **Visual Reference Assets (`ui-ux/`):**
  * `ui-ux/hero.jpeg` — Primary hero visual reference (floating pill header, `"Think Before You Trust."`, animated stock curve, and lower finfluencer media strip).
  * `ui-ux/DashBoard.png` — Primary dashboard layout inspiration (frosted glass app shell, left sidebar rail with bottom mission card, top command/search bar + provenance status pill, 3-card Market Overview strip, and bottom analysis table) adapted to Tip Autopsy's strict non-advisory and zero-persistence guardrails.
  * `ui-ux/DashBoardBackground.jsx` — Animated WebGL2 gradient background component mounted behind the dashboard shell.
* **Hero Composition Grid:** Single vertical stack flow—Floating Pill Header (`top: 20px`) → Centered Hero Copy Block → Full-bleed Animated Stock Chart wave band → Curated Hinglish Finfluencer Media Strip (`grid-template-columns: repeat(6, minmax(0, 1fr))` or responsive 3-column/6-card row with `14px` gap on desktop; horizontal scroll track on mobile/tablet).
* **Dashboard Shell & Analysis Grid (adapted from `ui-ux/DashBoard.png`):**
  * **Background Layer:** `<DashBoardBackground />` (`ui-ux/DashBoardBackground.jsx`, copied verbatim) inside a `relative isolate overflow-hidden` root wrapper; the frosted glass dashboard window sits in `relative z-10` with `24px` outer radius (`1px` `--border-glass-highlight`, `--shadow-glass-lg`).
  * **Desktop (`≥1200px`):** Fixed/sticky left glass sidebar rail (`220px–240px` width, brand mark, `Dashboard` / `New Analysis` / `Real-Time Stocks` / `Finfluencers` / `Demo Corpus` / `How Checks Work` nav items using Phosphor Icons, and bottom `"We grade the information, not the investment."` shield card) + fluid main workspace (`1fr`) containing a `12-column` subgrid (`gap: 20px`).
  * **Dashboard Overview Top Band:** Rounded frosted command/intake bar (`Photo / Video / Text + Influencer & Stock` + `Analyze` dark pill CTA) paired with a right-side provenance badge (`Real · Live Feed · NSE / BSE · Updated HH:MM IST` when live feed is active, automatically falling back to `Dated Market Snapshots · NSE / BSE` when offline—never mislabelling static data as live), followed by a 3-column **Market Overview** benchmark strip (`NIFTY 50`, `SENSEX`, `BANKNIFTY` with freshness timestamp or `as-of` snapshot date, index level, neutral change badge, and sparkline) and the **Curated Demo & In-Session Analyses** table (replacing any `"Past Reports"` or `"Confidence Score"` columns with compliant SEBI status, neutral evidence status, and `Real`/`Curated Demo` provenance).
  * **Real-Time Stocks Workspace (`/stocks`, Phase 4):** Live benchmark strip + universal NSE/BSE ticker search + curated Indian equity table/grid (tabular numerals, neutral day-change chips with zero red/green buy/sell framing, volume, market-cap band, 52W range) + interactive intraday/3M Recharts detail panel with a primary `"Run 5-Check Tip Autopsy"` CTA routing into `/analyze`.
  * **Finfluencers Workspace (`/finfluencers`, Phase 4):** Searchable creator cards displaying SEBI snapshot badges (`Registered` / `Not found` / `Unclear`), YouTube channel links, live latest YouTube video list (`Real · YouTube Official RSS` + `Transcript` / `Metadata only` pills), expandable AI Claim Ledger + Output-Guarded Information Verdict viewer, WhatsApp alert preview, and an opt-in **Subscribe for WhatsApp Alerts** glass modal (explicit consent checkbox, zero-cost CallMeBot / Meta Cloud / Preview modes, test alert button, and one-click unsubscribe).
  * **Active Analysis Workspace:**
    * Primary top row: Multimodal Tip Input (Photo / Video / Text + Influencer & Stock) & Claim Ledger (`7 cols`) + Influencer Identity, SEBI Lookup & Disclosure Grade (`5 cols`).
    * Middle row: Interactive Tip Time Machine Chart (`8 cols`) + Honest Creator Track Record (`4 cols`).
    * Evidence row: Five Deterministic Market & Lateness Checks in a responsive `5-column` row on wide screens (`repeat(5, minmax(0, 1fr))`), wrapping to `2–3` columns on medium screens and `1` column on mobile.
    * Bottom row: Information Verdict (Guarded Facts Card) + Pause & Plan Pre-Commitment Gate + Methodology & Provenance Bar (`12 cols`).

---

## 6. Spacing and Dimensions

### 6.1 Spacing Scale (`4px` Base Unit)
* `--space-1`: `4px`
* `--space-2`: `8px`
* `--space-3`: `12px`
* `--space-4`: `16px`
* `--space-5`: `20px`
* `--space-6`: `24px`
* `--space-8`: `32px`
* `--space-10`: `40px`
* `--space-12`: `48px`
* `--space-16`: `64px`
* `--space-20`: `80px`

### 6.2 Key Dimensional Constants
* **Floating Nav Pill Height:** `56px` on desktop, `52px` on mobile; border radius `9999px` (full pill).
* **Primary / Secondary Pill Buttons:** Height `44px` (default) or `48px` (hero primary CTA); border radius `9999px`; horizontal padding `22px–24px`.
* **Standard Glass Card Padding:** `24px` on desktop, `18px` on mobile; border radius `20px`.
* **Compact Metric / Check Card Padding:** `16px`–`18px`; border radius `16px`.
* **Status Pill / Badge Height:** `26px`–`28px`; border radius `9999px`; horizontal padding `10px–12px`.
* **Minimum Touch Target (All Interactive Controls):** `44px × 44px` hit area on touch devices.

---

## 7. Glassmorphism and Liquid Glass Guidelines

Liquid Glass in Tip Autopsy evokes refined optical clarity—like light passing through sculpted frosted glass over warm paper and soft sage mist.

### Implementation Rules
1. **Surface Layering Ceiling:** Never nest more than **two** blurred glass layers (`backdrop-filter`) on top of each other. Inner sub-panels should use solid or high-opacity `#FFFFFF` / `#F3F0EA` wells with a `1px` `--border-hairline` border.
2. **Specular Top Highlight:** Glass cards and navigation pills include a subtle inner top edge (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85)`) paired with `--border-hairline` around the perimeter.
3. **Readability First:** Always pair translucent glass backgrounds (`0.68–0.74` alpha) with high-contrast text (`#161A18` or `#4A524D`). Never place low-contrast grey text over a moving chart or GIF without an opaque/high-opacity scrim or pill backing.
4. **Ambient Gradients & Dashboard Background:** Soft radial gradients in `--bg-ambient-sage` (`#E6EFEA`) and `--bg-ambient-mint` (`#DCECE4`) sit subtly in the hero backdrop of `--bg-canvas-primary` (`#FAF8F4`). On the Dashboard workspace, mount `ui-ux/DashBoardBackground.jsx` verbatim (`<DashBoardBackground />`) inside a `relative isolate overflow-hidden` container behind the `relative z-10` frosted glass shell; keep its built-in `pauseOffscreen: true`, `respectReducedMotion: true`, and `rgb(243, 239, 231)` WebGL2 fallback intact. Never modify or refactor the Wayglim/Paper Shaders engine code inside `DashBoardBackground.jsx`.

---

## 8. Navigation System

### 8.1 Landing Page Floating Pill Navigation
* Positioned at the top center (`margin-top: 20px`, max-width `1040px`, `width: calc(100% - 32px)`), floating cleanly above the hero canvas.
* **Left:** Brand mark (Phosphor `TrendUp` / `ChartLineUp` icon inside a subtle `32px` glass/sage badge + `"Tip Autopsy"` wordmark in `16px` SemiBold `#161A18`).
* **Center / Right Links:** Concise single-word links (`Analyze`, `How It Works`, `Evidence`) in `14px` Medium `#4A524D`, transitioning to `#161A18` on hover with a `2px` bottom or pill indicator.
* **Far Right CTA:** Solid charcoal pill button (`#161A18`, `#FAF8F4` text, height `40px`, radius `9999px`) reading `"Analyze a Tip"` (or `"Get Started"`).

### 8.2 Mobile & Tablet Navigation Adaptation
* Below `768px`, center links collapse into a clean glass drawer triggered by a `44px × 44px` Phosphor `List` icon button; the brand mark remains on the left and the primary `"Analyze a Tip"` action remains accessible without crowding.

---

## 9. Hero Section

The hero section is the flagship first impression and follows a clean, airy editorial-fintech composition:

1. **Floating Pill Navigation Bar** at the top over a warm ivory (`#FAF8F4`) and soft sage/mint (`#E6EFEA` / `#DCECE4`) ambient gradient wash.
2. **Centered Hero Copy Block:**
   * **Eyebrow Pill:** Soft translucent mint/sage pill (`#E6F2EC` fill, `1px` border `rgba(74, 124, 100, 0.25)`, `#1F4D3A` text) reading: `Signal vs. Noise for Retail Investors`.
   * **Headline (`64px` desktop / `38px` mobile):** `Think Before You ` + `<span style="color: #4A7C64;">Trust.</span>`
   * **Supporting Copy (`18px` desktop / `16px` mobile):** Concise two-line explanation of how Tip Autopsy checks SEBI registration, pre-tip price/volume signals, Hinglish hype, and benchmark-adjusted track records—giving evidence, never buy/sell advice.
   * **Action Row:** Primary dark pill CTA `"Analyze a Tip"` (`#161A18`) paired with secondary glass pill CTA `"See How It Works"` (with a subtle play/guide indicator).
3. **Animated Stock Chart Band:** Runs seamlessly across the full width behind and below the hero CTAs, blending into the canvas without a heavy boxed border, accompanied by a subtle corner provenance note (`Illustrative demo market curve · Real NSE/BSE data in analyzer`).
4. **Curated Hinglish Finfluencer Media Strip:** Positioned directly beneath the animated stock line across the lower hero band, showcasing the curated Hinglish influencer photos and videos from `photos/` and `videos/` (each showing influencer name, stock/instrument, and click-to-analyze prefill), followed by a subtle caption noting their `Curated Demo / Mixed` provenance.

---

## 10. Animated Stock Chart

* **Rendering:** Smooth SVG or HTML5 Canvas visualization spanning `100%` container width (`height: 220px` on desktop, `160px` on mobile) integrated directly into the hero backdrop.
* **Visual Elements:**
  * Subtle faint background candlestick / volume bars (`#63A98A` and `#A7B8B0` at low opacity `0.16–0.25`) receding into the warm ivory canvas.
  * Smooth continuous price curve (`#3B8E6A`, `2.5px` stroke width) with organic upward swings, pullbacks, and occasional rounded peaks/dips.
  * Soft vertical linear gradient fill beneath the line fading from `rgba(59, 142, 106, 0.22)` to `rgba(250, 248, 244, 0)`.
  * Gentle left-to-right phase drift or subtle live-point breathing motion (`6s–10s` smooth cycle, `ease-in-out`), pausing or freezing cleanly when `prefers-reduced-motion: reduce` is active.
* **Provenance Label:** Displays a discreet `Demo Market Visual` caption so first-time visitors never confuse ambient hero graphics with live portfolio quotes.

---

## 11. Curated Hinglish Finfluencer Media Strip

Immediately beneath the animated stock line, display the **curated Hinglish finfluencer media cards** sourced from `photos/` and `videos/` (`aspect-ratio: 4 / 5` or `3 / 4`, border radius `18px`, subtle `1px` translucent border `rgba(255, 255, 255, 0.75)` and `--shadow-glass-sm`). Selecting any card prefills the analyzer with that media asset, influencer name, and stock/instrument name.

### Curated Corpus Assets (`<Influencer>__<Stock>__<Registration>`)
1. `photos/Ashish_Kyal__Sensex_82900_CE__Not_Registered.jpeg` — Ashish Kyal · Sensex 82900 CE (Telegram screenshot, `SL PAID`)
2. `photos/Chinmay_Dudhane__Nifty_25500_CE__Registered.jpeg` — Chinmay Dudhane (Trading cafe India) · Nifty 25500 CE (Telegram screenshot, `SL- Paid`)
3. `photos/Harsh_Bhagat__Nifty_25600_CE__Not_Registered.jpeg` — Harsh Bhagat · Nifty 25600 CE (Telegram screenshot, `SL. VIP PREMIUM` + account handling offer)
4. `videos/Rakesh_Bansal__Borosil_Renewables_Ltd__Registered.App.mp4` — Rakesh Bansal · Borosil Renewables Ltd (Muted looping video clip)
5. `videos/Rakesh_Bansal__Sarveshwar_Foods__Registered.App.mp4` — Rakesh Bansal · Sarveshwar Foods (Muted looping video clip)
6. `videos/Vivek_Rana__Wipro_Limited__Not_Registered.App.mp4` — Vivek Rana · Wipro Limited (Muted looping video clip)

### Visual & Interaction Rules
* **Media Assets:** Video cards render muted autoplaying/looping `.mp4` clips from `videos/` (`playsInline`, `muted`, `loop`) and screenshot cards render crisp `.jpeg` previews from `photos/`—never generic placeholder boxes.
* **Caption Overlay:** Positioned near the bottom (`bottom: 14px`, `left: 12px`, `right: 12px`) inside a crisp glass/frosted pill or subtle dark-scrimmed caption bar (`rgba(22, 26, 24, 0.76)` with `backdrop-filter: blur(8px)`, `#FFFFFF` text, `13px` SemiBold, `10px` radius) displaying the **Influencer Name** and **Stock / Instrument Name** clearly over any frame.
* **Provenance & Neutrality Rule:** Display a `Curated Demo` provenance tag in the strip header/caption area. Never render a red/green stock buy/sell indicator on these cards; SEBI snapshot status is presented neutrally inside the analyzer rather than as a stock verdict.
* **Layout Behavior:**
  * **Desktop (`≥1024px`):** Responsive 6-column row (or 3×2 grid on medium-desktop widths, `gap: 14px`); hovering gently lifts the card (`translateY(-4px)`) and subtly brightens the border (`200ms ease-out`).
  * **Tablet & Mobile (`<1024px`):** Smooth horizontal swipe/scroll carousel (`scroll-snap-type: x mandatory`, `gap: 12px`) with peeked next card so mobile users can browse effortlessly.

---

## 12. Dashboard

The **Tip Autopsy Analysis Workspace** follows the frosted glass shell structure of `ui-ux/DashBoard.png` layered over the animated WebGL2 gradient in `ui-ux/DashBoardBackground.jsx` (`relative isolate overflow-hidden` outer wrapper with `relative z-10` frosted glass container), while enforcing all Tip Autopsy safety and zero-persistence rules.

### Guardrail Adaptations vs. `ui-ux/DashBoard.png` Concept Mock
* **No persisted `"Past Reports"`:** Because Version 1 stores zero user data or analysis history, replace `"Past Reports"` with **`Demo Corpus`** (curated `photos/` & `videos/` cases) plus transient in-session analyses cleared on reset/reload.
* **No `"Confidence Score (%)"` or `"High / Moderate / Low Risk"` stock labels:** In the overview table, replace percentage confidence scores and risk-level pills with neutral evidence columns: **`Tip / Stock & Instrument`**, **`Creator & Media`**, **`SEBI Snapshot`**, **`Information Verdict / Key Findings`** (`Needs attention`, `Within normal range`, `Could not verify`), and **`Snapshot Date / Provenance`**.
* **No `"Live Market Data"` misrepresentation:** Label the top-right status pill **`Dated Market Snapshots · NSE / BSE`** with explicit `as-of` dates.

### Required Dashboard Modules
1. **Frosted Sidebar Rail & Header:** Left rail inside the glass shell with brand mark, navigation (`Dashboard`, `New Analysis`, `Demo Corpus`, `How Checks Work`), `"No login · No personal data"` privacy pill, `Real vs. Synthetic` legend, and the bottom shield callout: *"We grade the information, not the investment."*
2. **Dashboard Overview (Benchmark Strip & Curated/Session Table):**
   * **Top Intake Bar + Snapshot Status:** Quick multimodal/structured intake bar (`Analyze` pill CTA) beside the dated `NSE / BSE Snapshots` status pill.
   * **3-Column Market Overview Strip:** Compact cards for `NIFTY 50`, `SENSEX`, and `BANKNIFTY` showing dated index close, session change, subtle sage sparkline, `as-of` date, and `Real` badge (falling back to `Could not verify` if a benchmark snapshot is missing).
   * **Curated Demo & In-Session Analyses Table:** Lists the 6 preloaded `photos/` and `videos/` Hinglish cases (plus transient current-session runs) using compliant neutral evidence columns.
3. **Tip Input Panel (Multimodal + Influencer & Stock):**
   * **Media / Text Tabs + Dropzone:** Allows the user to upload **any Photo** (`.jpeg`, `.png`, `.webp`), upload **any Video** (`.mp4`, `.webm`, `.mov`), or paste **Hinglish/English Text**, with an in-memory transient preview and a clear `"Processed transiently · Not saved"` notice. Includes one-click sample chips/cards from `photos/` and `videos/`.
   * **Influencer & Stock Fields:** Always displays clean, searchable inputs for **Influencer Name** (name, handle, or SEBI registration number) and **Stock / Instrument Name** (equities or index options), pre-populated or editable when extracted from media/text and functional even without media parsing.
4. **Influencer Identity & Disclosure Card:**
   * Displays influencer name/handle, deterministic SEBI register snapshot lookup status (`Registered`, `Not found in SEBI register`, or `Unclear`) with snapshot `as-of` date, and **Sponsor Disclosure Grade** (`Clear disclosure`, `Vague`, or `None`).
   * Never stops the analysis solely because an influencer is not in the SEBI register; clearly notes that `"Not found"` does not mean `"fraud"`.
5. **Structured Claim Ledger:**
   * Displays extracted fields—`Stock`, `Direction`, `Target`, `Deadline`, `Stop-Loss`—linking each to its highlighted text span and rendering missing fields explicitly as `Not stated`.
   * Includes **Hinglish Hype Detection** highlighting pressure/urgency phrases in the pasted text.
6. **Five Deterministic Market & Lateness Checks:**
   * Renders all five checks—`Liquidity`, `Market Cap`, `Volume Spike`, `Lateness / Pre-Tip Run-Up`, and `Surveillance & Circuit Band`—as of both the tip date and latest snapshot date.
   * Each card shows its neutral status (`Within normal range`, `Needs attention`, or `Could not verify`), exact measured metric + `as-of` date + `Real` badge, and plain-language explanation.
7. **Creator Track Record Card:**
   * Displays Nifty-50 benchmark-adjusted performance as a **Beta-Binomial credible interval** (e.g., `30% to 60%`) or `Not enough tips to judge` when sample size is too small.
8. **Interactive Tip Time Machine Chart:**
   * Interactive price and volume chart with timeframe selector, historical tip markers, pre-tip run-up / volume spike callouts, and `Real` data provenance label.
   * Tapping or clicking a tip marker opens the tips from that exact date (showing tip text, source link, and `Real` or `Synthetic` label).
9. **Information Verdict (Guarded Facts Card) & Pause & Plan Behavioral Gate:**
   * Summarizes the matched stock/instrument evidence and the system's guarded **Information Verdict** (grading completeness, disclosure, SEBI snapshot match, and market context—never a buy/sell verdict).
   * Interactive pre-commitment prompt before `"I'd act on this"` covering:
     1. *How much can I afford to lose?*
     2. *At what price do I exit?*
     3. *What would prove this tip wrong?*
   * Concludes with the mandatory neutral disclaimer: *"This report describes historical facts and risk factors around a tip. It is not investment advice or SEBI-registered research. The decision is yours."*

---

## 13. Component Library

Every component follows consistent geometry, state transitions (`150ms–220ms`), and focus accessibility.

### 13.1 Navigation Bars
* **Appearance:** Translucent pill (`--glass-nav`) with `--shadow-glass-md` and `1px` `--border-hairline`.
* **Dimensions & Radius:** Height `56px` (desktop), `52px` (mobile); `border-radius: 9999px`; padding `0 8px 0 18px`.
* **States:** Hover/active links shift from `#4A524D` to `#161A18`; keyboard focus renders a `2px` solid `#4A7C64` ring with `2px` offset.

### 13.2 Buttons
* **Primary Button:** Fill `#161A18`, text `#FAF8F4`, height `44px`–`48px`, radius `9999px`, padding `0 24px`, font `14px`–`15px` SemiBold. Hover: `#29302C` + `translateY(-1px)`. Active: `#0D100E` + `translateY(0)`. Disabled: `opacity: 0.45`, `cursor: not-allowed`, no hover lift.
* **Secondary Glass Button:** Fill `--btn-secondary-bg`, border `1px solid --border-hairline`, text `#161A18`, height `44px`–`48px`, radius `9999px`, padding `0 22px`. Hover: `--btn-secondary-hover`. Active: `--bg-canvas-secondary`. Disabled: `opacity: 0.45`.
* **Icon / Tertiary Button:** `40px–44px` touch area, transparent or `--glass-card-subtle` fill, radius `9999px` or `12px`.

### 13.3 Inputs & Textareas
* **Appearance:** `--bg-surface-elevated` (`#FFFFFF`) or `--glass-card` with `1px` `--border-hairline` border.
* **Dimensions & Radius:** Single-line input height `44px`, radius `12px`, padding `0 14px`; textarea min-height `112px`, radius `16px`, padding `14px 16px`.
* **Typography:** `15px` Regular `#161A18`, placeholder `#6E7771`.
* **States:** Hover border `rgba(22, 26, 24, 0.22)`; Focus border `1.5px solid #4A7C64` with `0 0 0 3px rgba(74, 124, 100, 0.16)`; Disabled `#F3F0EA` fill with `opacity: 0.55`.

### 13.4 Selectors & Tabs
* **Segmented Control / Tabs:** Pill or rounded container (`radius: 12px` or `9999px`, fill `--bg-canvas-secondary`, padding `4px`). Active tab sits on `#FFFFFF` with `--shadow-glass-sm` and `#161A18` SemiBold text; inactive tabs use `#4A524D` Medium text.
* **Dropdown / Select:** `44px` height, `12px` radius, `1px` `--border-hairline`, `14px`–`15px` text, Phosphor `CaretDown` icon (`16px`).

### 13.5 Glass Cards & Status Badges
* **Glass Cards:** `--glass-card` fill, `20px` radius (`16px` for compact check cards), `24px` padding (`16px` for compact check cards), `1px` `--border-hairline` + `--shadow-glass-sm`. Hover on interactive cards: `--shadow-glass-md` and subtle border tint (`--border-accent-subtle`).
* **Status Badges:** `26px–28px` height, `9999px` radius, `0 10px` padding, `12px` SemiBold text, `14px` leading icon, using `--status-neutral-ok`, `--status-attention`, or `--status-unverified` tokens.

### 13.6 Tooltips, Dialogs & Drawers
* **Tooltips:** Max-width `280px`, `12px` radius, `10px 12px` padding, `#161A18` fill with `#FAF8F4` `12px` text (or crisp glass popover), `150ms` fade-in.
* **Dialogs (Modals):** Max-width `520px`, `24px` radius, `24px` padding, `--bg-surface-elevated` / high-opacity glass (`0.94`), `--shadow-glass-lg`, over `--glass-overlay` backdrop.
* **Drawers (Slide-over / Mobile Nav):** Width `320px` on desktop/tablet or full-width/bottom-sheet on mobile, `20px` corner radius on exposed edges, `--shadow-glass-lg`.

### 13.7 Charts & Tables
* **Charts:** Clean gridlines (`rgba(22, 26, 24, 0.06)`), `12px` tabular axis labels (`#6E7771`), interactive hover crosshair + tooltip card, and large tap targets (`≥36px` interactive hit radius) on tip markers.
* **Tables:** `14px` header (`#4A524D` SemiBold, uppercase `11px`–`12px` tracking), `14px` body cells (`#161A18` / `#4A524D` with `tabular-nums` for numbers/dates), `1px` row dividers (`--border-hairline`), horizontal scroll wrapper on small screens (`overflow-x: auto`).

### 13.8 Media Upload Dropzone, Media Cards, Loading, Empty, Error & Toast States
* **Media Upload Dropzone:** Dashed `1.5px` `--border-hairline` container (`16px` radius, `--glass-card-subtle`), accepting photos (`.jpeg`, `.png`, `.webp`) and short videos (`.mp4`, `.webm`, `.mov`) via drag-and-drop or file picker, showing an in-memory thumbnail/video preview, clear/remove button, and `"Transient only · never stored"` note.
* **Media Cards:** `18px` radius, overflow hidden, bottom caption overlay, `Curated Demo` label; smooth scale/lift on desktop hover.
* **Loading States:** Smooth shimmer skeleton blocks (`--bg-canvas-secondary` to `--bg-ambient-sage` gradient sweep, `1.4s` loop) matching exact card and chart dimensions—never generic spinning clutter.
* **Empty States:** Centered glass card with a neutral Phosphor icon (`32px`, `#4A7C64`), concise explanation, and primary action button (e.g., `"Upload a photo/video, paste a tip, or pick a curated demo"`).
* **Error States:** Clear, calm diagnostic message (`14px`–`15px`) explaining what failed or why data could not be verified (`Could not verify`), plus a retry action.
* **Toast Notifications:** Bottom-right on desktop (`bottom: 24px`, `right: 24px`) or top/bottom inset on mobile; `14px` radius, `12px 16px` padding, `--glass-nav` + `--shadow-glass-md`, auto-dismissing after `4000ms` with a close button.

---

## 14. Iconography and Assets

### Strict Icon Library Rule
* **Primary Library:** Use **Phosphor Icons** (`@phosphor-icons/react`) across the entire frontend.
* **Prohibited Library:** **Do not use `lucide-react` or Lucide icons anywhere in the codebase.**
* **No Emoji UI Icons:** Do not use emoji (`📊`, `✅`, `⚠️`, `🔍`, `💬`) as interface icons, navigation items, or status markers. Emoji are permitted only inside literal quoted social-media tip text/captions when representing original creator posts.

### Icon Standards
* **Sizes:** `14px` (inside compact badges), `16px` (inline controls, inputs, table headers), `20px` (navigation, card headers, buttons), `24px` (feature highlights), `32px` (empty states).
* **Weights:** `regular` (`1.5px` stroke feel) for default UI and navigation; `duotone` or `medium` for key analytical cards and badges.
* **Color & Alignment:** Always vertically centered (`flex items-center gap-2`) and inherit text color (`currentColor`) unless intentionally tinted with `--accent-sage-primary`, `--accent-forest-deep`, or a status color.

### Custom SVG & Media Assets
* Use custom inline SVGs only for the Tip Autopsy brand emblem, the ambient animated hero stock chart, and compact sparklines/markers.
* Use curated `.jpeg` photo screenshots from `photos/` and muted looping `.mp4` video assets from `videos/` for the finfluencer media strip rather than generic placeholder boxes.

---

## 15. Animation and Motion System

Motion is restrained, physical, and purposeful—reinforcing calm analytical clarity rather than gamified excitement.

### Easing & Duration Tokens
* `--ease-out-apple`: `cubic-bezier(0.22, 1, 0.36, 1)` (primary UI transitions, card reveals, drawer slides)
* `--ease-inout-smooth`: `cubic-bezier(0.45, 0, 0.55, 1)` (continuous chart wave and ambient loops)
* `--duration-fast`: `150ms` (hover color shifts, status pill focus, micro-toggles)
* `--duration-base`: `240ms` (tab switches, accordion/ledger expansion, card hover elevation)
* `--duration-slow`: `420ms` (page/view transitions, modal and drawer entrance)

### Motion Specifications by Surface
1. **Hero Stock Chart Animation:** Continuous smooth price wave motion (`8s` loop, `--ease-inout-smooth`) with subtle vertical price breathing so the hero feels alive without distracting from the headline.
2. **Curated Finfluencer Media Strip:** Smooth looping of the curated `.mp4` clips alongside crisp `.jpeg` tip cards from `photos/` and `videos/`; horizontal carousel uses native CSS scroll snap (`scroll-behavior: smooth`).
3. **Buttons & Glass Cards:** Hover elevates subtle shadow and shifts surface opacity within `150ms–220ms` (`--ease-out-apple`). Avoid spring bounce or scale overshoot (`>1.03x`).
4. **Page & Section Transitions:** Subtle `12px` vertical translate + opacity fade (`280ms` `--ease-out-apple`) on view switch; scroll reveals trigger once (`viewport={{ once: true, amount: "some" }}`) with a gentle `16px` rise.
5. **Dashboard Charts & Skeletons:** Tip Time Machine series animates cleanly on load/update (`500ms` `--ease-out-apple`); skeleton placeholders use a smooth horizontal gradient shimmer (`1400ms` infinite).
6. **Reduced Motion (`@media (prefers-reduced-motion: reduce)`):** Immediately disables looping chart motion, shimmer loops, and non-essential transforms; transitions reduce to near-instant opacity changes (`≤50ms`).

---

## 16. Responsive Design

Tip Autopsy is designed intentionally for mobile retail investors (`375px–430px` viewports) as well as tablets (`768px–1024px`) and desktops (`1280px–1440px+`).

* **Hero Scaling:** `H1` scales fluidly from `38px` on mobile to `64px` on desktop; CTA buttons stack cleanly or sit side-by-side with `12px` gap and `44px+` height.
* **Navigation:** Floating pill header stays compact (`52px` mobile / `56px` desktop); secondary links move into a clean glass drawer below `768px`.
* **Stock Chart:** Scales fluidly across widths (`160px` height on mobile, `220px` on desktop) while keeping the price line crisp and unobstructed.
* **Finfluencer Strip:** Responsive multi-column grid on desktop (`≥1024px`); horizontal scroll carousel on tablet and mobile (`<1024px`) with `12px` card gap and clear swipe affordance.
* **Dashboard Navigation & Tables:** Left rail converts to a top horizontal strip or drawer on mobile/tablet; dense multi-column tables scroll horizontally inside a bordered container with `tabular-nums` alignment preserved.
* **Chart Touch Targets:** Tip markers on the Tip Time Machine provide generous touch/tap hit areas (`≥36px–44px` tap target) so phone users can tap exact dates accurately.
* **Mobile Glass Performance:** Mobile viewports use lighter blur radii (`blur(10px)`–`blur(12px)`) and slightly higher background opacity (`0.82–0.88`) to keep scrolling at a smooth `60fps` on mid-range Android and iOS devices.

---

## 17. Accessibility

* **Contrast:** All body text, headings, labels, and status badges must meet or exceed **WCAG 2.1 AA** contrast (`≥4.5:1` for normal text, `≥3:1` for large text and UI graphics/borders).
* **Keyboard Navigation:** All interactive elements (navigation links, buttons, tabs, inputs, chart tip markers, modal/drawer controls, Pause & Plan fields) must be reachable in logical DOM order via `Tab` / `Shift+Tab`, operable via `Enter` or `Space`, and dismissible via `Escape` for modals, drawers, and popovers.
* **Visible Focus Rings:** Never remove focus outlines without replacement. Every focusable control displays a visible ring (`2px solid #4A7C64`, `outline-offset: 2px`) on `:focus-visible`.
* **Accessible Labels & Semantics:** Use semantic landmarks (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`), explicit `<label>` associations on all form inputs and textareas, `aria-live="polite"` on dynamic analysis results/status updates, and descriptive `aria-label` attributes on icon-only controls and chart tip markers.
* **Reduced Motion:** Honor `prefers-reduced-motion: reduce` across CSS and animation libraries.

---

## 18. Performance Guidelines

* **Media Optimization:** Compress finfluencer GIF/video assets and serve appropriate formats/resolutions so initial page load stays fast on mobile cellular networks.
* **Lazy Loading:** Lazy-load below-the-fold sections, secondary media, and heavy chart modules where appropriate while keeping above-the-fold hero content immediate.
* **Responsive Media:** Serve responsive sizes (`srcset` / container-appropriate dimensions) so mobile devices do not download oversized desktop assets.
* **Backdrop Filter Discipline:** Keep `backdrop-filter` limited to key floating/glass surfaces and avoid applying expensive multi-layer blurs across large scrolling lists or dozens of simultaneous cards.
* **Animation Efficiency:** Animate GPU-composited properties (`transform`, `opacity`) rather than layout-thrashing properties (`width`, `height`, `top`, `left`) during animations.

---

## 19. Design Anti-Patterns

AI coding agents and developers must **never** introduce any of the following anti-patterns:

1. **Verdict & Recommendation Badges:** Never render `BUY`, `SELL`, `HOLD`, `STRONG BUY`, `AVOID`, or target-price callouts.
2. **Single "Trust Score" or "Risk Score":** Never collapse multiple checks into a single master score, star rating, or letter grade.
3. **Moral or Legal Accusations:** Never label an influencer or entity a `scammer`, `fraud`, or `crook`; never treat `Not found in SEBI register` as proof of fraud.
4. **Red/Green Stock Recommendation Colors:** Never use red to mean "don't buy" or green to mean "buy" on a stock.
5. **Unlabelled Synthetic or Outdated Data:** Never omit `as-of` dates on market checks or omit `Real` vs. `Synthetic / Demo` labels on tips and demo visuals.
6. **Using Lucide Icons:** Never import from `lucide-react` or use Lucide icon assets.
7. **Emoji Interface Icons:** Never use emoji in place of Phosphor icons for navigation, status badges, check titles, or buttons.
8. **Static Boxes Instead of Specified Animations:** Never replace the animated hero stock chart or looping finfluencer strip media with static mock boxes without approval.
9. **Glass Overkill:** Never wrap every micro-element or data cell in heavy blur/shadow containers that reduce legibility or slow mobile rendering.

10. **Copying Mockup Violations From `DashBoard.png`:** Never reproduce the concept mockup's `"Past Reports"` persistence label, `"Confidence Score (%)"` / `"High/Moderate/Low Risk"` trust-score pills, or mislabel static snapshot data as `"Live Market Data"`—always show `"Demo Corpus"` (in-session only), neutral evidence status pills, and accurate `"Real · Live Feed (fetched HH:MM IST)"` vs. `"Dated Market Snapshots · NSE / BSE"` provenance.
11. **Rewriting `DashBoardBackground.jsx`:** Never modify, minify, or refactor the exported Wayglim/Paper Shaders engine code inside `ui-ux/DashBoardBackground.jsx`; copy and import it verbatim.

---

## 20. AI Agent Implementation Rules

Every AI coding agent (including Gemini, Antigravity, Cursor, and Claude Code) working on the Tip Autopsy frontend must strictly follow these rules:

1. **Read `DESIGN.md` first:** Always read this file before creating or modifying any frontend UI component, page, or style token.
2. **Follow design tokens exactly:** Use the exact HEX tokens, spacing values, radii, font sizes, and animation durations defined in `DESIGN.md` (paired with `ui-ux/hero.jpeg`, `ui-ux/DashBoard.png`, and `ui-ux/DashBoardBackground.jsx` as visual references).
3. **Do not introduce new colors without updating `DESIGN.md`:** Do not invent ad-hoc HEX values or status colors outside the approved palette without updating this specification first.
4. **Do not use Lucide icons:** Always use Phosphor Icons (`@phosphor-icons/react`) for UI iconography.
5. **Do not replace specified animations with generic static placeholders:** Implement the animated hero stock chart and looping finfluencer media strip as specified.
6. **Do not introduce unnecessary UI elements:** Do not add unrequested widgets, gamification badges, leaderboards, or clutter that conflicts with the calm analytical design.
7. **Do not redesign existing layouts independently:** Preserve the hero composition, navigation pill structure, and modular dashboard layout unless explicitly instructed otherwise.
8. **Maintain consistent spacing, typography, and component behavior:** Apply `tabular-nums` to all financial numbers and dates, maintain touch target minimums (`44px`), and keep component states consistent.
9. **Preserve all product safety and financial communication restrictions:** Enforce neutral evidence terminology, `Not stated` / `Could not verify` / `Not enough tips to judge` fallbacks, data provenance labels, and the non-advisory disclaimer at all times.
10. **Test desktop, tablet, and mobile views after implementing UI changes:** Verify responsiveness, horizontal overflow, touch targets, and readability across mobile, tablet, and desktop viewports after every UI change.
11. **Update `DESIGN.md` whenever an approved design-system decision changes:** Keep this document synchronized whenever an approved token, layout, or component rule evolves.
12. **Pretend Money 10-Year Historical Allocation Sandbox (`/pretend-money`):** Use the Phosphor `Coins` icon in the left navigation rail, Forest Sage (`#1F4D3A`, `#3B8E6A`) for the 10-year stock curve and active portfolio growth line, Slate (`#4E5964`) for the same-date `NIFTY 50` benchmark curve, and Warm Ochre (`#9A5B13`) for selected entry pins, drawdown figures, and stop-loss trigger markers. Never use trading-terminal `"BUY"` / `"SELL"` buttons or gamified confetti.
13. **Glassmorphic Scrollbar System (`.glass-scroll`):** All scrollable viewports and data tables use a custom pill-shaped frosted Forest Sage thumb (`linear-gradient(180deg, rgba(74, 124, 100, 0.36), rgba(31, 77, 58, 0.48))` with a translucent white highlight border), a translucent inset track (`margin-block: 14px`) so scrollbars never clip the `24px` rounded corners of `.glass-shell`, and hidden native arrow buttons (`::-webkit-scrollbar-button { display: none }`).
14. **Progressive Web App (PWA) & 60fps Mobile Phone Standards:**
    * **Manifest & Identity (`manifest.webmanifest`):** `display: "standalone"`, `theme_color: "#FAF8F4"`, `background_color: "#FAF8F4"`, custom Tip Autopsy brand icons (`/pwa/icon.svg`, `192×192`, `512×512`, `maskable`, and `/apple-touch-icon.png`), and `viewport-fit=cover` with safe-area inset classes (`.pt-safe`, `.pb-safe`, `.px-safe`).
    * **Privacy-Safe Service Worker (`sw.js`):** Caches only the static application shell (`.html`, `.js`, `.css`, fonts, icons, and static `/media/*` demo assets). Never caches `/api/*` responses, user-uploaded photos/videos, pasted text, Pause & Plan answers, or WhatsApp subscription requests, and displays an explicit `Offline mode · Could not verify live NSE/BSE feeds` banner when offline.
    * **60fps Phone Motion & Touch Ergonomics:** Use GPU-composited `translate3d(...)`, `scale(...)`, and `opacity` with `backface-visibility: hidden`; pause canvas/SVG requestAnimationFrame loops when `document.hidden` is true; scope `:hover` card lift to `@media (hover: hover) and (pointer: fine)` so touch taps never stick; and enforce `≥44px × 44px` minimum touch targets across the bottom `StickyBubblyNav` dock, hero drawer, and workspace controls.