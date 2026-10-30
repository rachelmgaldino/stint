import { useEffect, useState } from "react";
import { CopyIcon } from "./icons";
import { t } from "../i18n";
import { copyText } from "../platform";

/** A small Copy button that says Copied for a moment. */
export function CopyButton({ title, text }: { title: string; text(): string }) {
  const words = t().report;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <button
      type="button"
      className="export-button small"
      title={title}
      aria-label={title}
      onClick={async () => {
        await copyText(text());
        setCopied(true);
      }}
    >
      <CopyIcon />
      {copied ? words.copied : words.copy}
    </button>
  );
}
