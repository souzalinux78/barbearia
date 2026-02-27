import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles/index.css";
import { ThemeProvider } from "./contexts/theme.context";

const dismissSplash = () => {
  const splash = document.getElementById("app-splash");
  if (!splash) {
    return;
  }
  splash.classList.add("app-splash--hide");
  window.setTimeout(() => {
    splash.remove();
  }, 420);
};

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => {
    void updateSW(true);
  },
  onOfflineReady: () => {
    dismissSplash();
  },
  onRegisteredSW: (_scriptUrl, registration) => {
    if (!registration) {
      return;
    }
    window.setInterval(() => {
      void registration.update();
    }, 60 * 60 * 1000);
  },
  onRegisterError: () => {
    dismissSplash();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    const payload = event.data as { type?: string; route?: string } | undefined;
    if (payload?.type !== "PUSH_NAVIGATE") {
      return;
    }
    const route = String(payload.route ?? "/dashboard");
    if (route.startsWith("/")) {
      window.location.assign(route);
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);

window.setTimeout(() => {
  dismissSplash();
}, 900);
