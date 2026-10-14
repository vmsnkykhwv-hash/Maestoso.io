export type ReservierungStatus = 'bestaetigt' | 'erschienen' | 'storniert' | 'nicht_erschienen'

export const RESERVIERUNG_STATUS_LABEL: Record<ReservierungStatus, string> = {
  bestaetigt: 'Bestätigt',
  erschienen: 'Erschienen',
  storniert: 'Storniert',
  nicht_erschienen: 'Nicht erschienen',
}

export type Tisch = {
  id: string
  name: string
  kapazitaet: number
  sortierung: number
}

export type Einstellungen = {
  wocheStart: string // HH:MM, Mo-Sa
  wocheEnde: string
  sonntagStart: string // So + gesetzliche Feiertage in Hessen
  sonntagEnde: string
  slotMinuten: number
  dauerMinuten: number
  vorlaufMinuten: number
  minPersonen: number
  maxPersonenOnline: number
  maxPersonenGleichzeitig: number
}

export type Reservierung = {
  id: string
  name: string
  email: string
  anzahlPersonen: number
  datum: string // YYYY-MM-DD
  uhrzeit: string // HH:MM
  erinnerung: boolean
  status: ReservierungStatus
  tischId: string | null
  notiz: string | null
  erstelltAt: string
}

export type Blockierung = {
  id: string
  datum: string
  startZeit: string
  endZeit: string
  anzahlTische: number
  notiz: string | null
}

export type SlotVerfuegbarkeit = {
  uhrzeit: string
  verfuegbar: boolean
}

// Tagesgenaue Ausnahme von den regulären Öffnungszeiten (einmalig kürzer/
// länger geöffnet oder ganz geschlossen), siehe 0007_tischplan_ausnahmen.sql.
export type ReservierungAusnahme = {
  id: string
  datum: string
  geschlossen: boolean
  von: string | null
  bis: string | null
  notiz: string | null
}
