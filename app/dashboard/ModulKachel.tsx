import Link from 'next/link'
import type { Modul } from '@/lib/module'

export default function ModulKachel({ modul, freigeschaltet }: { modul: Modul; freigeschaltet: boolean }) {
  const Icon = modul.icon
  return (
    <Link
      href={modul.href}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent active:scale-[0.99]"
    >
      <Icon className="h-[22px] w-[22px] text-accent" />
      <h2 className="text-base font-semibold">{modul.name}</h2>
      <p className="text-sm leading-relaxed text-muted">{modul.beschreibung}</p>
      <span
        className={
          freigeschaltet
            ? 'mt-1 w-fit rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-success'
            : 'mt-1 w-fit rounded-full bg-locked-bg px-2.5 py-1 text-xs font-semibold text-locked'
        }
      >
        {freigeschaltet ? 'Aktiv' : 'Demo'}
      </span>
    </Link>
  )
}
