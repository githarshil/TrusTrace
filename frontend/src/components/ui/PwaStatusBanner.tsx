import { useState } from "react";
import {
  DeviceMobile,
  DownloadSimple,
  ShareNetwork,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import { usePwaStatus } from "../../lib/pwaClient";

export interface PwaStatusBannerProps {
  compact?: boolean;
}

export function PwaStatusBanner({ compact = false }: PwaStatusBannerProps) {
  const { isOnline, isStandalone, canInstall, isIosSafari, promptInstall } = usePwaStatus();
  const [dismissedInstall, setDismissedInstall] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  const showInstallButton = !isStandalone && !dismissedInstall && (canInstall || isIosSafari);

  if (isOnline && !showInstallButton && !showIosGuide) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Offline Provenance Alert — Never mislabels cached shell as live market data */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          data-testid="pwa-offline-banner"
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(78,89,100,0.22)] bg-[#EEF1F4] px-3 py-1.5 text-[12px] font-medium text-[#4E5964]"
        >
          <WifiSlash size={15} weight="duotone" className="shrink-0 text-[#4E5964]" aria-hidden="true" />
          <span>
            {compact
              ? "Offline · Live feeds paused"
              : "Offline mode · Could not verify live NSE/BSE feeds. Reconnect to refresh live data."}
          </span>
        </div>
      )}

      {/* Install App Pill (Android / Chrome / Desktop PWA or iOS Add-to-Home-Screen guide) */}
      {showInstallButton && (
        <div className="relative inline-flex items-center gap-1 rounded-full border border-[rgba(74,124,100,0.28)] bg-[#E6F2EC]/90 p-0.5 pl-2.5 text-[12px] font-semibold text-[#1F4D3A] shadow-[0_2px_10px_rgba(22,26,24,0.05)]">
          <button
            type="button"
            data-testid="pwa-install-btn"
            onClick={() => {
              if (canInstall) {
                void promptInstall();
              } else {
                setShowIosGuide((prev) => !prev);
              }
            }}
            className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 pr-1.5 text-[#1F4D3A] hover:text-[#123528]"
          >
            {canInstall ? (
              <DownloadSimple size={14} weight="bold" aria-hidden="true" />
            ) : (
              <DeviceMobile size={14} weight="bold" aria-hidden="true" />
            )}
            <span>Install App</span>
          </button>
          <button
            type="button"
            aria-label="Dismiss install app prompt"
            onClick={() => {
              setDismissedInstall(true);
              setShowIosGuide(false);
            }}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[#4A524D] hover:bg-white/70 hover:text-[#161A18]"
          >
            <X size={13} weight="bold" aria-hidden="true" />
          </button>

          {showIosGuide && (
            <div
              role="dialog"
              aria-label="Install Tip Autopsy on iOS"
              className=" absolute top-full right-0 z-50 mt-2 w-[260px] rounded-2xl border border-[rgba(22,26,24,0.1)] bg-white/95 p-3.5 text-left text-[12.5px] font-normal text-[#161A18] shadow-[0_16px_36px_rgba(22,26,24,0.14)] backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="m-0 font-semibold text-[#161A18]">Add Tip Autopsy to Home Screen</p>
                <button
                  type="button"
                  aria-label="Close iOS install instructions"
                  onClick={() => setShowIosGuide(false)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#4A524D] hover:bg-[#F3F0EA]"
                >
                  <X size={13} weight="bold" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1.5 mb-0 leading-relaxed text-[#4A524D]">
                In Safari, tap{" "}
                <span className="inline-flex items-center gap-1 font-semibold text-[#1F4D3A]">
                  <ShareNetwork size={13} weight="bold" aria-hidden="true" /> Share
                </span>{" "}
                and select <strong>Add to Home Screen</strong> for the full-screen standalone app.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
