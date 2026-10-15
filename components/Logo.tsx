// Die drei Taktstriche aus dem Markenkonzept – als eigenständiges Zeichen
// (ohne Schriftzug) genauso nutzbar wie neben dem Maestoso-Lettering.
// Nutzt zwei Farben: currentColor für die auffälligen Striche, der Rest in
// der jeweils umgebenden Hintergrundfarbe (per CSS-Variable gesetzt, siehe
// Verwendung in Sidebar/AppHeader) – daher kein einfaches einfarbiges Icon.
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="3" width="4" height="18" rx="2" fill="currentColor" />
      <rect x="8" y="7" width="4" height="14" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="14" y="1" width="4" height="20" rx="2" fill="currentColor" />
      <rect x="20" y="9" width="2.4" height="12" rx="1.2" fill="currentColor" opacity="0.35" />
    </svg>
  )
}
