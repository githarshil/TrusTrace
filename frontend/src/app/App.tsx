import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HeroPage } from "../features/hero/HeroPage";
import { AutopsyProvider } from "../features/workflow/AutopsyContext";

// Code-split workspace routes so initial Hero load stays fast on mobile networks (Task 3.2)
const DashboardLayout = lazy(() =>
  import("./DashboardLayout").then((m) => ({ default: m.DashboardLayout }))
);
const DashboardOverviewPage = lazy(() =>
  import("../features/dashboard/DashboardOverviewPage").then((m) => ({
    default: m.DashboardOverviewPage,
  }))
);
const AnalyzeWorkspacePage = lazy(() =>
  import("../features/analyze/AnalyzeWorkspacePage").then((m) => ({
    default: m.AnalyzeWorkspacePage,
  }))
);
const RealTimeStocksPage = lazy(() =>
  import("../features/stocks/RealTimeStocksPage").then((m) => ({
    default: m.RealTimeStocksPage,
  }))
);
const PretendMoneyPage = lazy(() =>
  import("../features/pretend-money/PretendMoneyPage").then((m) => ({
    default: m.PretendMoneyPage,
  }))
);
const FinfluencersPage = lazy(() =>
  import("../features/finfluencers/FinfluencersPage").then((m) => ({
    default: m.FinfluencersPage,
  }))
);
const SocialIntelligencePage = lazy(() =>
  import("../features/social-intelligence/SocialIntelligencePage").then((m) => ({
    default: m.SocialIntelligencePage,
  }))
);
const DemoCorpusPage = lazy(() =>
  import("../features/dashboard/WorkspacePlaceholderPages").then((m) => ({
    default: m.DemoCorpusPage,
  }))
);
const HowChecksWorkPage = lazy(() =>
  import("../features/dashboard/WorkspacePlaceholderPages").then((m) => ({
    default: m.HowChecksWorkPage,
  }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-[#FAF8F4] p-6"
    >
      <div className="w-full max-w-[420px] space-y-3 rounded-2xl border border-[rgba(22,26,24,0.08)] bg-white/80 p-6">
        <div className="skeleton-shimmer h-5 w-40 rounded-lg" />
        <div className="skeleton-shimmer h-24 w-full rounded-xl" />
        <span className="sr-only">Loading Tip Autopsy workspace...</span>
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<HeroPage />} />
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardOverviewPage />} />
          <Route path="/analyze" element={<AnalyzeWorkspacePage />} />
          <Route path="/stocks" element={<RealTimeStocksPage />} />
          <Route path="/pretend-money" element={<PretendMoneyPage />} />
          <Route path="/finfluencers" element={<FinfluencersPage />} />
          <Route path="/social-intelligence" element={<SocialIntelligencePage />} />
          <Route path="/corpus" element={<DemoCorpusPage />} />
          <Route path="/how-it-works" element={<HowChecksWorkPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AutopsyProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AutopsyProvider>
    </QueryClientProvider>
  );
}

export default App;
