import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { registerPwaServiceWorker } from "./lib/pwaClient";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root container #root was not found");
}

registerPwaServiceWorker();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
