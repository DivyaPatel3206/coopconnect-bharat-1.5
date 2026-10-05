/** Brand logo: a "C" ring of members around a shared hub (cooperation), in indigo and saffron. */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} role="img" aria-label="CoopConnect Bharat logo">
      <rect width="48" height="48" rx="12" fill="#1B3A5C" />
      <path d="M34.5 15.5A13 13 0 1 0 34.5 32.5" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="4.6" fill="#E08A28" />
      <circle cx="34.5" cy="15.5" r="2.6" fill="#E08A28" />
      <circle cx="34.5" cy="32.5" r="2.6" fill="#E08A28" />
    </svg>
  );
}

export default function Logo({ size = 36, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="leading-none">
        <span className="block font-display text-xl font-semibold tracking-tight text-indigo">
          CoopConnect <span className="text-coop-saffron">Bharat</span>
        </span>
        {tagline && <span className="block mt-1 text-[10px] tracking-[0.18em] text-coop-slate uppercase">Learn · Certify · Connect · Grow</span>}
      </span>
    </span>
  );
}
