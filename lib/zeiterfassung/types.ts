export type EintragArt = 'arbeit' | 'urlaub' | 'krank' | 'frei' | 'feiertag'

export const EINTRAG_ART_LABEL: Record<EintragArt, string> = {
  arbeit: 'Arbeit',
  urlaub: 'Urlaub',
  krank: 'Krank',
  frei: 'Frei',
  feiertag: 'Feiertag',
}

export type Zeiteintrag = {
  id: string
  arbeitstag: string
  art: EintragArt
  beginn: string | null
  ende: string | null
  pauseMinuten: number
  notiz: string | null
}

// Ablage von Arbeitsverträgen & Co. pro Mitarbeiter, siehe lib/zeiterfassung/dokumente.ts.
export type MitarbeiterDokument = {
  id: string
  mitarbeiterId: string
  dateiname: string
  groesseBytes: number
  hochgeladenAt: string
}
