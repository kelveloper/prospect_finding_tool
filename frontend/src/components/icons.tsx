type IconProps = { className?: string };

const base = "h-full w-full";

export function LogoMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={className ?? base} aria-hidden>
      <rect x="1" y="1" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
      <rect x="10.5" y="1" width="6.5" height="6.5" rx="1.6" fill="currentColor" opacity="0.7" />
      <rect x="1" y="10.5" width="6.5" height="6.5" rx="1.6" fill="currentColor" opacity="0.7" />
      <rect x="10.5" y="10.5" width="6.5" height="6.5" rx="1.6" fill="currentColor" />
    </svg>
  );
}

export function ChevronLeft({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden>
      <path
        d="M10 3.5 5.5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden>
      <path
        d="M8 13V3.5M3.8 7.7 8 3.5l4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7v4M8 4.9v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden>
      <path
        d="M2 13.5h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="3" y="8" width="2.6" height="4" rx="0.8" fill="currentColor" />
      <rect x="6.7" y="5" width="2.6" height="7" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x="10.4" y="2.5" width="2.6" height="9.5" rx="0.8" fill="currentColor" />
    </svg>
  );
}

export function ShuffleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden>
      <path
        d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9M2.5 8a5.5 5.5 0 0 1 9.4-3.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11.6 1.9v2.6h-2.6M4.4 14.1v-2.6h2.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden>
      <path
        d="M8 14.5s5-4.2 5-7.6a5 5 0 0 0-10 0c0 3.4 5 7.6 5 7.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="6.8" r="1.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden>
      <path
        d="M5.2 2.4 6.6 5 5.3 6.4a8.4 8.4 0 0 0 4.3 4.3L11 9.4l2.6 1.4v2.2c0 .6-.5 1-1.1 1A11.5 11.5 0 0 1 2 3.5c0-.6.4-1.1 1-1.1h2.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden>
      <rect x="1.8" y="3.4" width="12.4" height="9.2" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="m2.4 4.6 5.6 4 5.6-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.8 8h12.4M8 1.8c1.7 1.8 2.6 4 2.6 6.2S9.7 12.4 8 14.2C6.3 12.4 5.4 10.2 5.4 8S6.3 3.6 8 1.8Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? base} aria-hidden>
      <rect x="1.8" y="1.8" width="12.4" height="12.4" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5 6.8v4.4M5 4.9v.1M8 11.2V6.8M8 8.6c0-1 .7-1.8 1.6-1.8s1.5.8 1.5 1.8v2.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const CONTACT_ICONS = {
  phone: PhoneIcon,
  pin: PinIcon,
  mail: MailIcon,
  globe: GlobeIcon,
  linkedin: LinkedInIcon,
} as const;
