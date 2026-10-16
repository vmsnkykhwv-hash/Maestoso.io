'use server'

import { ladeMitarbeiter, ladeMitarbeiterNamen } from '@/lib/mitarbeiter/daten'
import { aktionFuer, verwaltungFuer } from '@/lib/zugriff'
import { ladeSchichtenFuerZeitraum } from '@/lib/dienstplan/daten'
import { organisationsName } from '@/lib/tischplan/daten'
import { heuteBerlin } from '@/lib/datum'
import {
  artikelAktualisieren,
  artikelErstellen,
  artikelLoeschen,
  eintragBestellungSetzen,
  eintragSetzen,
  eintraegeAlsBestelltMarkierenFuerOrganisation,
  eintraegeBestelltZuruecksetzenFuerOrganisation,
  ladeAktiveLieferanten,
  ladeAllePruefungen,
  ladeArtikel,
  ladeArtikelFuerLieferant,
  ladeBestellEintraegeNachIds,
  ladeLieferant,
  ladeLieferanten,
  ladeLieferantenNamen,
  ladeOffeneBestellEintraege,
  ladeOffenePruefungenFuerMitarbeiter,
  ladePruefung,
  ladePruefungEintraege,
  lieferantAktualisieren,
  lieferantErstellen,
  lieferantLoeschen,
  pruefungAlsErledigtMarkieren,
  pruefungErstellen,
  pruefungMitarbeiterZuweisen,
} from '@/lib/lager/daten'
import { bestellMailSenden } from '@/lib/lager/email'
import { pruefungFaelligkeit } from '@/lib/lager/regeln'
import type { Artikel, Bestandspruefung, BestandspruefungEintrag, Lieferant, OffenerBestellEintrag } from '@/lib/lager/types'
import { mitProtokoll, protokollieren } from '@/lib/protokoll'

// Lieferanten, Artikel, Zuweisen, Bestellen: nur Verwaltungskonto.
async function leitungOderFehler() {
  return verwaltungFuer('lager')
}

// Prüfungen durchführen: am Tresen per PIN (nicht vom Handy), oder das
// Verwaltungskonto. mitarbeiterId ist beim Verwaltungskonto null.
async function lagerSitzung(): Promise<{ organisationId: string; verwaltung: boolean; mitarbeiterId: string | null }> {
  const sitzung = await aktionFuer('lager', { ohneHandy: true })
  if (sitzung.art === 'inhaber') return { organisationId: sitzung.organisationId, verwaltung: true, mitarbeiterId: null }
  return { organisationId: sitzung.organisationId, verwaltung: false, mitarbeiterId: sitzung.mitarbeiter?.id ?? null }
}

function darfPruefung(sitzung: { verwaltung: boolean; mitarbeiterId: string | null }, pruefung: Bestandspruefung): boolean {
  return sitzung.verwaltung || (!!sitzung.mitarbeiterId && pruefung.zugewiesenerMitarbeiterId === sitzung.mitarbeiterId)
}

// Legt für jeden aktiven Lieferanten, dessen nächster Bestelltermin
// innerhalb seiner Vorlaufzeit liegt, eine Prüfung an (falls noch keine
// existiert) und weist sie automatisch der Person zu, die laut Dienstplan
// zwischen heute und dem Bestelltermin als Erste eine Schicht hat. Läuft
// bei jedem Öffnen des Moduls – kein Cron nötig, siehe 0006_lager.sql.
export async function pruefungenSicherstellenAktion(): Promise<void> {
  const sitzung = await lagerSitzung()
  const heute = heuteBerlin()
  const lieferanten = await ladeAktiveLieferanten(sitzung.organisationId)

  for (const lieferant of lieferanten) {
    const { bestelldatum, istFaellig } = pruefungFaelligkeit(lieferant, heute)
    if (!istFaellig) continue

    const schichtenImVorlauf = await ladeSchichtenFuerZeitraum(sitzung.organisationId, heute, bestelldatum)
    const ersteZuweisung = schichtenImVorlauf.find((s) => s.mitarbeiterId)?.mitarbeiterId ?? null

    await pruefungErstellen(sitzung.organisationId, lieferant.id, bestelldatum, ersteZuweisung)
  }
}

export async function meinePruefungenLadenAktion(): Promise<Bestandspruefung[]> {
  const sitzung = await lagerSitzung()
  if (!sitzung.mitarbeiterId) return []
  return ladeOffenePruefungenFuerMitarbeiter(sitzung.mitarbeiterId)
}

export async function allePruefungenLadenAktion(): Promise<Bestandspruefung[]> {
  const sitzung = await leitungOderFehler()
  return ladeAllePruefungen(sitzung.organisationId)
}

export async function pruefungZuweisenAktion(pruefungId: string, mitarbeiterId: string | null): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()
  // Die ID kommt vom Client – nur Mitarbeitende des eigenen Betriebs.
  if (mitarbeiterId && !(await ladeMitarbeiter(mitarbeiterId, sitzung.organisationId))) return { fehler: 'Mitarbeiter nicht gefunden' }
  return mitProtokoll(pruefungMitarbeiterZuweisen(pruefungId, sitzung.organisationId, mitarbeiterId), 'lager', 'Prüfung zugewiesen', null, pruefungId)
}

export async function pruefungDetailsLadenAktion(
  pruefungId: string
): Promise<{ fehler?: string; pruefung?: Bestandspruefung; artikel?: Artikel[]; eintraege?: BestandspruefungEintrag[] }> {
  const sitzung = await lagerSitzung()
  const pruefung = await ladePruefung(pruefungId, sitzung.organisationId)
  if (!pruefung) return { fehler: 'Prüfung nicht gefunden' }
  if (!darfPruefung(sitzung, pruefung)) return { fehler: 'Keine Berechtigung' }

  const [artikel, eintraege] = await Promise.all([
    ladeArtikelFuerLieferant(pruefung.lieferantId),
    ladePruefungEintraege(pruefungId),
  ])

  return { pruefung, artikel: artikel.filter((a) => a.aktiv), eintraege }
}

export async function eintragSetzenAktion(
  pruefungId: string,
  artikelId: string,
  nachbestellen: boolean,
  aktuellerBestand: string
): Promise<{ fehler?: string }> {
  const sitzung = await lagerSitzung()
  const pruefung = await ladePruefung(pruefungId, sitzung.organisationId)
  if (!pruefung) return { fehler: 'Prüfung nicht gefunden' }
  if (!darfPruefung(sitzung, pruefung)) return { fehler: 'Keine Berechtigung' }
  // Nur Artikel des Lieferanten dieser Prüfung – die ID kommt vom Client.
  const artikel = await ladeArtikelFuerLieferant(pruefung.lieferantId)
  if (!artikel.some((a) => a.id === artikelId)) return { fehler: 'Artikel nicht gefunden' }
  return eintragSetzen(pruefungId, artikelId, nachbestellen, aktuellerBestand.trim() || null)
}

export async function pruefungAbschliessenAktion(pruefungId: string): Promise<{ fehler?: string }> {
  const sitzung = await lagerSitzung()
  const pruefung = await ladePruefung(pruefungId, sitzung.organisationId)
  if (!pruefung) return { fehler: 'Prüfung nicht gefunden' }
  if (!darfPruefung(sitzung, pruefung)) return { fehler: 'Keine Berechtigung' }
  return mitProtokoll(pruefungAlsErledigtMarkieren(pruefungId, sitzung.organisationId), 'lager', 'Prüfung abgeschlossen', null, pruefungId)
}

export async function lieferantenLadenAktion(): Promise<Lieferant[]> {
  const sitzung = await leitungOderFehler()
  return ladeLieferanten(sitzung.organisationId)
}

export async function lieferantErstellenAktion(input: {
  name: string
  kontaktEmail?: string
  kontaktTelefon?: string
  ansprechpartner?: string
  kundennummer?: string
  notiz?: string
  zyklusTyp: Lieferant['zyklusTyp']
  wochentage: number[]
  tagImMonat: number | null
  vorlaufTage: number
}): Promise<{ fehler?: string; lieferant?: Lieferant }> {
  const sitzung = await leitungOderFehler()
  return mitProtokoll(lieferantErstellen(sitzung.organisationId, input), 'lager', 'Lieferant angelegt', input.name, null)
}

export async function lieferantAktualisierenAktion(
  id: string,
  patch: Partial<{
    name: string
    kontaktEmail: string | null
    kontaktTelefon: string | null
    ansprechpartner: string | null
    kundennummer: string | null
    notiz: string | null
    zyklusTyp: Lieferant['zyklusTyp']
    wochentage: number[]
    tagImMonat: number | null
    vorlaufTage: number
    aktiv: boolean
  }>
): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()
  return mitProtokoll(lieferantAktualisieren(id, sitzung.organisationId, patch), 'lager', 'Lieferant geändert', null, id)
}

export async function lieferantLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()
  return mitProtokoll(lieferantLoeschen(id, sitzung.organisationId), 'lager', 'Lieferant gelöscht', null, id)
}

export async function artikelAlleLadenAktion(): Promise<Artikel[]> {
  const sitzung = await leitungOderFehler()
  return ladeArtikel(sitzung.organisationId)
}

export async function artikelErstellenAktion(input: {
  lieferantId: string
  name: string
  einheit: string
  mindestbestand: number
  notiz?: string
}): Promise<{ fehler?: string; artikel?: Artikel }> {
  const sitzung = await leitungOderFehler()
  const lieferant = await ladeLieferant(input.lieferantId, sitzung.organisationId)
  if (!lieferant) return { fehler: 'Lieferant nicht gefunden' }
  return mitProtokoll(artikelErstellen(sitzung.organisationId, input), 'lager', 'Artikel angelegt', input.name, null)
}

export async function artikelAktualisierenAktion(
  id: string,
  patch: Partial<{ name: string; einheit: string; mindestbestand: number; notiz: string | null; aktiv: boolean }>
): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()
  return mitProtokoll(artikelAktualisieren(id, sitzung.organisationId, patch), 'lager', 'Artikel geändert', null, id)
}

export async function artikelLoeschenAktion(id: string): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()
  return mitProtokoll(artikelLoeschen(id, sitzung.organisationId), 'lager', 'Artikel gelöscht', null, id)
}

export async function mitarbeiterNamenLadenAktion(): Promise<{ id: string; name: string }[]> {
  const sitzung = await lagerSitzung()
  return ladeMitarbeiterNamen(sitzung.organisationId)
}

export async function lieferantenNamenLadenAktion(): Promise<{ id: string; name: string }[]> {
  const sitzung = await lagerSitzung()
  return ladeLieferantenNamen(sitzung.organisationId)
}

export async function offeneBestellEintraegeLadenAktion(): Promise<OffenerBestellEintrag[]> {
  const sitzung = await leitungOderFehler()
  return ladeOffeneBestellEintraege(sitzung.organisationId)
}

export async function eintragBestellungSetzenAktion(
  pruefungId: string,
  artikelId: string,
  bestellmenge: string
): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()
  const pruefung = await ladePruefung(pruefungId, sitzung.organisationId)
  if (!pruefung) return { fehler: 'Prüfung nicht gefunden' }
  return eintragBestellungSetzen(pruefungId, artikelId, bestellmenge.trim() || null)
}

// Lädt den Entwurf frisch aus der Datenbank (statt dem Client zu vertrauen)
// und verschickt ihn erst, wenn die Leitung im Bestellung-Tab bewusst auf
// "Jetzt senden" gedrückt hat – siehe lib/lager/email.ts.
export async function bestellungSendenAktion(lieferantId: string, eintragIds: string[]): Promise<{ fehler?: string }> {
  const sitzung = await leitungOderFehler()
  if (eintragIds.length === 0) return { fehler: 'Keine Artikel ausgewählt.' }

  const lieferant = await ladeLieferant(lieferantId, sitzung.organisationId)
  if (!lieferant) return { fehler: 'Lieferant nicht gefunden' }
  if (!lieferant.kontaktEmail) return { fehler: 'Für diesen Lieferanten ist keine E-Mail-Adresse hinterlegt.' }

  const positionen = await ladeBestellEintraegeNachIds(sitzung.organisationId, eintragIds)
  if (positionen.length !== eintragIds.length) return { fehler: 'Einige Artikel wurden nicht gefunden.' }
  const unvollstaendig = positionen.find((p) => !p.bestellmenge?.trim())
  if (unvollstaendig) return { fehler: `Bitte für "${unvollstaendig.artikelName}" eine Bestellmenge eintragen.` }

  // Erst beanspruchen, dann verschicken – nicht umgekehrt, sonst könnte ein
  // Doppelklick zwei Mails an den Lieferanten auslösen, bevor der erste
  // Durchlauf fertig markiert hat.
  const beansprucht = await eintraegeAlsBestelltMarkierenFuerOrganisation(sitzung.organisationId, eintragIds)
  if (beansprucht.length === 0) return {}
  if (beansprucht.length !== eintragIds.length) {
    await eintraegeBestelltZuruecksetzenFuerOrganisation(sitzung.organisationId, beansprucht)
    return { fehler: 'Ein Teil dieser Bestellung wurde bereits gesendet – bitte die Seite neu laden.' }
  }

  const organisationName = await organisationsName(sitzung.organisationId)
  if (!organisationName) {
    await eintraegeBestelltZuruecksetzenFuerOrganisation(sitzung.organisationId, beansprucht)
    return { fehler: 'Organisation nicht gefunden' }
  }

  const ergebnis = await bestellMailSenden({
    organisationName,
    empfaenger: lieferant.kontaktEmail,
    ansprechpartner: lieferant.ansprechpartner,
    kundennummer: lieferant.kundennummer,
    positionen: positionen.map((p) => ({ name: p.artikelName, einheit: p.einheit, menge: p.bestellmenge! })),
  })
  if (ergebnis.fehler) {
    await eintraegeBestelltZuruecksetzenFuerOrganisation(sitzung.organisationId, beansprucht)
    return { fehler: `Die Mail an den Lieferanten ging nicht raus, die Bestellung ist weiter offen. (${ergebnis.fehler})` }
  }

  await protokollieren('lager', 'Bestellung an Lieferant gesendet', `${eintragIds.length} Position(en)`, lieferantId)
  return {}
}
