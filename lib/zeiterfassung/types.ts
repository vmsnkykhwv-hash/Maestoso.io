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
  // Nach dem Anlegen noch einmal geändert – dann gibt es einen Verlauf.
  geaendert?: boolean
}

export type ZeitStand = { arbeitstag: string; art: EintragArt; beginn: string | null; ende: string | null; pause_minuten: number; notiz: string | null }

export type ZeitHistorie = {
  aktion: 'angelegt' | 'geaendert' | 'geloescht'
  alt: ZeitStand | null
  neu: ZeitStand | null
  geaendertVon: string | null
  zeitpunkt: string
}

// Ablage von Arbeitsverträgen & Co. pro Mitarbeiter, siehe lib/zeiterfassung/dokumente.ts.
export type MitarbeiterDokument = {
  id: string
  mitarbeiterId: string
  dateiname: string
  groesseBytes: number
  hochgeladenAt: string
}
