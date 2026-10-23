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
import "@fontsource/instrument-serif";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/dm-sans";
import { MascotSheet } from "./components/MascotSheet";
import App from "./App";
import { FloatTimer } from "./components/FloatTimer";
import { FloatPreview } from "./components/FloatPreview";
import { isFloatWindow } from "./float";
import { startFitting } from "./fit";
import "./styles.css";
import "./mochi.css";
import "./phone.css";
import "./looks-proto.css";

const float = isFloatWindow();
// A browser-only look at the bubble in every state, for screenshots.
const preview = import.meta.env.DEV && new URLSearchParams(location.search).has("float");
const sheet = import.meta.env.DEV && new URLSearchParams(location.search).has("mascots");
if (!float && !preview && !sheet) startFitting();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {float ? <FloatTimer /> : preview ? <FloatPreview /> : sheet ? <MascotSheet /> : <App />}
  </StrictMode>,
);
