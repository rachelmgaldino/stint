// Icons for the floating timer's buttons, shared by the bubble and the pill.

export const PinIcon = ({ on }: { on: boolean }) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill={on ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z" />
    <path d="M12 14v6" fill="none" />
  </svg>
);

export const OpenIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 5h5v5M19 5l-8 8" />
    <path d="M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />
  </svg>
);

export const StopIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />
  </svg>
);
