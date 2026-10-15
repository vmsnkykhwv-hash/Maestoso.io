'use server'

import { ladeMitarbeiter, ladeMitarbeiterNamen } from '@/lib/mitarbeiter/daten'
import { aktionFuer, verwaltungFuer } from '@/lib/zugriff'
import {
  ladeAktiveTauschAnfragen,
  ladeSchicht,
  ladeSchichtenFuerMitarbeiter,
  ladeSchichtenFuerZeitraum,
  ladeTauschAnfrage,
  ladeVerfuegbarkeitenFuerMitarbeiter,
  ladeVerfuegbarkeitenFuerZeitraum,
  schichtAktualisieren,
  schichtErstellen,
  schichtLoeschen,
  tauschAnfrageErstellen,
  tauschAnfrageStatusSetzen,
  tauschAnfrageZusagen,
  verfuegbarkeitSetzen,
} from '@/lib/dienstplan/daten'
import { pruefeZuweisung } from '@/lib/dienstplan/regeln'
import { heuteBerlin } from '@/lib/datum'
import type { Schicht, TauschAnfrage, Verfuegbarkeit } from '@/lib/dienstplan/types'
import { mitProtokoll } from '@/lib/protokoll'

// Planen, bestätigen, Team-Verfügbarkeit: nur Verwaltungskonto.
async function leitungOderFehler() {
  return verwaltungFuer('dienstplan')
}

// Eigene Verfügbarkeit, Tausch anbieten/annehmen: die Mitarbeiterin selbst,
// am Tresen (PIN) oder vom gekoppelten Handy – mit freigeschaltetem
// Dienstplan.
async function mitarbeiterSitzungOderFehler() {
  const sitzung = await aktionFuer('dienstplan')
  if (sitzung.art === 'inhaber' || !sitzung.mitarbeiter) throw new Error('Nicht als Mitarbeiter angemeldet')
  return { organisationId: sitzung.organisationId, mitarbeiterId: sitzung.mitarbeiter.id }
}

// IDs kommen vom Client – ohne diese Prüfung ließe sich eine Schicht einer
// Person aus einem fremden Betrieb zuweisen.
async function mitarbeiterGehoertDazu(organisationId: string, mitarbeiterId: string | null | undefined): Promise<boolean> {
  if (!mitarbeiterId) return true
  return !!(await ladeMitarbeiter(mitarbeiterId, organisationId))
}

// Den Plan (wer arbeitet wann) sehen alle mit Dienstplan-Zugang.
export async function schichtenFuerZeitraumLadenAktion(von: string, bis: string): Promise<Schicht[]> {
  const sitzung = await aktionFuer('dienstplan')
  return ladeSchichtenFuerZeitraum(sitzung.organisationId, von, bis)
}

export async function mitarbeiterNamenLadenAktion(): Promise<{ id: string; name: string }[]> {
  const sitzung = await aktionFuer('dienstplan')
  return ladeMitarbeiterNamen(sitzung.organisationId)
}

async function pruefeKonfliktfrei(
  organisationId: string,
  input: { datum: string; beginn: string; ende: string; mitarbeiterId: string | null },
  ausschlussSchichtId?: string
): Promise<string | undefined> {
  if (!input.mitarbeiterId) return undefined
  const bestehende = await ladeSchichtenFuerMitarbeiter(input.mitarbeiterId, input.datum, input.datum)
  const pruefung = pruefeZuweisung({
    datum: input.datum,
    beginn: input.beginn,
    ende: input.ende,
    bestehendeSchichtenDesMitarbeiters: bestehende,
    ausschlussSchichtId,
  })
  return pruefung.ok ? undefined : pruefung.grund
}

export async function schichtErstellenAktion(input: {
  datum: string
  beginn: string
  ende: string
  mitarbeiterId: string | null
  notiz?: string
}): Promise<{ fehler?: string; schicht?: Schicht }> {
  const sitzung = await leitungOderFehler()
  if (!(await mitarbeiterGehoertDazu(sitzung.organisationId, input.mitarbeiterId))) return { fehler: 'Mitarbeiter nicht gefunden' }

  const konflikt = await pruefeKonfliktfrei(sitzung.organisationId, input)
  if (konflikt) return { fehler: konflikt }

  return mitProtokoll(schichtErstellen(sitzung.organisationId, input), 'dienstplan', 'Schicht angelegt', `${input.datum} ${input.beginn}–${input.ende}`, null)
}

export async function schichtAktualisierenAktion(
  schichtId: string,
  patch: { datum?: string; beginn?: string; ende?: string; mitarbeiterId?: string | null; notiz?: string | null }
): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()
  if (!(await mitarbeiterGehoertDazu(sitzung.organisationId, patch.mitarbeiterId))) return { fehler: 'Mitarbeiter nicht gefunden' }

  if (patch.mitarbeiterId !== undefined || patch.datum !== undefined || patch.beginn !== undefined || patch.ende !== undefined) {
    const bestehend = await ladeSchicht(schichtId, sitzung.organisationId)
    if (!bestehend) return { fehler: 'Schicht nicht gefunden' }
    const konflikt = await pruefeKonfliktfrei(
      sitzung.organisationId,
      {
        datum: patch.datum ?? bestehend.datum,
        beginn: patch.beginn ?? bestehend.beginn,
        ende: patch.ende ?? bestehend.ende,
        mitarbeiterId: patch.mitarbeiterId !== undefined ? patch.mitarbeiterId : bestehend.mitarbeiterId,
      },
      schichtId
    )
    if (konflikt) return { fehler: konflikt }
  }

  return mitProtokoll(schichtAktualisieren(schichtId, sitzung.organisationId, patch), 'dienstplan', 'Schicht geändert', null, schichtId)
}

export async function schichtLoeschenAktion(schichtId: string): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()
  return mitProtokoll(schichtLoeschen(schichtId, sitzung.organisationId), 'dienstplan', 'Schicht gelöscht', null, schichtId)
}

export async function verfuegbarkeitenLadenAktion(mitarbeiterId: string, von: string, bis: string): Promise<Verfuegbarkeit[]> {
  const sitzung = await aktionFuer('dienstplan')
  if (sitzung.art === 'inhaber') {
    if (!(await mitarbeiterGehoertDazu(sitzung.organisationId, mitarbeiterId))) throw new Error('Keine Berechtigung')
  } else if (sitzung.mitarbeiter?.id !== mitarbeiterId) {
    throw new Error('Keine Berechtigung')
  }
  return ladeVerfuegbarkeitenFuerMitarbeiter(mitarbeiterId, von, bis)
}

export async function verfuegbarkeitenFuerZeitraumLadenAktion(von: string, bis: string): Promise<Verfuegbarkeit[]> {
  const sitzung = await leitungOderFehler()
  return ladeVerfuegbarkeitenFuerZeitraum(sitzung.organisationId, von, bis)
}

export async function verfuegbarkeitSetzenAktion(input: {
  datum: string
  verfuegbar: boolean
  von?: string | null
  bis?: string | null
  notiz?: string
}): Promise<{ fehler?: string; verfuegbarkeit?: Verfuegbarkeit }> {
  const sitzung = await mitarbeiterSitzungOderFehler()
  return mitProtokoll(verfuegbarkeitSetzen(sitzung.organisationId, sitzung.mitarbeiterId, input), 'dienstplan', 'Verfügbarkeit eingetragen', `${input.datum}: ${input.verfuegbar ? 'verfügbar' : 'nicht verfügbar'}`, null)
}

export type TauschAnfrageMitSchicht = TauschAnfrage & { schicht: Schicht }

export async function offeneTauschAnfragenLadenAktion(): Promise<TauschAnfrageMitSchicht[]> {
  const sitzung = await aktionFuer('dienstplan')
  const anfragen = await ladeAktiveTauschAnfragen(sitzung.organisationId)

  const mitSchicht = await Promise.all(
    anfragen.map(async (anfrage) => {
      const schicht = await ladeSchicht(anfrage.schichtId, sitzung.organisationId)
      return schicht ? { ...anfrage, schicht } : null
    })
  )

  return mitSchicht.filter((x): x is TauschAnfrageMitSchicht => x !== null)
}

export async function tauschAnfrageErstellenAktion(schichtId: string): Promise<{ fehler?: string; anfrage?: TauschAnfrage }> {
  const sitzung = await mitarbeiterSitzungOderFehler()

  const schicht = await ladeSchicht(schichtId, sitzung.organisationId)
  if (!schicht) return { fehler: 'Schicht nicht gefunden' }
  if (schicht.mitarbeiterId !== sitzung.mitarbeiterId) return { fehler: 'Das ist nicht deine Schicht' }
  if (schicht.datum < heuteBerlin()) return { fehler: 'Diese Schicht liegt in der Vergangenheit' }

  return mitProtokoll(tauschAnfrageErstellen(sitzung.organisationId, schichtId, sitzung.mitarbeiterId), 'dienstplan', 'Schicht zum Tausch angeboten', null, schichtId)
}

export async function tauschAnfrageStornierenAktion(anfrageId: string): Promise<{ fehler?: string }> {
  const sitzung = await aktionFuer('dienstplan')

  const anfrage = await ladeTauschAnfrage(anfrageId, sitzung.organisationId)
  if (!anfrage) return { fehler: 'Diese Tausch-Anfrage wurde nicht gefunden' }
  if (sitzung.art !== 'inhaber' && anfrage.anfragenderMitarbeiterId !== sitzung.mitarbeiter?.id) {
    return { fehler: 'Keine Berechtigung' }
  }

  return mitProtokoll(tauschAnfrageStatusSetzen(anfrageId, sitzung.organisationId, 'storniert', ['offen', 'angenommen']), 'dienstplan', 'Tausch-Anfrage zurückgezogen', null, anfrageId)
}

// Zusage eines anderen Mitarbeiters – schreibt die Schicht bewusst noch
// NICHT um. Die Anfrage wechselt nur auf "angenommen" (wartet auf
// Bestätigung der Leitung); erst tauschAnfrageBestaetigenAktion unten
// weist die Schicht tatsächlich zu. So erfährt die Leitung von jedem
// Tausch, bevor er wirksam wird, statt von einem plötzlich anderen
// Mitarbeiter überrascht zu werden.
export async function tauschAnfrageAnnehmenAktion(anfrageId: string): Promise<{ fehler?: string }> {
  const sitzung = await mitarbeiterSitzungOderFehler()

  const anfrage = await ladeTauschAnfrage(anfrageId, sitzung.organisationId)
  if (!anfrage || anfrage.status !== 'offen') return { fehler: 'Diese Tausch-Anfrage ist nicht mehr offen' }
  if (anfrage.anfragenderMitarbeiterId === sitzung.mitarbeiterId) return { fehler: 'Du kannst deine eigene Anfrage nicht annehmen' }

  const schicht = await ladeSchicht(anfrage.schichtId, sitzung.organisationId)
  if (!schicht) return { fehler: 'Schicht nicht gefunden' }
  if (schicht.datum < heuteBerlin()) return { fehler: 'Diese Schicht liegt in der Vergangenheit' }

  const konflikt = await pruefeKonfliktfrei(sitzung.organisationId, { ...schicht, mitarbeiterId: sitzung.mitarbeiterId })
  if (konflikt) return { fehler: konflikt }

  return mitProtokoll(tauschAnfrageZusagen(anfrageId, sitzung.organisationId, sitzung.mitarbeiterId), 'dienstplan', 'Tausch zugesagt', null, anfrageId)
}

// Erst hier wird die Schicht tatsächlich umgeschrieben – ausschließlich
// durch die Leitung, nachdem ein Mitarbeiter zugesagt hat.
export async function tauschAnfrageBestaetigenAktion(anfrageId: string): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()

  const anfrage = await ladeTauschAnfrage(anfrageId, sitzung.organisationId)
  if (!anfrage || anfrage.status !== 'angenommen' || !anfrage.zielMitarbeiterId) {
    return { fehler: 'Diese Anfrage wartet nicht (mehr) auf Bestätigung' }
  }

  const schicht = await ladeSchicht(anfrage.schichtId, sitzung.organisationId)
  if (!schicht) return { fehler: 'Schicht nicht gefunden' }

  // Erneut prüfen statt der Zusage blind zu vertrauen – zwischen Zusage
  // und Bestätigung kann sich der Dienstplan des Zielmitarbeiters geändert
  // haben.
  const konflikt = await pruefeKonfliktfrei(sitzung.organisationId, { ...schicht, mitarbeiterId: anfrage.zielMitarbeiterId })
  if (konflikt) return { fehler: konflikt }

  const zuweisung = await schichtAktualisieren(schicht.id, sitzung.organisationId, { mitarbeiterId: anfrage.zielMitarbeiterId })
  if (zuweisung.fehler) return zuweisung

  return mitProtokoll(tauschAnfrageStatusSetzen(anfrageId, sitzung.organisationId, 'bestaetigt', ['angenommen'], anfrage.zielMitarbeiterId), 'dienstplan', 'Tausch bestätigt', null, anfrageId)
}

export async function tauschAnfrageAblehnenAktion(anfrageId: string): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()
  return mitProtokoll(tauschAnfrageStatusSetzen(anfrageId, sitzung.organisationId, 'abgelehnt', ['offen', 'angenommen']), 'dienstplan', 'Tausch abgelehnt', null, anfrageId)
}
