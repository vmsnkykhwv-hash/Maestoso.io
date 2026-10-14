export type GutscheinEinstellungen = {
  aktiv: boolean
  betraege: number[]
}

export type GutscheinZahlungsart = 'paypal' | 'vor_ort'
export type GutscheinStatus = 'offen' | 'bezahlt' | 'eingeloest' | 'storniert'

export type Gutschein = {
  id: string
  organisationId: string
  code: string
  betrag: number
  kaeuferName: string
  kaeuferEmail: string
  zahlungsart: GutscheinZahlungsart
  status: GutscheinStatus
  paypalOrderId: string | null
  erstelltAt: string
  bezahltAm: string | null
  eingeloestAm: string | null
}
