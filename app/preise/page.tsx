import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check } from 'lucide-react'
import Kopf from '@/components/marketing/Kopf'
import Fuss from '@/components/marketing/Fuss'
import { freieFoundingPartnerPlaetze } from '@/lib/foundingPartner'
import { RECHTSTEXTE_VOLLSTAENDIG } from '@/lib/rechtliches/plattform'
import {
  EINRICHTUNG_EINZELMODUL,
  EINZELPREISE,
  MINDESTLAUFZEIT_MONATE,
  PAKETE,
  PREISE_OEFFENTLICH,
  FOUNDING_PARTNER_PLAETZE,
  PREISGARANTIE_MONATE,
  RABATT_JAHRESZAHLUNG_PROZENT,
  jahrespreis,
  TESTPHASE_TAGE,
  UST_HINWEIS,
  BEISPIEL_BESTELLUMSATZ,
  euro,
  guenstigstesPaketMitBestellung,
  portalProvision,
  summeEinzeln,
} from '@/lib/preise'

export const metadata: Metadata = {
  title: 'Preise – Maestoso',
  description: 'Feste Monatspreise ohne Provision und ohne Aufpreis pro Mitarbeiter: Basic, Plus und Full oder einzelne Module.',
  robots: RECHTSTEXTE_VOLLSTAENDIG ? { index: true, follow: true } : { index: false, follow: false },
}

export const revalidate = 60

export default async function Preise() {
  if (!PREISE_OEFFENTLICH) notFound()
  const freiePlaetze = await freieFoundingPartnerPlaetze()
  const provision = portalProvision()
  const paket = guenstigstesPaketMitBestellung()

  return (
    <div className="bg-m-creme font-sans text-m-tinte">
      <Kopf foundingPartner={freiePlaetze > 0} />
      <main className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-marke text-sm font-medium uppercase tracking-[0.16em] text-m-gold-dunkel">Preise</p>
          <h1 className="mt-2 max-w-3xl font-marke text-3xl font-semibold text-balance sm:text-5xl">Feste Monatspreise. Keine Provision, kein Preis pro Kopf.</h1>
          <p className="mt-4 max-w-2xl text-m-leise">
            Preise je Betrieb und Monat. {TESTPHASE_TAGE} Tage kostenlos testen, bei jährlicher Zahlung {RABATT_JAHRESZAHLUNG_PROZENT} % günstiger,
            {' '}{PREISGARANTIE_MONATE} Monate Preisgarantie.
          </p>
          {freiePlaetze > 0 && (
            <Link
              href="/#founding-partner"
              className="mt-6 flex flex-col gap-1 rounded-2xl border border-m-gold bg-m-nacht px-5 py-4 text-white transition hover:border-m-gold-hell sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                <span className="font-marke font-semibold text-m-gold">Founding Partner:</span> Einrichtung ab {euro(Math.min(...PAKETE.map((p) => p.einrichtungFoundingPartner)))} statt ab{' '}
                {euro(Math.min(...PAKETE.map((p) => p.einrichtung)))}. Nur noch {freiePlaetze} von {FOUNDING_PARTNER_PLAETZE} Plätzen.
              </span>
              <span className="text-sm font-semibold text-m-gold-hell">Jetzt bewerben →</span>
            </Link>
          )}

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {PAKETE.map((p) => {
              const einzeln = summeEinzeln(p.module)
              const empfohlen = p.name === 'Plus'
              return (
                <article key={p.name} className={`flex flex-col rounded-2xl border bg-white p-7 ${empfohlen ? 'border-m-gold shadow-[0_12px_40px_-20px_rgba(161,115,74,0.6)]' : 'border-m-linie'}`}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-marke text-2xl font-semibold">{p.name}</h2>
                    {empfohlen && <span className="rounded-full bg-m-papier px-2.5 py-0.5 text-xs font-semibold text-m-gold-dunkel">Unsere Empfehlung</span>}
                  </div>
                  <p className="mt-1 min-h-10 text-sm text-m-leise">{p.zusage}</p>
                  <p className="mt-6 font-marke text-4xl font-semibold tabular-nums">
                    {euro(p.preis)}
                    <span className="text-base font-normal text-m-leise"> / Monat</span>
                  </p>
                  <p className="mt-1 text-sm text-m-leise">
                    oder {euro(jahrespreis(p.preis))} jährlich ({euro(jahrespreis(p.preis) / 12)} / Monat)
                  </p>
                  <p className="mt-1 text-sm text-m-leise">
                    einzeln {euro(einzeln)} – du sparst {Math.round((1 - p.preis / einzeln) * 100)} %
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-[15px]">
                    {EINZELPREISE.map((e) => {
                      const drin = p.module.includes(e.modul)
                      return (
                        <li key={e.modul} className={`flex items-start gap-2.5 ${drin ? '' : 'text-m-leise/50 line-through'}`}>
                          <Check className={`mt-0.5 h-4 w-4 flex-none ${drin ? 'text-m-gold-dunkel' : 'opacity-0'}`} aria-hidden="true" />
                          <span>
                            {e.name}
                            {!drin && <span className="sr-only"> (nicht enthalten)</span>}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mt-6 border-t border-m-linie pt-4 text-sm text-m-leise">
                    Einrichtung einmalig {euro(p.einrichtung)}
                    {freiePlaetze > 0 && (
                      <>
                        <br />
                        <span className="font-semibold text-m-gold-dunkel">Founding Partner: {euro(p.einrichtungFoundingPartner)}</span>
                      </>
                    )}
                  </p>
                  <Link
                    href="/#kontakt"
                    className={`mt-5 rounded-full px-5 py-3 text-center text-sm font-semibold transition ${empfohlen ? 'bg-m-tinte text-white hover:bg-black' : 'border border-m-tinte hover:bg-m-tinte hover:text-white'}`}
                  >
                    Demo anfragen
                  </Link>
                </article>
              )
            })}
          </div>

          {/* Gleiche Rechnung wie auf der Startseite, hier mit dem konkreten
              Paketpreis – der Vergleich, der den Monatspreis einordnet. */}
          <section className="mt-10 rounded-2xl bg-m-nacht p-6 text-white sm:p-8">
            <p className="font-marke text-sm font-medium uppercase tracking-[0.16em] text-m-gold">Rechenbeispiel</p>
            <p className="mt-3 max-w-3xl text-lg text-white/85">
              Bei {euro(BEISPIEL_BESTELLUMSATZ)} Bestellumsatz im Monat nimmt ein Lieferportal {euro(provision.von)} bis {euro(provision.bis)} Provision. Das Paket {paket.name} mit Online-Bestellung kostet {euro(paket.preis)} im Monat, fest. Es bleiben dir also mindestens{' '}
              <strong className="text-m-gold">{euro(provision.von - paket.preis)} mehr im Monat</strong>, bei mehr Bestellungen entsprechend mehr.
            </p>
          </section>

          <section className="mt-16 grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-marke text-2xl font-semibold">Einzelne Module</h2>
              <p className="mt-2 text-sm text-m-leise">Für Betriebe, die nur ein Werkzeug brauchen. Einrichtung je Modul {euro(EINRICHTUNG_EINZELMODUL)}.</p>
              <div className="mt-5 overflow-x-auto rounded-2xl border border-m-linie bg-white">
                <table className="w-full text-[15px]">
                  <tbody className="divide-y divide-m-linie">
                    {EINZELPREISE.map((e) => (
                      <tr key={e.modul}>
                        <td className="px-5 py-3">{e.name}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{euro(e.preis)} / Monat</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h2 className="font-marke text-2xl font-semibold">Konditionen</h2>
              <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-m-leise">
                <li><strong className="text-m-tinte">{TESTPHASE_TAGE} Tage kostenlos testen</strong> ab deinem Livegang. Der Test endet von selbst, kündigen musst du nichts. Machst du nicht weiter, löschen wir deine Daten vollständig.</li>
                <li><strong className="text-m-tinte">Laufzeit {MINDESTLAUFZEIT_MONATE} Monate,</strong> danach monatlich zum Monatsende kündbar.</li>
                <li><strong className="text-m-tinte">{PREISGARANTIE_MONATE} Monate Preisgarantie</strong> ab Vertragsbeginn: Dein Monatspreis steigt in dieser Zeit nicht.</li>
                <li><strong className="text-m-tinte">Jahreszahlung:</strong> {RABATT_JAHRESZAHLUNG_PROZENT} % günstiger auf die Software.</li>
                <li><strong className="text-m-tinte">Einrichtung inklusive Domain-Umzug,</strong> Website-Inhalte, Grundeinstellungen und Einweisung deines Teams. Sie wird einmalig zu Beginn berechnet, damit du im echten Betrieb testest.</li>
                <li><strong className="text-m-tinte">Keine Provision</strong> auf Bestellungen, Reservierungen oder Gutscheine, kein Aufpreis pro Mitarbeiter.</li>
              </ul>
            </div>
          </section>

          <p className="mt-12 text-sm text-m-leise">{UST_HINWEIS} Angebot richtet sich ausschließlich an Unternehmen.</p>
        </div>
      </main>
      <Fuss />
    </div>
  )
}
