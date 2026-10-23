import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/shantell-sans/full.css";
import "@fontsource-variable/lexend";
import "@fontsource-variable/syne";
import "@fontsource-variable/space-grotesk";
import App from "./App";
import { FloatTimer } from "./components/FloatTimer";
import { FloatPreview } from "./components/FloatPreview";
import { isFloatWindow } from "./float";
import { startFitting } from "./fit";
import "./styles.css";
import "./mochi.css";
import "./phone.css";
import "./notebook.css";
import "./riso.css";

const float = isFloatWindow();
// A browser-only look at the bubble in every state, for screenshots.
const preview = import.meta.env.DEV && new URLSearchParams(location.search).has("float");
if (!float && !preview) startFitting();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {float ? <FloatTimer /> : preview ? <FloatPreview /> : <App />}
  </StrictMode>,
);
