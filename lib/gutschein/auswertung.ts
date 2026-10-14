import type { Gutschein } from './types'

// Gutschein-Ansprüche verjähren nach deutschem Recht regelmäßig nach drei
// Jahren (§195 BGB, ab Jahresende des Kaufs) – 30 Monate nach Bezahlung ist
// ein konservativer Vorlauf, um rechtzeitig vor der Drei-Jahres-Grenze zu
// warnen, nicht erst wenn sie schon überschritten ist.
const WARNUNG_NACH_MONATEN = 30

export type GutscheinVerbindlichkeiten = {
  offenerBetrag: number // bezahlt, aber noch nicht eingelöst – das, was das Café an Gegenwert schuldet
  anzahlOffen: number
  eingeloestBetrag: number
  verkauftGesamt: number // offenerBetrag + eingeloestBetrag
  aeltesteOffenSeit: string | null
  baldVerfallend: Gutschein[] // offen, seit mindestens WARNUNG_NACH_MONATEN Monaten bezahlt
}

export function berechneVerbindlichkeiten(gutscheine: Gutschein[]): GutscheinVerbindlichkeiten {
  const offen = gutscheine.filter((g) => g.status === 'bezahlt')
  const eingeloest = gutscheine.filter((g) => g.status === 'eingeloest')

  const offenerBetrag = offen.reduce((summe, g) => summe + g.betrag, 0)
  const eingeloestBetrag = eingeloest.reduce((summe, g) => summe + g.betrag, 0)

  const aeltesteOffenSeit = offen.reduce<string | null>((aeltestes, g) => {
    if (!g.bezahltAm) return aeltestes
    if (!aeltestes || g.bezahltAm < aeltestes) return g.bezahltAm
    return aeltestes
  }, null)

  const warnungsGrenze = new Date()
  warnungsGrenze.setMonth(warnungsGrenze.getMonth() - WARNUNG_NACH_MONATEN)
  const baldVerfallend = offen
    .filter((g) => g.bezahltAm && new Date(g.bezahltAm) <= warnungsGrenze)
    .sort((a, b) => (a.bezahltAm ?? '').localeCompare(b.bezahltAm ?? ''))

  return {
    offenerBetrag,
    anzahlOffen: offen.length,
    eingeloestBetrag,
    verkauftGesamt: offenerBetrag + eingeloestBetrag,
    aeltesteOffenSeit,
    baldVerfallend,
  }
}
