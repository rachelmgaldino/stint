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

export const BellIcon = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
);

export const HourglassIcon = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M7 3h10M7 21h10" />
    <path d="M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9s8 5 8 9" />
  </svg>
);

export const SparkIcon = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
  </svg>
);

export const SunMoonIcon = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />
  </svg>
);

export const TagIcon = () => (
  <svg {...base} strokeWidth={2.2}>
    <path d="M3 12V4h8l10 10-8 8L3 12z" />
    <circle cx="8" cy="9" r="1.6" />
  </svg>
);

export const XIcon = () => (
  <svg {...base} width={16} height={16} strokeWidth={2.6}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const GlobeIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
  </svg>
);

export const GripIcon = () => (
  <svg {...base} width={16} height={16} fill="currentColor" stroke="none">
    {[7, 12, 17].map((y) => (
      <g key={y}>
        <circle cx="9" cy={y} r="1.7" />
        <circle cx="15" cy={y} r="1.7" />
      </g>
    ))}
  </svg>
);

export const ChevronUpIcon = () => (
  <svg {...base} width={14} height={14} strokeWidth={2.8}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);

export const ChevronDownIcon = () => (
  <svg {...base} width={14} height={14} strokeWidth={2.8}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const DownloadIcon = () => (
  <svg {...base} width={16} height={16}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

export const CopyIcon = () => (
  <svg {...base} width={16} height={16}>
    <rect x="8" y="8" width="12" height="12" rx="3" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);

export const PencilIcon = () => (
  <svg {...base} width={14} height={14}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);
