// Passwortregeln ohne Abhängigkeiten – damit auch Client-Komponenten sie
// für Hinweise importieren können, ohne lib/pinHash.ts (node:crypto) in den
// Browser zu ziehen.

export const PASSWORT_MINDESTLAENGE = 12

// Die häufigsten Muster aus Passwort-Leaks; eine vollständige Liste wäre
// besser, hält aber die offensichtlichsten Fälle schon ab.
const ZU_HAEUFIG = ['passwort', 'password', 'maestoso', 'qwertz', 'qwerty', '123456', 'willkommen', 'sommer', 'winter']

export function passwortFehler(passwort: string, email?: string): string | null {
  if (passwort.length < PASSWORT_MINDESTLAENGE) return `Das Passwort muss mindestens ${PASSWORT_MINDESTLAENGE} Zeichen lang sein.`
  if (passwort.length > 200) return 'Das Passwort ist zu lang.'
  const klein = passwort.toLowerCase()
  if (ZU_HAEUFIG.some((w) => klein.includes(w))) return 'Das Passwort enthält ein zu häufiges Wort oder Muster.'
  if (/^(.)\1+$/.test(passwort)) return 'Das Passwort ist zu leicht zu erraten.'
  const lokalteil = email?.split('@')[0]?.toLowerCase()
  if (lokalteil && lokalteil.length >= 4 && klein.includes(lokalteil)) return 'Das Passwort darf nicht die E-Mail-Adresse enthalten.'
  return null
}
