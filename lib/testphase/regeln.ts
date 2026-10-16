// Reine Logik ohne Datenbank/Node-APIs – wird auch aus proxy.ts (Edge)
// verwendet.

export type VertragStatus = 'test' | 'aktiv' | 'gesperrt'

export const ENTSCHEIDUNGSFRIST_TAGE = 30
export const VERLAENGERUNG_TAGE = 14
export const ERINNERUNG_VORLAUF_TAGE = 7

export const VERTRAG_SPALTEN = 'vertrag_status, test_bis'

// Abgelaufene Testphase gilt sofort als gesperrt, nicht erst, wenn der
// nächtliche Cron-Job den Status umgestellt hat – sonst hinge die Sperre
// davon ab, dass der Cron zuverlässig läuft.
export function istGesperrt(zeile: { vertrag_status?: unknown; test_bis?: unknown }, jetzt = new Date()): boolean {
  if (zeile.vertrag_status === 'gesperrt') return true
  if (zeile.vertrag_status === 'test' && typeof zeile.test_bis === 'string') return new Date(zeile.test_bis) <= jetzt
  return false
}

export function plusTage(datum: Date, tage: number): Date {
  return new Date(datum.getTime() + tage * 24 * 60 * 60 * 1000)
}
