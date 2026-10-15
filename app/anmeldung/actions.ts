'use server'

import { pruefePlattformAdminPin } from '@/lib/auth'
import { adminAnlegen, adminVorhanden, benutzerNameSetzen, ladeKontoPerEmail, passwortSetzen } from '@/lib/konten/daten'
import {
  anmeldungAbbrechen,
  einrichtungAbschliessen,
  nachPasswort,
  passwortSchritt,
  zweiterFaktorSchritt,
} from '@/lib/konten/anmeldung'
import { passwortLinkSenden } from '@/lib/konten/email'
import { tokenEinloesen, tokenErstellen, tokenPruefenFuer, type TokenZweck } from '@/lib/konten/einladung'
import { passwortFehler, passwortHashErstellen } from '@/lib/konten/passwort'
import { rateLimitFehlgeschlagen, rateLimitPruefen, warteHinweis } from '@/lib/rateLimit'
import { organisationsName } from '@/lib/tischplan/daten'
import { teamUrl } from '@/lib/url'
import type { KontoArt } from '@/lib/konten/daten'

// Die Organisation kommt hier vom Client (aus der aufgerufenen /team-Seite).
// Das ist unbedenklich: gesucht wird nur innerhalb dieser Organisation, und
// die Sitzung bekommt die Organisation aus dem gefundenen Konto, nicht aus
// dem Parameter.
export async function passwortAktion(art: KontoArt, email: string, passwort: string, organisationId?: string) {
  return passwortSchritt(art, email, passwort, art === 'benutzer' ? organisationId : undefined)
}

export async function zweiterFaktorAktion(code: string): Promise<{ fehler?: string }> {
  const ergebnis = await zweiterFaktorSchritt(code)
  return ergebnis.fehler ? { fehler: ergebnis.fehler } : {}
}

export async function einrichtungAktion(code: string): Promise<{ fehler?: string; codes?: string[] }> {
  const ergebnis = await einrichtungAbschliessen(code)
  return ergebnis.fehler ? { fehler: ergebnis.fehler } : { codes: ergebnis.codes }
}

export async function abbrechenAktion(): Promise<void> {
  await anmeldungAbbrechen()
}

// Einmalig: Solange es noch kein Admin-Konto gibt, legt der alte
// PLATTFORM_ADMIN_PIN aus der Umgebung das erste an. Danach ist der PIN
// wirkungslos.
export async function ersteinrichtungAktion(pin: string, email: string, passwort: string): Promise<{ fehler?: string }> {
  const sperre = await rateLimitPruefen('admin-ersteinrichtung')
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }
  if (await adminVorhanden()) return { fehler: 'Es gibt bereits ein Admin-Konto.' }
  if (!pruefePlattformAdminPin(pin)) {
    await rateLimitFehlgeschlagen('admin-ersteinrichtung', 5)
    return { fehler: 'PIN falsch.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }
  const fehler = passwortFehler(passwort, email)
  if (fehler) return { fehler }

  const ergebnis = await adminAnlegen(email, await passwortHashErstellen(passwort))
  if (ergebnis.fehler || !ergebnis.konto) return { fehler: ergebnis.fehler }
  await nachPasswort(ergebnis.konto)
  return {}
}

// "Passwort vergessen": Antwort immer gleich, egal ob es das Konto gibt –
// sonst ließe sich darüber herausfinden, welche Adressen ein Konto haben.
export async function passwortVergessenAktion(organisationId: string, email: string): Promise<{ fehler?: string }> {
  const sperrschluessel = `passwort-vergessen:${organisationId}:${email.trim().toLowerCase()}`
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }
  // Jede Anfrage zählt, nicht nur Fehlschläge: sonst ließe sich jemandem das
  // Postfach mit Reset-Mails fluten.
  await rateLimitFehlgeschlagen(sperrschluessel, 3)

  const konto = await ladeKontoPerEmail('benutzer', email, organisationId)
  if (konto && konto.aktiv && konto.passwortHash) {
    const token = await tokenErstellen(konto.id, 'passwort')
    const betrieb = (await organisationsName(organisationId)) ?? 'deinen Betrieb'
    await passwortLinkSenden(konto.email, betrieb, await teamUrl(organisationId, `/passwort-neu?token=${encodeURIComponent(token)}`))
  }
  return {}
}

// Für Einladung und "Passwort vergessen": Passwort festlegen und danach
// direkt zum zweiten Faktor (Einrichtung bzw. Abfrage).
export async function passwortFestlegenAktion(
  organisationId: string,
  zweck: TokenZweck,
  token: string,
  passwort: string,
  name?: string
): Promise<{ fehler?: string }> {
  const gefunden = await tokenPruefenFuer(token, zweck, organisationId)
  if (!gefunden) return { fehler: 'Der Link ist ungültig oder abgelaufen.' }
  const fehler = passwortFehler(passwort, gefunden.konto.email)
  if (fehler) return { fehler }
  if (!(await tokenEinloesen(gefunden.tokenId))) return { fehler: 'Der Link wurde bereits benutzt.' }

  await passwortSetzen(gefunden.konto, await passwortHashErstellen(passwort))
  if (zweck === 'einladung' && name?.trim()) await benutzerNameSetzen(gefunden.konto.id, name)
  await nachPasswort({ ...gefunden.konto, sitzungVersion: gefunden.konto.sitzungVersion + 1 })
  return {}
}
