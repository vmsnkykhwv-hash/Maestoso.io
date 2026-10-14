// Mitarbeiter-Login innerhalb eines bereits eingeloggten Organisations-
// Kontos: ein PIN pro Mitarbeiter (kein eigenes Supabase-Auth-Konto wie im
// Einzelkunden-Original, da der Login hier schon pro Organisation läuft –
// das wäre doppelt). Eigener, zweiter signierter Cookie, unabhängig vom
// Organisations-Cookie (lib/auth.ts), damit ein Rollenwechsel (z. B.
// Schichtende, nächster Mitarbeiter meldet sich an) nichts an der
// Organisations-Sitzung ändert.
//
// Von Zeiterfassung und Dienstplan gemeinsam genutzt: dieselbe
// Mitarbeiter-Sitzung gilt modulübergreifend, ein Mitarbeiter muss sich
// beim Wechsel zwischen beiden Modulen nicht erneut anmelden.

import { tokenErstellen, tokenPruefen } from '@/lib/signiertesToken'
import type { MitarbeiterRolle } from './types'

export type MitarbeiterSitzung = {
  organisationId: string
  mitarbeiterId: string
  rolle: MitarbeiterRolle
}

const COOKIE_NAME = 'sfp_mitarbeiter'
const GUELTIGKEIT_MS = 1000 * 60 * 60 * 14 // 14 Stunden, länger als eine Schicht

export async function createMitarbeiterToken(sitzung: MitarbeiterSitzung): Promise<string> {
  return tokenErstellen(sitzung, GUELTIGKEIT_MS)
}

export async function verifyMitarbeiterToken(token: string | undefined | null): Promise<MitarbeiterSitzung | null> {
  return tokenPruefen<MitarbeiterSitzung>(token)
}

// PIN-Hashing: siehe lib/pinHash.ts (node:crypto/scrypt, nicht hier).

export const MITARBEITER_COOKIE_NAME = COOKIE_NAME
export const MITARBEITER_MAX_AGE_SECONDS = GUELTIGKEIT_MS / 1000
