// Small stroke icons drawn in the app's own style.

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const ClockIcon = () => (
  <svg {...base} width={18} height={18}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2" />
  </svg>
);

export const SlidersIcon = () => (
  <svg {...base} width={18} height={18}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);

export const CalendarIcon = () => (
  <svg {...base} strokeWidth={2.2}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const StopIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="5" width="14" height="14" rx="4" fill="currentColor" />
  </svg>
);

export const CoffeeIcon = () => (
  <svg {...base}>
    <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z" />
    <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
    <path d="M8 3v3M12 3v3" />
  </svg>
);

export const ChevronLeft = () => (
  <svg {...base} width={18} height={18}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const ChevronRight = () => (
  <svg {...base} width={18} height={18}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const PlusIcon = () => (
  <svg {...base} width={18} height={18} strokeWidth={2.8}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ChartIcon = () => (
  <svg {...base} width={18} height={18}>
    <path d="M5 20v-6M12 20V5M19 20v-10" />
  </svg>
);

export const PlayIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" />
  </svg>
);

export const PauseIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
  </svg>
);
