import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BasedProvider } from "@weirdscience/based-client";
import { based, ensureServiceSession } from "./lib/based.js";
import "./index.css";
import App from "./App.jsx";

ensureServiceSession();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BasedProvider client={based}>
      <App />
    </BasedProvider>
  </StrictMode>
);
