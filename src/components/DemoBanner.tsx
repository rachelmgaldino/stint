import { demoText, resetDemo } from "../demo";
import type { Language } from "../i18n";
import "./DemoBanner.css";

/** A small "Demo" pill beside the name. Hovering it tells the visitor the sessions are
 *  made up; the round arrow starts over from the sample data. */
export function DemoBanner({ language }: { language: Language }) {
  const text = demoText[language] ?? demoText.en;
  return (
    <div className="demo-banner" role="note" title={`${text.label} ${text.note}`}>
      <span>
        <b>{text.label}</b> {text.note}
      </span>
      <button type="button" title={text.reset} onClick={() => window.confirm(text.confirm) && resetDemo()}>
        {text.reset}
      </button>
    </div>
  );
}
