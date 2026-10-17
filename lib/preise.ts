import type { ModulSchluessel } from '@/lib/module'

// Einzige Quelle für alle Preise auf der Website (/preise). Erst
// veröffentlichen, wenn sie freigegeben sind – bis dahin liefert /preise 404
// und die Navigation zeigt keinen Link.
export const PREISE_OEFFENTLICH = true

// Kleinunternehmer (§ 19 UStG) dürfen keine Umsatzsteuer ausweisen – dann
// darf auch nicht "zzgl. USt." dastehen. Mit dem Steuerberater klären.
export const KLEINUNTERNEHMER = false
export const UST_HINWEIS = KLEINUNTERNEHMER
  ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'
  : 'Alle Preise netto zzgl. gesetzlicher Umsatzsteuer.'

export const STUNDENSATZ_EINRICHTUNG = 60
// Preismodell 2026: Jahreszahlung nur 10 % auf die Software – die
// Einrichtung kostet immer gleich viel, unabhängig von der Zahlungsweise.
export const RABATT_JAHRESZAHLUNG_PROZENT = 10
export const MINDESTLAUFZEIT_MONATE = 12
// Ab Beginn des kostenpflichtigen Vertrags wird der Software-Grundpreis
// nicht erhöht.
export const PREISGARANTIE_MONATE = 24
export const TESTPHASE_TAGE = 30

// Website zuerst: ohne sie gibt es keine Adresse, unter der Gäste
// reservieren, bestellen oder Gutscheine kaufen.
export const EINZELPREISE: { modul: ModulSchluessel; name: string; preis: number }[] = [
  { modul: 'website', name: 'Website', preis: 19 },
  { modul: 'tischplan', name: 'Tischplan & Reservierungen', preis: 39 },
  { modul: 'zeiterfassung', name: 'Zeiterfassung', preis: 22 },
  { modul: 'dienstplan', name: 'Dienstplan', preis: 25 },
  { modul: 'bestellung', name: 'Online-Bestellung', preis: 65 },
  { modul: 'bewertung', name: 'Google-Bewertungsanfrage', preis: 19 },
  { modul: 'lager', name: 'Lagerbestand', preis: 29 },
  { modul: 'gutschein', name: 'Gutschein-Verkauf', preis: 22 },
  { modul: 'veranstaltung', name: 'Veranstaltungsplanung', preis: 35 },
]

export type PaketSchluessel = 'basic' | 'plus' | 'full'

export type Paket = {
  schluessel: PaketSchluessel
  name: 'Basic' | 'Plus' | 'Full'
  preis: number
  einrichtung: number
  // Reduzierte Einrichtung für die ersten Pilotbetriebe (siehe FOUNDING_PARTNER).
  einrichtungFoundingPartner: number
  zusage: string
  module: ModulSchluessel[]
}

export const PAKETE: Paket[] = [
  {
    schluessel: 'basic',
    name: 'Basic',
    preis: 49,
    einrichtung: 349,
    einrichtungFoundingPartner: 199,
    zusage: 'Für den Start: gefunden werden, Tische füllen, Zeiten sauber erfassen.',
    module: ['website', 'tischplan', 'zeiterfassung'],
  },
  {
    schluessel: 'plus',
    name: 'Plus',
    preis: 109,
    einrichtung: 499,
    einrichtungFoundingPartner: 299,
    zusage: 'Für Betriebe mit Abhol- oder Lieferservice und Schichtbetrieb.',
    module: ['website', 'tischplan', 'zeiterfassung', 'dienstplan', 'bestellung', 'bewertung'],
  },
  {
    schluessel: 'full',
    name: 'Full',
    preis: 149,
    einrichtung: 699,
    einrichtungFoundingPartner: 449,
    zusage: 'Für Betriebe mit Lager, Gutscheinverkauf und Feiern.',
    module: ['website', 'tischplan', 'zeiterfassung', 'dienstplan', 'bestellung', 'bewertung', 'lager', 'gutschein', 'veranstaltung'],
  },
]

export const EINRICHTUNG_EINZELMODUL = 149

// Founding Partner: bewusst begrenzt auf die ersten Pilotbetriebe – danach
// verschwindet das Angebot von der Website (Plätze zählt
// lib/foundingPartner.ts aus den im Admin markierten Betrieben).
export const FOUNDING_PARTNER_PLAETZE = 3

export function jahrespreis(monatspreis: number): number {
  return Math.round(monatspreis * 12 * (100 - RABATT_JAHRESZAHLUNG_PROZENT)) / 100
}

export function paketFuer(schluessel: string | null | undefined): Paket | undefined {
  return PAKETE.find((p) => p.schluessel === schluessel)
}

// Welches Paket zu den freigeschalteten Modulen passt – genau gleich, sonst
// keins (dann "individuell"). Abgeleitet statt gespeichert: Freischaltungen
// und Paketanzeige können so nie auseinanderlaufen.
export function paketAusModulen(freigeschaltet: ModulSchluessel[]): Paket | undefined {
  return PAKETE.find((p) => p.module.length === freigeschaltet.length && p.module.every((m) => freigeschaltet.includes(m)))
}

// Rechenbeispiel Lieferportal (Startseite und /preise): Provisionssätze
// großer Portale laut deren öffentlichen Angaben.
export const BEISPIEL_BESTELLUMSATZ = 3000
export const PORTAL_PROVISION_PROZENT = { von: 13, bis: 30 }
export function portalProvision(): { von: number; bis: number } {
  return {
    von: (BEISPIEL_BESTELLUMSATZ * PORTAL_PROVISION_PROZENT.von) / 100,
    bis: (BEISPIEL_BESTELLUMSATZ * PORTAL_PROVISION_PROZENT.bis) / 100,
  }
}
// Günstigstes Paket mit Online-Bestellung – der faire Vergleichspreis.
export function guenstigstesPaketMitBestellung(): Paket {
  return PAKETE.filter((p) => p.module.includes('bestellung')).sort((a, b) => a.preis - b.preis)[0]
}

export function summeEinzeln(module: ModulSchluessel[]): number {
  return EINZELPREISE.filter((e) => module.includes(e.modul)).reduce((s, e) => s + e.preis, 0)
}

export function euro(betrag: number): string {
  const krumm = Math.round(betrag * 100) % 100 !== 0
  return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: krumm ? 2 : 0, maximumFractionDigits: krumm ? 2 : 0 })
}
