// Zeiterfassungs-spezifische Zeitrechnung. Die generische Kalenderrechnung
// (Europe/Berlin-sicher) steckt in lib/datum.ts und wird hier nur
// weitergereicht – seit dem Tischplan-Modul von zwei Modulen genutzt, daher
// nicht länger dupliziert.

export {
  heuteBerlin,
  wochenStart,
  datumPlusTage,
  monatsStart,
  monatsEnde,
  naechsterMonat,
  alleTageZwischen,
  formatDatumKurz,
  wochentagKurz,
  formatMonatLabel,
} from '@/lib/datum'

// Rohe Schichtlänge in Minuten, behandelt Mitternachts-Überlauf – muss
// exakt wie die DB-Funktion zeit_rohminuten() rechnen.
export function rohMinuten(beginn: string, ende: string): number {
  const [bh, bm] = beginn.split(':').map(Number)
  const [eh, em] = ende.split(':').map(Number)
  let diff = eh * 60 + em - (bh * 60 + bm)
  if (diff <= 0) diff += 24 * 60
  return diff
}

export function arbeitsminuten(beginn: string, ende: string, pauseMinuten: number): number {
  return Math.max(0, rohMinuten(beginn, ende) - (pauseMinuten || 0))
}

export function formatStunden(minuten: number): string {
  return (minuten / 60).toFixed(2).replace('.', ',')
}
