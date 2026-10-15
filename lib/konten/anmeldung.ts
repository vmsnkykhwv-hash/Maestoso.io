// Ablauf der Anmeldung mit persönlichem Konto, für Plattform-Admin und
// Inhaber gleich:
//   1. E-Mail + Passwort → Zwischen-Cookie "maestoso_anmeldung" (10 Minuten)
//   2a. 2FA aktiv: Code aus der Authenticator-App oder Wiederherstellungscode
//   2b. 2FA noch nicht eingerichtet: QR-Code scannen, ersten Code bestätigen,
//       Wiederherstellungscodes einmalig anzeigen
//   3. erst dann die eigentliche Sitzung
// Ohne zweiten Faktor gibt es keine Sitzung – auch nicht beim allerersten
// Mal, sonst wäre ein erratenes Passwort bei einem frisch eingeladenen Konto
// allein genug.
import { cookies } from 'next/headers'
import QRCode from 'qrcode'
import { createSessionToken, SESSION_COOKIE_NAME, sitzungGueltigkeitSekunden, type Sitzung } from '@/lib/auth'
import { rateLimitFehlgeschlagen, rateLimitPruefen, rateLimitZuruecksetzen, warteHinweis } from '@/lib/rateLimit'
import { tokenErstellen, tokenPruefen } from '@/lib/signiertesToken'
import {
  ladeKonto,
  ladeKontoPerEmail,
  totpAktivieren,
  totpGeheimnisSetzen,
  totpSchrittMerken,
  wiederherstellungscodesSetzen,
  type Konto,
  type KontoArt,
} from './daten'
import { passwortPruefen } from './passwort'
import { codePruefen, geheimnisErzeugen, otpauthUri } from './totp'
import { entschluesseln, verschluesseln } from './verschluesselung'
import { codeEinloesen, codesErzeugen } from './wiederherstellung'

const ANMELDUNG_COOKIE = 'maestoso_anmeldung'
const ANMELDUNG_GUELTIGKEIT_MS = 1000 * 60 * 10
const SPERRE_AB_VERSUCHEN = 5

// Gültig geformter, aber zu keinem Passwort passender Hash: wird bei
// unbekannter E-Mail trotzdem geprüft, damit die Antwortzeit nicht verrät,
// welche Adressen ein Konto haben.
const ATTRAPPEN_HASH = `${'0'.repeat(32)}:${'0'.repeat(64)}`

type Zwischenstand = { art: KontoArt; kontoId: string; schritt: '2fa' | 'einrichten' }

const COOKIE_OPTIONEN = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/' }

async function zwischenstandSetzen(stand: Zwischenstand) {
  const cookieStore = await cookies()
  cookieStore.set(ANMELDUNG_COOKIE, await tokenErstellen(stand, ANMELDUNG_GUELTIGKEIT_MS), {
    ...COOKIE_OPTIONEN,
    maxAge: ANMELDUNG_GUELTIGKEIT_MS / 1000,
  })
}

export async function zwischenstandLesen(): Promise<{ stand: Zwischenstand; konto: Konto } | null> {
  const cookieStore = await cookies()
  const stand = await tokenPruefen<Zwischenstand>(cookieStore.get(ANMELDUNG_COOKIE)?.value)
  if (!stand) return null
  const konto = await ladeKonto(stand.art, stand.kontoId)
  if (!konto || !konto.aktiv) return null
  return { stand, konto }
}

export async function anmeldungAbbrechen() {
  const cookieStore = await cookies()
  cookieStore.delete(ANMELDUNG_COOKIE)
}

function sitzungFuer(konto: Konto): Sitzung {
  if (konto.art === 'admin') return { typ: 'plattform-admin', kontoId: konto.id, version: konto.sitzungVersion }
  return { typ: 'inhaber', organisationId: konto.organisationId!, kontoId: konto.id, version: konto.sitzungVersion }
}

// Auch nach einer Passwortänderung: die alte Sitzung ist durch die neue
// sitzung_version ungültig, das aktuelle Gerät bekommt direkt eine neue.
export async function sitzungStarten(konto: Konto) {
  const cookieStore = await cookies()
  cookieStore.delete(ANMELDUNG_COOKIE)
  const sitzung = sitzungFuer(konto)
  cookieStore.set(SESSION_COOKIE_NAME, await createSessionToken(sitzung), {
    ...COOKIE_OPTIONEN,
    maxAge: sitzungGueltigkeitSekunden(sitzung),
  })
}

export async function passwortSchritt(
  art: KontoArt,
  email: string,
  passwort: string,
  organisationId?: string
): Promise<{ fehler?: string; schritt?: Zwischenstand['schritt'] }> {
  if (!email.trim() || !passwort) return { fehler: 'E-Mail und Passwort eingeben.' }

  const sperrschluessel = `passwort:${art}:${organisationId ?? '-'}:${email.trim().toLowerCase()}`
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const konto = await ladeKontoPerEmail(art, email, organisationId)
  const korrekt = await passwortPruefen(passwort, konto?.passwortHash ?? ATTRAPPEN_HASH)
  if (!konto || !konto.aktiv || !konto.passwortHash || !korrekt) {
    await rateLimitFehlgeschlagen(sperrschluessel, SPERRE_AB_VERSUCHEN)
    return { fehler: 'E-Mail oder Passwort falsch.' }
  }
  await rateLimitZuruecksetzen(sperrschluessel)
  return { schritt: await nachPasswort(konto) }
}

// Nach erfolgreichem Passwort – auch direkt nach Einladung oder "Passwort
// vergessen": weiter zum zweiten Faktor, nie direkt in die Sitzung.
export async function nachPasswort(konto: Konto): Promise<Zwischenstand['schritt']> {
  if (konto.totpAktiv) {
    await zwischenstandSetzen({ art: konto.art, kontoId: konto.id, schritt: '2fa' })
    return '2fa'
  }
  // Bei jedem neuen Einrichtungsversuch ein frisches Geheimnis: ein früher
  // gezeigter, aber nie bestätigter QR-Code wird damit wertlos.
  await totpGeheimnisSetzen(konto, verschluesseln(geheimnisErzeugen()))
  await zwischenstandSetzen({ art: konto.art, kontoId: konto.id, schritt: 'einrichten' })
  return 'einrichten'
}

export async function einrichtungsDaten(konto: Konto): Promise<{ qrSvg: string; geheimnis: string } | null> {
  if (!konto.totpGeheimnis) return null
  const geheimnis = entschluesseln(konto.totpGeheimnis)
  const qrSvg = await QRCode.toString(otpauthUri(konto.email, geheimnis), { type: 'svg', margin: 1, width: 200 })
  // Für die Anzeige zum Abtippen in Vierergruppen.
  return { qrSvg, geheimnis: geheimnis.match(/.{1,4}/g)!.join(' ') }
}

function zweiterFaktorSperre(konto: Konto): string {
  return `2fa:${konto.art}:${konto.id}`
}

export async function zweiterFaktorSchritt(eingabe: string): Promise<{ fehler?: string; konto?: Konto }> {
  const zwischen = await zwischenstandLesen()
  if (!zwischen || zwischen.stand.schritt !== '2fa') return { fehler: 'Anmeldung abgelaufen – bitte neu beginnen.' }
  const { konto } = zwischen

  const sperrschluessel = zweiterFaktorSperre(konto)
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const code = eingabe.trim()
  if (/^\d[\d\s]{5,6}$/.test(code)) {
    const ergebnis = codePruefen(entschluesseln(konto.totpGeheimnis!), code, konto.totpLetzterSchritt)
    if (ergebnis.gueltig) {
      await totpSchrittMerken(konto, ergebnis.schritt!)
      await rateLimitZuruecksetzen(sperrschluessel)
      await sitzungStarten(konto)
      return { konto }
    }
  } else {
    const rest = codeEinloesen(code, konto.wiederherstellungscodes)
    if (rest) {
      await wiederherstellungscodesSetzen(konto, rest)
      await rateLimitZuruecksetzen(sperrschluessel)
      await sitzungStarten(konto)
      return { konto }
    }
  }

  await rateLimitFehlgeschlagen(sperrschluessel, SPERRE_AB_VERSUCHEN)
  return { fehler: 'Code ungültig.' }
}

export async function einrichtungAbschliessen(eingabe: string): Promise<{ fehler?: string; codes?: string[]; konto?: Konto }> {
  const zwischen = await zwischenstandLesen()
  if (!zwischen || zwischen.stand.schritt !== 'einrichten' || !zwischen.konto.totpGeheimnis) {
    return { fehler: 'Einrichtung abgelaufen – bitte neu anmelden.' }
  }
  const { konto } = zwischen

  const sperrschluessel = zweiterFaktorSperre(konto)
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const ergebnis = codePruefen(entschluesseln(konto.totpGeheimnis!), eingabe, null)
  if (!ergebnis.gueltig) {
    await rateLimitFehlgeschlagen(sperrschluessel, SPERRE_AB_VERSUCHEN)
    return { fehler: 'Code stimmt nicht – Uhrzeit am Handy prüfen und den aktuellen Code eingeben.' }
  }

  const codes = codesErzeugen()
  await totpAktivieren(konto, ergebnis.schritt!, codes.hashes)
  await rateLimitZuruecksetzen(sperrschluessel)
  await sitzungStarten({ ...konto, totpAktiv: true })
  return { codes: codes.klartext, konto }
}

export async function abmelden() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  cookieStore.delete(ANMELDUNG_COOKIE)
}
