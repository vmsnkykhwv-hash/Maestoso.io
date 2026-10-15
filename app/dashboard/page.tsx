import { redirect } from 'next/navigation'
import { CalendarCheck, ShoppingBag, PackageSearch, Users } from 'lucide-react'
import AppHeader from '@/components/AppHeader'
import { getBetriebsSitzung } from '@/lib/session'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { MODULE } from '@/lib/module'
import { heuteBerlin } from '@/lib/datum'
import { ladeReservierungenFuerTag } from '@/lib/tischplan/daten'
import { ladeBestellungenFuerTag } from '@/lib/bestellung/daten'
import { ladeAllePruefungen } from '@/lib/lager/daten'
import { ladeSchichtenFuerZeitraum } from '@/lib/dienstplan/daten'
import ModulKachel from './ModulKachel'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const sitzung = await getBetriebsSitzung()
  if (!sitzung) redirect('/team')

  const heute = heuteBerlin()
  const [freischaltungen, reservierungen, bestellungen, pruefungen, schichten] = await Promise.all([
    ladeFreischaltungen(sitzung.organisationId),
    ladeReservierungenFuerTag(sitzung.organisationId, heute),
    ladeBestellungenFuerTag(sitzung.organisationId, heute),
    ladeAllePruefungen(sitzung.organisationId),
    ladeSchichtenFuerZeitraum(sitzung.organisationId, heute, heute),
  ])

  const reservierungenAktiv = reservierungen.filter((r) => r.status === 'bestaetigt' || r.status === 'erschienen')
  const reservierungenErschienen = reservierungen.filter((r) => r.status === 'erschienen').length
  const bestellungenNeu = bestellungen.filter((b) => !b.gesehen).length
  const pruefungenOffen = pruefungen.filter((p) => p.status === 'offen').length
  const mitarbeiterHeute = new Set(schichten.map((s) => s.mitarbeiterId).filter(Boolean)).size

  const kennzahlen = [
    {
      label: 'Reservierungen heute',
      wert: reservierungenAktiv.length,
      hinweis: `${reservierungenErschienen} bereits da`,
      icon: CalendarCheck,
    },
    {
      label: 'Bestellungen heute',
      wert: bestellungen.length,
      hinweis: `${bestellungenNeu} neu`,
      icon: ShoppingBag,
    },
    {
      label: 'Fällige Lagerprüfungen',
      wert: pruefungenOffen,
      hinweis: 'noch zu erledigen',
      icon: PackageSearch,
    },
    {
      label: 'Personal heute',
      wert: mitarbeiterHeute,
      hinweis: `${schichten.length} Schichten geplant`,
      icon: Users,
    },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Eure Tools" />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 p-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kennzahlen.map((k) => (
            <div key={k.label} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
              <k.icon className="h-5 w-5 text-accent" />
              <p className="font-display text-3xl font-semibold">{k.wert}</p>
              <p className="text-sm font-medium text-foreground-soft">{k.label}</p>
              <p className="text-xs text-muted">{k.hinweis}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">Eure Module</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MODULE.map((modul) => (
              <ModulKachel key={modul.schluessel} modul={modul} freigeschaltet={freischaltungen[modul.schluessel]} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
