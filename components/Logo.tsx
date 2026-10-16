import { useId } from 'react'
import { MARKE_GOLD, MARKE_PFAD, MARKE_VIEWBOX } from '@/lib/markeZeichen'

// Das goldene Maestoso-"M". Die Verlaufs-ID ist je Instanz eindeutig –
// mehrere Logos auf einer Seite würden sich sonst gegenseitig den Verlauf
// überschreiben, sobald eines davon ausgeblendet ist.
export default function Logo({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox={MARKE_VIEWBOX} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={MARKE_GOLD[0]} />
          <stop offset=".5" stopColor={MARKE_GOLD[1]} />
          <stop offset="1" stopColor={MARKE_GOLD[2]} />
        </linearGradient>
      </defs>
      <path fill={`url(#gold-${id})`} d={MARKE_PFAD} />
    </svg>
  )
}
