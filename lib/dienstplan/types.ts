export type Schicht = {
  id: string
  datum: string
  beginn: string
  ende: string
  mitarbeiterId: string | null
  notiz: string | null
}

export type Verfuegbarkeit = {
  id: string
  mitarbeiterId: string
  datum: string
  verfuegbar: boolean
  von: string | null
  bis: string | null
  notiz: string | null
}

// "angenommen" heißt: ein Mitarbeiter hat zugesagt, die Schicht ist aber
// noch NICHT umgeschrieben – das passiert erst bei "bestaetigt" durch die
// Leitung. So kann ein Tausch nie still durchlaufen, ohne dass die Leitung
// davon erfährt.
export type TauschAnfrageStatus = 'offen' | 'angenommen' | 'bestaetigt' | 'abgelehnt' | 'storniert'

export const TAUSCH_STATUS_LABEL: Record<TauschAnfrageStatus, string> = {
  offen: 'Offen',
  angenommen: 'Wartet auf Bestätigung',
  bestaetigt: 'Bestätigt',
  abgelehnt: 'Abgelehnt',
  storniert: 'Storniert',
}

export type TauschAnfrage = {
  id: string
  schichtId: string
  anfragenderMitarbeiterId: string
  zielMitarbeiterId: string | null
  status: TauschAnfrageStatus
  erstelltAt: string
}
