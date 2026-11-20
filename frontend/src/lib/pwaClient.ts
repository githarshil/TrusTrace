import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of promptListeners) {
    listener();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyListeners();
  });
}

export function registerPwaServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // Skip Service Worker registration inside jsdom/unit tests
  if (typeof navigator.userAgent === "string" && /jsdom/i.test(navigator.userAgent)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Service worker registration is progressive enhancement; never block UI on failure
    });
  });
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mediaMatch =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return mediaMatch || iosStandalone;
}

function detectIosSafari(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isNotCriOS = !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIos && isWebkit && isNotCriOS;
}

export interface PwaStatus {
  isOnline: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  isIosSafari: boolean;
  promptInstall: () => Promise<boolean>;
}

export function usePwaStatus(): PwaStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" && "onLine" in navigator ? navigator.onLine : true
  );
  const [isStandalone, setIsStandalone] = useState<boolean>(() => detectStandalone());
  const [canInstall, setCanInstall] = useState<boolean>(() => deferredPrompt !== null);
  const [isIosSafari] = useState<boolean>(() => detectIosSafari());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handlePromptChange = () => {
      setCanInstall(deferredPrompt !== null);
      setIsStandalone(detectStandalone());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    promptListeners.add(handlePromptChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      promptListeners.delete(handlePromptChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        deferredPrompt = null;
        notifyListeners();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  return {
    isOnline,
    isStandalone,
    canInstall,
    isIosSafari,
    promptInstall,
  };
}
