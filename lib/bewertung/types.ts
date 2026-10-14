export type BewertungsEinstellungen = {
  aktiv: boolean
  googleUrl: string | null
  verzoegerungMinuten: number
}

// Ein Eintrag der Bewertungsliste im Dashboard – Reservierung (Status
// "Erschienen") oder Bestellung (Status "Abgeschlossen"), vereinheitlicht
// fürs Anzeigen. Die Statusänderung selbst bleibt im jeweiligen Modul
// (Tischplan/Bestellung), hier geht es nur um die Übersicht.
export type BewertungsListenEintrag = {
  id: string
  quelle: 'reservierung' | 'bestellung'
  name: string
  email: string | null
  datum: string
  uhrzeit: string
  geplant: boolean
}
