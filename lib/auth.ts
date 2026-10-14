// Zwei Zugangsarten statt eines einfachen Rollen-Strings wie im
// Kassentraining: eine Organisation (ein Kunde/Interessent) ODER der
// Plattform-Admin (du, verwaltet Organisationen und Freischaltungen).
// Beides steckt in einem signierten Cookie (siehe lib/signiertesToken.ts),
// damit niemand den Cookie-Inhalt einfach fälschen kann.

import { konstantZeitGleich, tokenErstellen, tokenPruefen } from '@/lib/signiertesToken'

export type Sitzung =
  | { typ: 'organisation'; organisationId: string }
  | { typ: 'plattform-admin' }

const COOKIE_NAME = 'sfp_session'
const GUELTIGKEIT_MS = 1000 * 60 * 60 * 24 * 7 // 7 Tage

export async function createSessionToken(sitzung: Sitzung): Promise<string> {
  return tokenErstellen(sitzung, GUELTIGKEIT_MS)
}

export async function verifySessionToken(token: string | undefined | null): Promise<Sitzung | null> {
  return tokenPruefen<Sitzung>(token)
}

// PIN-Hashing (Organisation/Mitarbeiter) lebt in lib/pinHash.ts, nicht
// hier – diese Datei ist auch von proxy.ts (Edge-Runtime) erreichbar, und
// node:crypto (für scrypt) gibt es dort nicht.

// Konstante-Zeit-Vergleich, damit ein Angreifer den Admin-PIN nicht
// byteweise über die Antwortzeit erraten kann.
export function pruefePlattformAdminPin(pin: string): boolean {
  const erwartet = process.env.PLATTFORM_ADMIN_PIN
  if (!erwartet) return false
  return konstantZeitGleich(pin, erwartet)
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
export const SESSION_MAX_AGE_SECONDS = GUELTIGKEIT_MS / 1000
