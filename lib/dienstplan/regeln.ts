// Einzige Stelle, die prüft, ob eine Zuweisung (manuell durch die Leitung
// oder durch Annahme einer Tausch-Anfrage) zu einer Doppelbelegung führen
// würde – beide Wege in app/dashboard/dienstplan/actions.ts rufen dieselbe
// Funktion auf, damit sie nie auseinanderlaufen können.

function minuten(zeit: string): number {
  const [h, m] = zeit.split(':').map(Number)
  return h * 60 + m
}

export function ueberschneidenSich(
  a: { datum: string; beginn: string; ende: string },
  b: { datum: string; beginn: string; ende: string }
): boolean {
  if (a.datum !== b.datum) return false
  return minuten(a.beginn) < minuten(b.ende) && minuten(b.beginn) < minuten(a.ende)
}

export function pruefeZuweisung(params: {
  datum: string
  beginn: string
  ende: string
  bestehendeSchichtenDesMitarbeiters: { id: string; datum: string; beginn: string; ende: string }[]
  ausschlussSchichtId?: string
}): { ok: boolean; grund?: string } {
  const konflikt = params.bestehendeSchichtenDesMitarbeiters.find(
    (s) =>
      s.id !== params.ausschlussSchichtId &&
      ueberschneidenSich({ datum: params.datum, beginn: params.beginn, ende: params.ende }, s)
  )
  if (konflikt) {
    return { ok: false, grund: `Überschneidet sich mit einer bestehenden Schicht (${konflikt.beginn}–${konflikt.ende} Uhr).` }
  }
  return { ok: true }
}
