'use server'

import { sitzungStarten } from '@/lib/konten/anmeldung'
import { ladeKonto, passwortSetzen, sitzungenBeenden, totpSchrittMerken, wiederherstellungscodesSetzen, type Konto } from '@/lib/konten/daten'
import { passwortFehler, passwortHashErstellen, passwortPruefen } from '@/lib/konten/passwort'
import { codePruefen } from '@/lib/konten/totp'
import { entschluesseln } from '@/lib/konten/verschluesselung'
import { codesErzeugen } from '@/lib/konten/wiederherstellung'
import { rateLimitFehlgeschlagen, rateLimitPruefen, rateLimitZuruecksetzen, warteHinweis } from '@/lib/rateLimit'
import { getSitzung } from '@/lib/session'

// Einstellungen am eigenen Konto – für Plattform-Admin und Inhaber gleich.
// Das Konto kommt immer aus der Sitzung, nie aus einem Parameter.
async function eigenesKonto(): Promise<Konto> {
  const sitzung = await getSitzung()
  if (sitzung?.typ === 'plattform-admin') {
    const konto = await ladeKonto('admin', sitzung.kontoId)
    if (konto) return konto
  }
  if (sitzung?.typ === 'inhaber') {
    const konto = await ladeKonto('benutzer', sitzung.kontoId)
    if (konto) return konto
  }
  throw new Error('Nicht angemeldet')
}

// Sensible Änderungen verlangen das aktuelle Passwort bzw. einen frischen
// 2FA-Code – ein kurz unbeaufsichtigtes, angemeldetes Gerät reicht dafür
// nicht.
export async function passwortAendernAktion(altesPasswort: string, neuesPasswort: string): Promise<{ fehler?: string }> {
  const konto = await eigenesKonto()
  const sperrschluessel = `passwort-aendern:${konto.art}:${konto.id}`
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  if (!konto.passwortHash || !(await passwortPruefen(altesPasswort, konto.passwortHash))) {
    await rateLimitFehlgeschlagen(sperrschluessel, 5)
    return { fehler: 'Das aktuelle Passwort stimmt nicht.' }
  }
  const fehler = passwortFehler(neuesPasswort, konto.email)
  if (fehler) return { fehler }

  await rateLimitZuruecksetzen(sperrschluessel)
  await passwortSetzen(konto, await passwortHashErstellen(neuesPasswort))
  // Alle anderen Geräte sind jetzt abgemeldet, dieses bleibt angemeldet.
  await sitzungStarten({ ...konto, sitzungVersion: konto.sitzungVersion + 1 })
  return {}
}

export async function wiederherstellungscodesNeuAktion(code: string): Promise<{ fehler?: string; codes?: string[] }> {
  const konto = await eigenesKonto()
  const sperrschluessel = `2fa:${konto.art}:${konto.id}`
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const ergebnis = konto.totpGeheimnis ? codePruefen(entschluesseln(konto.totpGeheimnis), code, konto.totpLetzterSchritt) : { gueltig: false }
  if (!ergebnis.gueltig) {
    await rateLimitFehlgeschlagen(sperrschluessel, 5)
    return { fehler: 'Code ungültig.' }
  }
  await rateLimitZuruecksetzen(sperrschluessel)
  await totpSchrittMerken(konto, ergebnis.schritt!)
  const codes = codesErzeugen()
  await wiederherstellungscodesSetzen(konto, codes.hashes)
  return { codes: codes.klartext }
}

// Z. B. nach einem verlorenen Handy oder wenn man sich an einem fremden
// Rechner nicht abgemeldet hat. Dieses Gerät bleibt angemeldet.
export async function ueberallAbmeldenAktion(): Promise<{ fehler?: string }> {
  const konto = await eigenesKonto()
  await sitzungenBeenden(konto)
  await sitzungStarten({ ...konto, sitzungVersion: konto.sitzungVersion + 1 })
  return {}
}
