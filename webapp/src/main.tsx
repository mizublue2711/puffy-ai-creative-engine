import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { LanguageProvider } from "./i18n/LanguageContext";

function mountApp() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    console.error("Root element #root not found; aborting mount.");
    return;
  }
  createRoot(rootEl).render(
    <StrictMode>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </StrictMode>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountApp, { once: true });
} else {
  mountApp();
}

