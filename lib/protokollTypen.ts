// Ohne Server-Importe, damit die Client-Ansicht Labels und Typen nutzen kann.
export type ProtokollModul =
  | 'tischplan'
  | 'bestellung'
  | 'gutschein'
  | 'veranstaltung'
  | 'zeiterfassung'
  | 'dienstplan'
  | 'lager'
  | 'website'
  | 'bewertung'
  | 'rechtliches'
  | 'zugaenge'

export const PROTOKOLL_MODUL_LABEL: Record<ProtokollModul, string> = {
  tischplan: 'Tischplan',
  bestellung: 'Bestellung',
  gutschein: 'Gutschein',
  veranstaltung: 'Veranstaltungen',
  zeiterfassung: 'Zeiterfassung',
  dienstplan: 'Dienstplan',
  lager: 'Lager',
  website: 'Website',
  bewertung: 'Bewertung',
  rechtliches: 'Impressum & Datenschutz',
  zugaenge: 'Zugänge & Geräte',
}

export type ProtokollEintrag = {
  id: string
  zeitpunkt: string
  akteurArt: 'inhaber' | 'tresen' | 'handy'
  akteurName: string
  modul: ProtokollModul
  aktion: string
  details: string | null
}
