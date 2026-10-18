import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/manrope";
import App from "./App";
import { startFitting } from "./fit";
import "./styles.css";
import "./mochi.css";
import "./phone.css";

startFitting();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
