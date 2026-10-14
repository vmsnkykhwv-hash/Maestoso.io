'use server'

import { heuteBerlin } from '@/lib/datum'
import { ladeBestellEinstellungen, ladeBestellungenSchlankFuerTag, bestellungErstellenMitPruefung } from '@/lib/bestellung/daten'
import { bestellBenachrichtigungsMailSenden, bestellBestaetigungsMailSenden } from '@/lib/bestellung/email'
import { kanalAktiv, pruefeBestellung, verfuegbareBestellSlots } from '@/lib/bestellung/regeln'
import type { BestellKanal, BestellSlotVerfuegbarkeit } from '@/lib/bestellung/types'
import { ladeAusnahmeFuerDatum, ladeEinstellungen, organisationsName } from '@/lib/tischplan/daten'
import { ladeMenuEintraege, ladeMenuKategorien } from '@/lib/website/daten'
import { oeffentlicheAnfrageSchluessel, rateLimitFehlgeschlagen, rateLimitPruefen, warteHinweis } from '@/lib/rateLimit'
import type { MenuEintrag, MenuKategorie } from '@/lib/website/types'

const TELEFON_MUSTER = /^[0-9+()/ -]{5,20}$/
const SPERRE_AB_VERSUCHEN = 8

export async function organisationOeffentlichLadenAktion(organisationId: string): Promise<{ name: string } | null> {
  const name = await organisationsName(organisationId)
  return name ? { name } : null
}

export async function speisekarteLadenAktion(organisationId: string): Promise<{ kategorien: MenuKategorie[]; eintraege: MenuEintrag[] }> {
  const [kategorien, alleEintraege] = await Promise.all([ladeMenuKategorien(organisationId), ladeMenuEintraege(organisationId)])
  return { kategorien, eintraege: alleEintraege.filter((e) => e.aktiv) }
}

export async function kanaeleLadenAktion(organisationId: string): Promise<Record<BestellKanal, { moeglich: boolean; grund?: string }>> {
  const einstellungen = await ladeBestellEinstellungen(organisationId)
  return {
    abholung: { moeglich: kanalAktiv('abholung', einstellungen).aktiv, grund: kanalAktiv('abholung', einstellungen).grund },
    lieferung: { moeglich: kanalAktiv('lieferung', einstellungen).aktiv, grund: kanalAktiv('lieferung', einstellungen).grund },
  }
}

export async function bestellSlotsLadenAktion(organisationId: string, kanal: BestellKanal, datum: string): Promise<BestellSlotVerfuegbarkeit[]> {
  if (datum < heuteBerlin()) return []

  const [tischplanEinstellungen, bestellEinstellungen, bestellungenDesTages, ausnahme] = await Promise.all([
    ladeEinstellungen(organisationId),
    ladeBestellEinstellungen(organisationId),
    ladeBestellungenSchlankFuerTag(organisationId, datum),
    ladeAusnahmeFuerDatum(organisationId, datum),
  ])

  return verfuegbareBestellSlots({
    tischplanEinstellungen,
    bestellEinstellungen,
    kanal,
    datum,
    bestellungenDesTages,
    ausnahme,
  })
}

const MENGE_MAX = 50

export async function bestellungAnlegenAktion(input: {
  organisationId: string
  kanal: BestellKanal
  name: string
  telefon: string
  email?: string
  adresse?: string
  datum: string
  uhrzeit: string
  notiz?: string
  positionen: { eintragId: string; menge: number }[]
}): Promise<{ fehler?: string; erfolg?: boolean }> {
  const name = input.name.trim()
  const telefon = input.telefon.trim()
  const notiz = input.notiz?.trim().slice(0, 300) || null
  const adresse = input.adresse?.trim().slice(0, 200) || null

  if (name.length < 1 || name.length > 50) return { fehler: 'Bitte einen Namen angeben.' }
  if (!TELEFON_MUSTER.test(telefon)) return { fehler: 'Bitte eine gültige Telefonnummer angeben.' }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return { fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }
  if (input.kanal === 'lieferung' && !adresse) return { fehler: 'Für die Lieferung wird eine Adresse benötigt.' }
  if (input.positionen.length === 0) return { fehler: 'Der Warenkorb ist leer.' }
  if (input.datum < heuteBerlin()) return { fehler: 'Dieses Datum liegt in der Vergangenheit.' }

  // Spam-Schutz: pro Organisation + IP, nicht global – eine Spam-Welle gegen
  // eine Organisation soll nicht alle anderen mitbremsen.
  const sperrschluessel = await oeffentlicheAnfrageSchluessel('bestellung', input.organisationId)
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const organisationName = await organisationsName(input.organisationId)
  if (!organisationName) return { fehler: 'Diese Organisation wurde nicht gefunden.' }

  // Preise und Namen kommen ausschließlich aus der Speisekarte des Servers –
  // der Client schickt nur eintragId + menge, sonst könnte eine manipulierte
  // Anfrage beliebige Preise oder erfundene Positionen einschleusen.
  const speisekarte = await ladeMenuEintraege(input.organisationId)
  const speisekarteNachId = new Map(speisekarte.filter((e) => e.aktiv).map((e) => [e.id, e]))

  const positionen: { name: string; preis: number; menge: number }[] = []
  for (const p of input.positionen) {
    const eintrag = speisekarteNachId.get(p.eintragId)
    if (!eintrag) return { fehler: 'Ein Artikel im Warenkorb ist nicht (mehr) verfügbar.' }
    const menge = Math.floor(p.menge)
    if (!Number.isFinite(menge) || menge < 1 || menge > MENGE_MAX) return { fehler: 'Ungültige Menge im Warenkorb.' }
    positionen.push({ name: eintrag.name, preis: eintrag.preis, menge })
  }

  const [tischplanEinstellungen, bestellEinstellungen, bestellungenDesTages, ausnahme] = await Promise.all([
    ladeEinstellungen(input.organisationId),
    ladeBestellEinstellungen(input.organisationId),
    ladeBestellungenSchlankFuerTag(input.organisationId, input.datum),
    ladeAusnahmeFuerDatum(input.organisationId, input.datum),
  ])

  // Serverseitig nochmal exakt dieselbe Prüfung wie bei der Slot-Anzeige –
  // verhindert, dass zwischen Anzeige und Absenden der Kanal pausiert oder
  // die Kapazitätsgrenze erreicht wurde.
  const pruefung = pruefeBestellung({
    tischplanEinstellungen,
    bestellEinstellungen,
    kanal: input.kanal,
    datum: input.datum,
    uhrzeit: input.uhrzeit,
    bestellungenDesTages,
    ausnahme,
  })

  if (!pruefung.ok) return { fehler: pruefung.grund }

  await rateLimitFehlgeschlagen(sperrschluessel, SPERRE_AB_VERSUCHEN)

  const maxOffen = input.kanal === 'abholung' ? bestellEinstellungen.maxOffenAbholung : bestellEinstellungen.maxOffenLieferung

  const ergebnis = await bestellungErstellenMitPruefung(input.organisationId, {
    kanal: input.kanal,
    name,
    telefon,
    email: input.email?.trim() || null,
    adresse: input.kanal === 'lieferung' ? adresse : null,
    datum: input.datum,
    uhrzeit: input.uhrzeit,
    notiz,
    maxOffen,
    positionen,
  })

  if (ergebnis.fehler || !ergebnis.bestellung) {
    return { fehler: ergebnis.fehler ?? 'Bestellung konnte nicht gespeichert werden.' }
  }

  const bestellung = ergebnis.bestellung

  if (bestellung.email) {
    await bestellBestaetigungsMailSenden({
      organisationName,
      empfaenger: bestellung.email,
      name: bestellung.name,
      kanal: bestellung.kanal,
      datum: bestellung.datum,
      uhrzeit: bestellung.uhrzeit,
      gesamtPreis: bestellung.gesamtPreis,
      positionen: bestellung.positionen,
    })
  }

  if (bestellEinstellungen.benachrichtigungEmail) {
    await bestellBenachrichtigungsMailSenden({
      organisationName,
      empfaenger: bestellEinstellungen.benachrichtigungEmail,
      kanal: bestellung.kanal,
      name: bestellung.name,
      telefon: bestellung.telefon,
      datum: bestellung.datum,
      uhrzeit: bestellung.uhrzeit,
      gesamtPreis: bestellung.gesamtPreis,
      positionen: bestellung.positionen,
    })
  }

  return { erfolg: true }
}
