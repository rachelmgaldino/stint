import { demoText, resetDemo } from "../demo";
import type { Language } from "../i18n";
import "./DemoBanner.css";

/** Says the sessions are made up, and lets a visitor start over from the sample data. */
export function DemoBanner({ language }: { language: Language }) {
  const text = demoText[language] ?? demoText.en;
  return (
    <div className="demo-banner" role="note">
      <span>
        <b>{text.label}</b> {text.note}
      </span>
      <button type="button" onClick={() => window.confirm(text.confirm) && resetDemo()}>
        {text.reset}
      </button>
    </div>
  );
}
