import Link from 'next/link'
import { Check } from 'lucide-react'
import FoundingPartnerFormular from './FoundingPartnerFormular'
import { FOUNDING_PARTNER_PLAETZE, PAKETE, PREISGARANTIE_MONATE, TESTPHASE_TAGE, euro } from '@/lib/preise'

// Angebot für die ersten Pilotbetriebe. Knappheit nur, solange sie stimmt:
// die freien Plätze kommen aus den im Admin markierten Betrieben, und ohne
// freien Platz gibt es kein Formular, sondern den Hinweis darauf.
export default function FoundingPartner({ freiePlaetze }: { freiePlaetze: number }) {
  const hoechsteErsparnis = Math.max(...PAKETE.map((p) => p.einrichtung - p.einrichtungFoundingPartner))
  const vorteile = [
    `Einrichtung bis zu ${euro(hoechsteErsparnis)} günstiger`,
    `${TESTPHASE_TAGE} Tage Software kostenlos ab deinem Livegang`,
    `${PREISGARANTIE_MONATE} Monate Preisgarantie auf deine Monatsgebühr`,
    'Direkter Draht zu uns: deine Wünsche fließen in die Entwicklung ein',
  ]

  return (
    <section id="founding-partner" className="scroll-mt-20 bg-m-nacht px-4 py-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-m-gold/40 px-3 py-1 font-marke text-xs font-semibold uppercase tracking-[0.14em] text-m-gold">
            Founding Partner · nur {FOUNDING_PARTNER_PLAETZE} Betriebe
          </p>
          <h2 className="mt-4 font-marke text-3xl font-semibold text-balance sm:text-4xl">
            Werde jetzt Founding Partner und sichere dir den Einführungspreis
          </h2>
          <p className="mt-4 text-white/75">
            Wir suchen {FOUNDING_PARTNER_PLAETZE} Betriebe, die Maestoso von Anfang an mit uns gestalten. Du bekommst die Einrichtung deutlich günstiger,
            wir bekommen dein ehrliches Feedback aus dem echten Betrieb.
          </p>
          <ul className="mt-6 space-y-2.5">
            {vorteile.map((v) => (
              <li key={v} className="flex items-start gap-2.5 text-white/85">
                <Check className="mt-0.5 h-5 w-5 flex-none text-m-gold" aria-hidden="true" />
                {v}
              </li>
            ))}
          </ul>

          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-white/60">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Einrichtung</th>
                  <th className="px-4 py-2.5 font-medium">Regulär</th>
                  <th className="px-4 py-2.5 font-medium text-m-gold">Founding Partner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {PAKETE.map((p) => (
                  <tr key={p.name}>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 tabular-nums text-white/50 line-through">{euro(p.einrichtung)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="font-semibold text-m-gold">{euro(p.einrichtungFoundingPartner)}</span>
                      <span className="ml-2 text-xs text-white/60">du sparst {euro(p.einrichtung - p.einrichtungFoundingPartner)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-white/45">
            Monatspreise wie regulär. Voraussetzung: Texte, Bilder und Speisekarte liegen vollständig vor, eine Korrekturrunde ist inklusive.
          </p>
        </div>

        <div>
          {freiePlaetze > 0 ? (
            <>
              <p className="mb-3 text-sm font-semibold text-m-gold" aria-live="polite">
                Noch {freiePlaetze} von {FOUNDING_PARTNER_PLAETZE} Plätzen frei
              </p>
              <FoundingPartnerFormular />
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-m-nacht-2 p-8">
              <p className="font-marke text-2xl font-semibold">Alle Founding-Partner-Plätze sind vergeben</p>
              <p className="mt-2 text-white/70">Danke für das große Interesse. Eine Demo und die regulären Pakete gibt es natürlich weiterhin.</p>
              <Link href="/#kontakt" className="mt-5 inline-block rounded-full bg-m-gold px-6 py-3 text-sm font-semibold text-m-nacht">
                Demo anfragen
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
