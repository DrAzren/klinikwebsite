import Image from "next/image";

/**
 * Brand mark. Uses the official logo when one is configured in
 * Staff Portal → Content → Clinic details (logoUrl). Otherwise renders a
 * typographic wordmark with an abstract "two circles" mark: body (solid)
 * and mind (ring), overlapping — the clinic's physical + mental health idea.
 */
export function Logo({ logoUrl, tone = "dark", className = "" }: { logoUrl?: string; tone?: "dark" | "light"; className?: string }) {
  if (logoUrl) {
    return <Image src={logoUrl} alt="Klinik Nissa" width={160} height={40} className={`h-9 w-auto ${className}`} priority />;
  }
  const ink = tone === "light" ? "#F8FAFC" : "#0B1F3A";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Klinik Nissa">
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="kn-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2FD0C9" />
            <stop offset="1" stopColor="#00958F" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="20" r="10" fill="url(#kn-g)" />
        <circle cx="24" cy="20" r="10" fill="none" stroke={ink} strokeWidth="2.2" opacity="0.92" />
        <path d="M16 15.5v9M11.5 20h9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="leading-none">
        <span className="block text-[1.15rem] font-semibold tracking-tight" style={{ color: ink }}>
          Klinik Nissa
        </span>
        <span className="mt-1 block text-[0.62rem] font-medium uppercase tracking-[0.22em]" style={{ color: tone === "light" ? "#9DB3CC" : "#5B6B82" }}>
          GP · Mental Health
        </span>
      </span>
    </span>
  );
}
