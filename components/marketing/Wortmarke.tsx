import Logo from '@/components/Logo'

// Logo-Zeichen + Schriftzug wie im Markenbanner; der Slogan nur dort, wo
// Platz ist (Website-Kopf auf großen Bildschirmen, Fußzeile).
export default function Wortmarke({ hell = false, slogan = false, className = '' }: { hell?: boolean; slogan?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Logo className="h-8 w-9 flex-none" />
      <span className="flex flex-col leading-none">
        <span className={`font-marke text-2xl font-bold tracking-tight ${hell ? 'text-white' : 'text-m-tinte'}`}>Maestoso</span>
        {slogan && <span className="mt-1 font-marke text-[11px] tracking-[0.12em] text-m-gold">Gastronomie. Einfach. Digital.</span>}
      </span>
    </span>
  )
}
