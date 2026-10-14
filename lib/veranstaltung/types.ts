export type VeranstaltungStatus = 'angefragt' | 'bestaetigt' | 'abgesagt' | 'durchgefuehrt'

export const VERANSTALTUNG_STATUS_LABEL: Record<VeranstaltungStatus, string> = {
  angefragt: 'Angefragt',
  bestaetigt: 'Bestätigt',
  abgesagt: 'Abgesagt',
  durchgefuehrt: 'Durchgeführt',
}

export type VeranstaltungEinstellungen = {
  aktiv: boolean
  infoText: string | null
  benachrichtigungEmail: string | null
}

export type Veranstaltung = {
  id: string
  titel: string
  ansprechpartnerName: string
  email: string
  telefon: string
  datum: string // YYYY-MM-DD
  beginn: string // HH:MM
  ende: string // HH:MM
  geschaetzteGaeste: number
  status: VeranstaltungStatus
  preis: number | null
  anzahlung: number | null
  notiz: string | null
  blockierungId: string | null
  erstelltAt: string
}
