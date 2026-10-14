export type BestellKanal = 'abholung' | 'lieferung'

export type BestellStatus = 'neu' | 'bestaetigt' | 'abgeschlossen' | 'storniert'

export const BESTELL_STATUS_LABEL: Record<BestellStatus, string> = {
  neu: 'Neu',
  bestaetigt: 'Bestätigt',
  abgeschlossen: 'Abgeschlossen',
  storniert: 'Storniert',
}

export type BestellEinstellungen = {
  abholungAktiv: boolean
  lieferungAktiv: boolean
  abholungVon: string | null // HH:MM, null = gesamtes Öffnungsfenster
  abholungBis: string | null
  lieferungVon: string | null
  lieferungBis: string | null
  slotMinuten: number
  vorlaufMinutenAbholung: number
  vorlaufMinutenLieferung: number
  maxOffenAbholung: number | null // Schutzmechanismus: Obergrenze gleichzeitig offener Bestellungen, null = unbegrenzt
  maxOffenLieferung: number | null
  abholungPausiertBis: string | null // ISO-Timestamp, befristete Schnellpause
  lieferungPausiertBis: string | null
  abholungPauseGrund: string | null
  lieferungPauseGrund: string | null
  benachrichtigungEmail: string | null // Adresse fürs Personal, an die neue Bestellungen gemeldet werden
}

export type BestellPosition = {
  id: string
  name: string // Namens-/Preis-Snapshot vom Bestellzeitpunkt, unabhängig von späteren Speisekarten-Änderungen
  preis: number
  menge: number
  notiz: string | null
}

export type Bestellung = {
  id: string
  kanal: BestellKanal
  name: string
  telefon: string
  email: string | null
  adresse: string | null // nur bei Lieferung gesetzt
  datum: string
  uhrzeit: string
  status: BestellStatus
  notiz: string | null
  gesamtPreis: number
  erstelltAt: string
  gesehen: boolean
  positionen: BestellPosition[]
}

export type BestellSlotVerfuegbarkeit = {
  uhrzeit: string
  verfuegbar: boolean
}
