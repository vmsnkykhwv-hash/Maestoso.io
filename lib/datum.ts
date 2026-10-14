// Generische, Europe/Berlin-sichere Kalenderrechnung – von mehreren Modulen
// genutzt (Zeiterfassung, Tischplan). Reine Kalendertag-Rechnung über
// Date.UTC() mit Jahr/Monat/Tag als Zahlen (nicht toISOString() auf einem
// "echten" Date), weil der Server UTC läuft und das sonst rund um
// Mitternacht und bei der Zeitumstellung falsche Tage liefert.

const TZ = 'Europe/Berlin'

function teileInBerlin(date: Date) {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  return { jahr: get('year'), monat: get('month'), tag: get('day') }
}

function datumString(jahr: number, monat: number, tag: number): string {
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

export function heuteBerlin(): string {
  const { jahr, monat, tag } = teileInBerlin(new Date())
  return datumString(jahr, monat, tag)
}

export function teileAusString(datum: string): { jahr: number; monat: number; tag: number } {
  const [jahr, monat, tag] = datum.split('-').map(Number)
  return { jahr, monat, tag }
}

export function wochenStart(datum: string): string {
  const { jahr, monat, tag } = teileAusString(datum)
  const d = new Date(Date.UTC(jahr, monat - 1, tag))
  const wochentag = (d.getUTCDay() + 6) % 7 // Montag = 0 .. Sonntag = 6
  d.setUTCDate(d.getUTCDate() - wochentag)
  return datumString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function datumPlusTage(datum: string, tage: number): string {
  const { jahr, monat, tag } = teileAusString(datum)
  const d = new Date(Date.UTC(jahr, monat - 1, tag))
  d.setUTCDate(d.getUTCDate() + tage)
  return datumString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function monatsStart(datum: string): string {
  const { jahr, monat } = teileAusString(datum)
  return datumString(jahr, monat, 1)
}

export function monatsEnde(datum: string): string {
  const { jahr, monat } = teileAusString(datum)
  const letzterTag = new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
  return datumString(jahr, monat, letzterTag)
}

export function naechsterMonat(datum: string, versatz: number): string {
  const { jahr, monat, tag } = teileAusString(datum)
  const d = new Date(Date.UTC(jahr, monat - 1 + versatz, Math.min(tag, 28)))
  return datumString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function alleTageZwischen(von: string, bis: string): string[] {
  const tage: string[] = []
  let aktuell = von
  while (aktuell <= bis) {
    tage.push(aktuell)
    aktuell = datumPlusTage(aktuell, 1)
  }
  return tage
}

export function formatDatumKurz(datum: string): string {
  const { tag, monat } = teileAusString(datum)
  return `${String(tag).padStart(2, '0')}.${String(monat).padStart(2, '0')}.`
}

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function wochentagKurz(datum: string): string {
  const { jahr, monat, tag } = teileAusString(datum)
  const d = new Date(Date.UTC(jahr, monat - 1, tag))
  return WOCHENTAGE[(d.getUTCDay() + 6) % 7]
}

export function wochentagIndex(datum: string): number {
  const { jahr, monat, tag } = teileAusString(datum)
  const d = new Date(Date.UTC(jahr, monat - 1, tag))
  return d.getUTCDay() // Sonntag = 0 .. Samstag = 6
}

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export function formatMonatLabel(datum: string): string {
  const { jahr, monat } = teileAusString(datum)
  return `${MONATSNAMEN[monat - 1]} ${jahr}`
}

// Datum + Uhrzeit, wie sie in der Datenbank stehen (Europe/Berlin-Wandzeit,
// keine Zeitzone dabei), in den tatsächlichen UTC-Zeitpunkt umrechnen –
// nötig für alles, was einen exakten Versandzeitpunkt braucht (z. B.
// Resends `scheduledAt`). Trick: den Zeitpunkt zunächst naiv als UTC
// annehmen, dann in Berlin-Zeit ausgeben lassen und aus der Differenz den
// tatsächlichen Offset (inkl. Sommer-/Winterzeit) ablesen.
export function berlinZeitpunktAlsUtc(datum: string, uhrzeit: string): Date {
  const { jahr, monat, tag } = teileAusString(datum)
  const [stunde, minute] = uhrzeit.split(':').map(Number)
  const alsUtcAngenommen = new Date(Date.UTC(jahr, monat - 1, tag, stunde, minute))

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(alsUtcAngenommen)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  const alsBerlinGelesen = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))

  const offsetMs = alsBerlinGelesen - alsUtcAngenommen.getTime()
  return new Date(alsUtcAngenommen.getTime() - offsetMs)
}
