import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ShieldCheck } from "@phosphor-icons/react";
import DashBoardBackground from "../components/DashBoardBackground";
import { StickyBubblyNav } from "../components/StickyBubblyNav";
import { BrandMark } from "../components/ui/BrandMark";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";
import { PwaStatusBanner } from "../components/ui/PwaStatusBanner";
import { CORE_PRODUCT_RULE } from "../lib/constants";

export function DashboardLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  // Reset scroll position to top cleanly when switching routes so entrance animations play in view
  useEffect(() => {
    if (mainRef.current && typeof mainRef.current.scrollTo === "function") {
      mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname]);

  return (
    <div className="pt-safe pb-safe px-safe relative isolate flex h-[100dvh] w-full flex-col gap-1.5 overflow-hidden bg-[#F3EFE7] px-2 pt-2 pb-1.5 sm:gap-2.5 sm:px-4 sm:pt-3.5 sm:pb-2.5 lg:px-5 lg:pt-4 lg:pb-3">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-[#161A18] focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-[#FAF8F4]"
      >
        Skip to main content
      </a>
      {/* Verbatim Wayglim WebGL2 animated gradient background from ui-ux/DashBoardBackground.jsx */}
      <DashBoardBackground />

      {/* Full-Width Single-Window Frosted Glass Dashboard Shell (flex-1 adjusts height automatically) */}
      <div className="glass-shell relative z-10 mx-auto flex min-h-0 w-full max-w-[1380px] flex-1 flex-col overflow-hidden rounded-[20px] sm:rounded-[24px]">
        {/* Top PWA & Brand Header Strip */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[rgba(22,26,24,0.07)] bg-white/55 px-3.5 py-2 sm:px-5 lg:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label="Tip Autopsy Home"
              className="inline-flex min-h-[36px] items-center rounded-xl focus-visible:outline-offset-2"
            >
              <BrandMark />
            </Link>
            <span className="hidden rounded-full border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4]/90 px-2.5 py-0.5 text-[11.5px] font-medium text-[#4A524D] md:inline-flex">
              No login · No personal data saved
            </span>
          </div>
          <PwaStatusBanner compact />
        </header>

        {/* Fluid Main Column: internal scrolling content area + pinned compact disclaimer */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <main
            ref={mainRef}
            id="main-content"
            tabIndex={-1}
            className="glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-5 lg:p-6"
          >
            <div key={location.pathname} className="page-transition-stage">
              <Outlet />
            </div>
          </main>

          <div className="flex shrink-0 flex-col gap-1.5 border-t border-[rgba(22,26,24,0.08)] bg-[rgba(250,248,244,0.78)] px-3.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-5 sm:py-2.5 lg:px-6">
            <div className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-[rgba(22,26,24,0.08)] bg-white/85 px-2.5 py-0.5 text-[11.5px] font-medium text-[#161A18] sm:self-auto sm:px-3 sm:py-1 sm:text-[12px]">
              <ShieldCheck size={15} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />
              <span>{CORE_PRODUCT_RULE}</span>
            </div>
            <DisclaimerBanner />
          </div>
        </div>
      </div>

      {/* Dedicated Bottom Row Below the Main Dashboard for Sticky Bubbly Notch Dock */}
      <StickyBubblyNav />
    </div>
  );
}
