import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenText,
  ChartLineUp,
  Coins,
  FilmStrip,
  List,
  MagnifyingGlass,
  PlayCircle,
  Sparkle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { BrandMark } from "../../components/ui/BrandMark";
import { Button } from "../../components/ui/Button";
import { PwaStatusBanner } from "../../components/ui/PwaStatusBanner";
import { CORE_PRODUCT_RULE, MANDATORY_DISCLAIMER } from "../../lib/constants";
import {
  HeroStockBackdrop,
  HeroWaveBorderOverlay,
  HeroWaveClipDefs,
} from "./HeroStockWave";

interface HeroCreatorCard {
  id: string;
  src: string;
  alt: string;
  hasEmbeddedCaption: boolean;
  overlayCaption?: string;
  tiltClass?: string;
  animatedPortrait?: boolean;
  isGif?: boolean;
  objectPositionClass: string;
  sampleLabel: string;
}

const HERO_CREATOR_CARDS: HeroCreatorCard[] = [
  {
    id: "creator-2x-soon",
    src: "/media/hero/creator_2x_soon.jpg",
    alt: "Illustrative finfluencer portrait quoting This stock will 2x soon",
    hasEmbeddedCaption: false,
    overlayCaption: "This stock will 2x soon! 🔥",
    tiltClass: "-rotate-[4deg]",
    animatedPortrait: false,
    isGif: false,
    objectPositionClass: "object-[50%_25%]",
    sampleLabel: "Hype claim: 2x return promise",
  },
  {
    id: "creator-multibagger",
    src: "/media/hero/claude.gif",
    alt: "Illustrative finfluencer clip quoting 10x multibagger claim",
    hasEmbeddedCaption: true,
    isGif: true,
    objectPositionClass: "object-[50%_18%]",
    sampleLabel: "Hype claim: 10x multibagger",
  },
  {
    id: "creator-buy-now",
    src: "/media/hero/Gemini_Generated_Gif_rizow1rizow1rizo-watermark-removed.gif",
    alt: "Illustrative finfluencer clip quoting Buy now urgency prompt",
    hasEmbeddedCaption: true,
    isGif: true,
    objectPositionClass: "object-[50%_18%]",
    sampleLabel: "Urgency prompt: Buy now?",
  },
  {
    id: "creator-big-opportunity",
    src: "/media/hero/Gemini_Generated_Gif_9ll7po9ll7po9ll7-watermark-removed.gif",
    alt: "Illustrative finfluencer clip quoting Big opportunity claim",
    hasEmbeddedCaption: true,
    isGif: true,
    objectPositionClass: "object-[50%_18%]",
    sampleLabel: "Promotional claim: Big opportunity",
  },
  {
    id: "creator-dont-miss-out",
    src: "/media/hero/creator_dont_miss_out.jpg",
    alt: "Illustrative finfluencer portrait quoting Don't miss out urgency claim",
    hasEmbeddedCaption: false,
    overlayCaption: "Don't miss out! 📈",
    tiltClass: "rotate-[5deg]",
    animatedPortrait: false,
    isGif: false,
    objectPositionClass: "object-[50%_18%]",
    sampleLabel: "FOMO claim: Don't miss out",
  },
];

export function HeroPage() {
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#FAF8F4] text-[#161A18]">
      <a
        href="#hero-primary-cta"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-[#161A18] focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-[#FAF8F4]"
      >
        Skip to main content
      </a>

      {/* Single-viewport Hero Composition: floating pill nav + header cleanly above interactive candlesticks + wave-clipped strip */}
      <section
        ref={heroSectionRef}
        aria-label="Tip Autopsy hero"
        className="pt-safe pb-safe relative isolate flex h-full w-full flex-col justify-between overflow-hidden"
        style={{
          background:
            "radial-gradient(62% 58% at 14% 28%, rgba(212, 232, 222, 0.78) 0%, rgba(250, 248, 244, 0) 70%), radial-gradient(54% 52% at 86% 18%, rgba(220, 236, 228, 0.65) 0%, rgba(250, 248, 244, 0) 68%), #FAF8F4",
        }}
      >
        <HeroWaveClipDefs />
        <HeroStockBackdrop interactionTargetRef={heroSectionRef} />

        {/* DESIGN.md §8.1 & §8.2 Floating Pill Navigation Bar (52px mobile / 56px desktop) */}
        <header className="relative z-30 mx-auto mt-2.5 flex w-[calc(100%-24px)] max-w-[1040px] shrink-0 flex-col items-center sm:mt-4 sm:w-[calc(100%-32px)]">
          <nav
            aria-label="Primary navigation"
            className="glass-nav flex h-[52px] w-full items-center justify-between rounded-full pr-2 pl-4 sm:h-[56px] sm:pr-2.5 sm:pl-5"
          >
            <Link
              to="/"
              aria-label="Tip Autopsy Home"
              className="inline-flex min-h-[44px] items-center rounded-full"
            >
              <BrandMark />
            </Link>

            {/* Desktop Center Links (≥768px) */}
            <div className="hidden items-center gap-1 md:flex">
              <Link
                to="/analyze"
                className="inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[14px] font-medium text-[#4A524D] transition-colors hover:bg-white/60 hover:text-[#161A18]"
              >
                Analyze
              </Link>
              <Link
                to="/stocks"
                className="inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[14px] font-medium text-[#4A524D] transition-colors hover:bg-white/60 hover:text-[#161A18]"
              >
                Live Stocks
              </Link>
              <Link
                to="/pretend-money"
                className="inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[14px] font-medium text-[#4A524D] transition-colors hover:bg-white/60 hover:text-[#161A18]"
              >
                10Y Sandbox
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[14px] font-medium text-[#4A524D] transition-colors hover:bg-white/60 hover:text-[#161A18]"
              >
                How It Works
              </Link>
              <Link
                to="/corpus"
                className="inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[14px] font-medium text-[#4A524D] transition-colors hover:bg-white/60 hover:text-[#161A18]"
              >
                Evidence
              </Link>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="hidden sm:block">
                <PwaStatusBanner compact />
              </div>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="inline-flex h-[40px] cursor-pointer items-center gap-1.5 rounded-full bg-[#161A18] px-4 text-[13.5px] font-semibold text-[#FAF8F4] shadow-sm transition-all hover:bg-[#29302C] sm:px-5 sm:text-[14px]"
              >
                <span>Get Started</span>
                <ArrowRight size={14} weight="bold" aria-hidden="true" />
              </button>

              {/* Mobile 44x44 Drawer Trigger Button (<768px per DESIGN.md §8.2) */}
              <button
                type="button"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="inline-flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-full text-[#161A18] transition-colors hover:bg-white/70 md:hidden"
              >
                {mobileMenuOpen ? (
                  <X size={20} weight="bold" aria-hidden="true" />
                ) : (
                  <List size={20} weight="bold" aria-hidden="true" />
                )}
              </button>
            </div>
          </nav>

          {/* Mobile Liquid Glass Drawer (<768px) */}
          {mobileMenuOpen && (
            <div
              role="dialog"
              aria-label="Mobile navigation menu"
              className="mt-2 w-full rounded-[20px] border border-[rgba(22,26,24,0.09)] bg-white/95 p-3 shadow-[0_20px_48px_rgba(22,26,24,0.16)] backdrop-blur-lg md:hidden"
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/analyze");
                  }}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FAF8F4] px-3 py-2 text-left text-[13.5px] font-semibold text-[#161A18]"
                >
                  <MagnifyingGlass size={17} weight="duotone" className="text-[#1F4D3A]" />
                  <span>Analyze Tip</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/stocks");
                  }}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FAF8F4] px-3 py-2 text-left text-[13.5px] font-semibold text-[#161A18]"
                >
                  <ChartLineUp size={17} weight="duotone" className="text-[#1F4D3A]" />
                  <span>Live Stocks</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/pretend-money");
                  }}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FAF8F4] px-3 py-2 text-left text-[13.5px] font-semibold text-[#161A18]"
                >
                  <Coins size={17} weight="duotone" className="text-[#9A5B13]" />
                  <span>Pretend Money</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/finfluencers");
                  }}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FAF8F4] px-3 py-2 text-left text-[13.5px] font-semibold text-[#161A18]"
                >
                  <UsersThree size={17} weight="duotone" className="text-[#1F4D3A]" />
                  <span>Finfluencers</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/corpus");
                  }}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FAF8F4] px-3 py-2 text-left text-[13.5px] font-semibold text-[#161A18]"
                >
                  <FilmStrip size={17} weight="duotone" className="text-[#1F4D3A]" />
                  <span>Demo Corpus</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/how-it-works");
                  }}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FAF8F4] px-3 py-2 text-left text-[13.5px] font-semibold text-[#161A18]"
                >
                  <BookOpenText size={17} weight="duotone" className="text-[#1F4D3A]" />
                  <span>How Checks Work</span>
                </button>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-[rgba(22,26,24,0.08)] pt-2">
                <span className="text-[11.5px] font-medium text-[#4A524D]">{CORE_PRODUCT_RULE}</span>
                <PwaStatusBanner compact />
              </div>
            </div>
          )}
        </header>

        {/* Centered Editorial Hero Copy Block — DESIGN.md §9 */}
        <main className="relative z-20 mx-auto flex w-full max-w-[760px] shrink-0 flex-col items-center px-4 pt-2 pb-1 text-center sm:pt-4 lg:pt-5">
          <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[rgba(74,124,100,0.25)] bg-[#E6F2EC]/90 px-3 py-1 text-[11.5px] font-semibold tracking-[0.02em] text-[#1F4D3A] sm:text-[12px]">
            <Sparkle size={13} weight="duotone" aria-hidden="true" />
            <span>Signal vs. Noise for Retail Investors</span>
          </div>

          <h1
            className="m-0 text-[38px] leading-[1.08] font-bold tracking-[-0.03em] text-[#161A18] sm:text-[52px] lg:text-[64px]"
            style={{
              fontFamily: "'Playfair Display', 'Instrument Serif', 'Newsreader', Georgia, serif",
            }}
          >
            Think Before You{" "}
            <span
              className="italic font-normal text-[#4A7C64]"
              style={{
                fontFamily: "'Instrument Serif', 'Newsreader', 'Playfair Display', Georgia, serif",
              }}
            >
              Trust.
            </span>
          </h1>

          <p className="mt-2.5 max-w-[560px] text-[15px] leading-[1.52] text-[#4A524D] sm:mt-3 sm:text-[17px]">
            Dissect any stock tip. Check SEBI registration snapshots, pre-tip price/volume signals,
            Hinglish hype, and benchmark-adjusted track records—evidence, never buy/sell advice.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2.5 sm:mt-4 sm:gap-3">
            <Button
              id="hero-primary-cta"
              size="lg"
              className="min-h-[46px] rounded-full bg-[#161A18] px-7 py-3 text-[14.5px] font-semibold text-[#FAF8F4] shadow-md transition-all hover:bg-[#29302C] sm:min-h-[48px] sm:px-8 sm:text-[15px]"
              onClick={() => navigate("/dashboard")}
            >
              <span>Analyze a Tip</span>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="min-h-[46px] rounded-full px-5 py-3 text-[14px] font-semibold sm:min-h-[48px] sm:px-6"
              onClick={() => navigate("/how-it-works")}
            >
              <PlayCircle size={18} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />
              <span>See How It Works</span>
            </Button>
          </div>
        </main>

        {/* Lower Wave-Clipped 5-Card Finfluencer Strip sitting below the animated candlestick showcase */}
        <div className="relative z-20 flex min-h-0 w-full flex-1 flex-col justify-end">
          {/* Discreet Provenance Caption for Demo Market Curve & Curated Strip (DESIGN.md §9.3, §10, §11) */}
          <div className="pointer-events-none mx-auto mb-1 flex w-full max-w-[1280px] items-center justify-between px-4 text-[11px] font-medium text-[#6E7771]">
            <span>Demo Market Visual · Real NSE/BSE data in analyzer</span>
            <span className="rounded-full bg-white/75 px-2.5 py-0.5 text-[#4A524D] backdrop-blur-sm">
              Curated Demo Corpus · Tap card to inspect
            </span>
          </div>

          {/* Desktop (lg+): Full-bleed 5-panel wave-clipped strip */}
          <div className="relative hidden h-[47vh] min-h-[290px] max-h-[440px] w-full lg:block">
            <div
              className="grid h-full w-full grid-cols-5 gap-[4px] bg-white/95"
              style={{ clipPath: "url(#hero-wave-strip-clip)" }}
            >
              {HERO_CREATOR_CARDS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  aria-label={`Inspect example tip in Tip Autopsy analyzer: ${card.sampleLabel}`}
                  className="group relative h-full w-full cursor-pointer overflow-hidden bg-[#161A18] text-left focus-visible:outline-offset-[-3px]"
                >
                  <img
                    src={card.src}
                    alt={card.alt}
                    loading="eager"
                    decoding="async"
                    className={`h-full w-full object-cover ${card.objectPositionClass} transition-transform duration-300 group-hover:scale-[1.04]`}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#3B8E6A]/18 to-transparent"
                    aria-hidden="true"
                  />
                  {!card.hasEmbeddedCaption && card.overlayCaption && (
                    <span
                      className={`pointer-events-none absolute inset-x-3 bottom-6 flex justify-center ${card.tiltClass ?? ""}`}
                    >
                      <span className="rounded-xl border border-white/85 bg-[rgba(255,255,255,0.93)] px-3 py-1.5 text-center text-[14px] leading-snug font-bold tracking-[-0.015em] text-[#161A18] shadow-[0_10px_24px_rgba(22,26,24,0.18)] backdrop-blur-md xl:text-[15px]">
                        {card.overlayCaption}
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>
            <HeroWaveBorderOverlay />
          </div>

          {/* Mobile & Tablet (<lg): Smooth 60fps horizontal scroll-snap carousel constrained to viewport */}
          <div className="flex min-h-0 flex-1 items-end px-3.5 pb-2.5 sm:px-4 sm:pb-3 lg:hidden">
            <div className="no-scrollbar-mobile flex h-full max-h-[250px] w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:max-h-[285px]">
              {HERO_CREATOR_CARDS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  aria-label={`Inspect example tip in Tip Autopsy analyzer: ${card.sampleLabel}`}
                  className="relative h-full aspect-[3/4] shrink-0 snap-center overflow-hidden rounded-[18px] border border-white/80 bg-[#161A18] shadow-[0_8px_24px_rgba(22,26,24,0.08)] active:scale-[0.98]"
                >
                  <img
                    src={card.src}
                    alt={card.alt}
                    loading="eager"
                    decoding="async"
                    className={`h-full w-full object-cover ${card.objectPositionClass}`}
                  />
                  {!card.hasEmbeddedCaption && card.overlayCaption && (
                    <span
                      className={`pointer-events-none absolute inset-x-2.5 bottom-3.5 flex justify-center ${card.tiltClass ?? ""}`}
                    >
                      <span className="rounded-xl border border-white/85 bg-[rgba(255,255,255,0.93)] px-2.5 py-1 text-center text-[12px] font-bold text-[#161A18] shadow-md backdrop-blur-md">
                        {card.overlayCaption}
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Visually hidden for clean edge-to-edge UI, preserved in DOM for accessibility & compliance */}
          <footer className="sr-only">
            <span>
              <strong>{CORE_PRODUCT_RULE}</strong> {MANDATORY_DISCLAIMER}
            </span>
          </footer>
        </div>
      </section>
    </div>
  );
}
