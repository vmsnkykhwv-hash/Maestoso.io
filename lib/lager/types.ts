export type BestellzyklusTyp = 'woechentlich' | 'monatlich'

export type Lieferant = {
  id: string
  name: string
  kontaktEmail: string | null
  kontaktTelefon: string | null
  ansprechpartner: string | null
  kundennummer: string | null
  notiz: string | null
  zyklusTyp: BestellzyklusTyp
  wochentage: number[] // 0 = Sonntag .. 6 = Samstag
  tagImMonat: number | null
  vorlaufTage: number
  aktiv: boolean
}

export type Artikel = {
  id: string
  lieferantId: string
  name: string
  einheit: string
  mindestbestand: number
  notiz: string | null
  aktiv: boolean
}

export type BestandspruefungStatus = 'offen' | 'erledigt'

export type Bestandspruefung = {
  id: string
  lieferantId: string
  bestelldatum: string
  zugewiesenerMitarbeiterId: string | null
  status: BestandspruefungStatus
  erledigtAt: string | null
}

export type BestandspruefungEintrag = {
  id: string
  artikelId: string
  nachbestellen: boolean
  aktuellerBestand: string | null // vom prüfenden Mitarbeiter, immer ausfüllbar
  bestellt: boolean // true, sobald die Leitung diesen Artikel tatsächlich bestellt hat
  bestellmenge: string | null // von der Leitung festgelegt, siehe BestellungUebersicht.tsx
}

// Ein "nachbestellen"-Eintrag aus einer abgeschlossenen Prüfung, der noch
// nicht bestellt wurde – angereichert um die Infos, die die Leitung im
// Bestellung-Tab braucht (Lieferant, Artikelname/Einheit), ohne eine eigene
// Tabelle: derselbe Eintrag, nur mit Kontext aus Prüfung und Artikel verknüpft.
export type OffenerBestellEintrag = BestandspruefungEintrag & {
  pruefungId: string
  lieferantId: string
  artikelName: string
  einheit: string
}

export const WOCHENTAG_LABEL = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
