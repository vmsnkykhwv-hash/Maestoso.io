// Sitzungsarten der Plattform. Alles steckt in einem signierten Cookie
// (siehe lib/signiertesToken.ts), damit niemand den Inhalt fälschen kann.
// Persönliche Konten tragen zusätzlich ihre sitzung_version: lib/session.ts
// gleicht sie mit der Datenbank ab, so beendet eine Passwortänderung jede
// noch offene Sitzung dieses Kontos.
//
// Diese Datei ist auch von proxy.ts (Edge-Runtime) erreichbar – deshalb
// hier nur Signaturprüfung, keine Datenbank und kein node:crypto.

import { konstantZeitGleich, tokenErstellen, tokenPruefen } from '@/lib/signiertesToken'

export type Sitzung =
  | { typ: 'plattform-admin'; kontoId: string; version: number }
  | { typ: 'inhaber'; organisationId: string; kontoId: string; version: number }

const COOKIE_NAME = 'sfp_session'

// Admin kürzer als Inhaber: der Admin-Zugang sieht alle Betriebe.
const GUELTIGKEIT_MS: Record<Sitzung['typ'], number> = {
  'plattform-admin': 1000 * 60 * 60 * 12,
  inhaber: 1000 * 60 * 60 * 24 * 14,
}

export function sitzungGueltigkeitSekunden(sitzung: Sitzung): number {
  return GUELTIGKEIT_MS[sitzung.typ] / 1000
}

export async function createSessionToken(sitzung: Sitzung): Promise<string> {
  return tokenErstellen(sitzung, GUELTIGKEIT_MS[sitzung.typ])
}

export async function verifySessionToken(token: string | undefined | null): Promise<Sitzung | null> {
  return tokenPruefen<Sitzung>(token)
}

// Nur noch für die einmalige Ersteinrichtung des ersten Admin-Kontos.
// Konstante-Zeit-Vergleich, damit der PIN nicht byteweise über die
// Antwortzeit erraten werden kann.
export function pruefePlattformAdminPin(pin: string): boolean {
  const erwartet = process.env.PLATTFORM_ADMIN_PIN
  if (!erwartet) return false
  return konstantZeitGleich(pin, erwartet)
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
