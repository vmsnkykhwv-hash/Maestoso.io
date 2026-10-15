// Geräte-Cookie (Tresen-Tablet bzw. gekoppeltes Mitarbeiter-Handy). Eigenes
// Cookie neben der Konto-Sitzung (sfp_session): meldet sich die Inhaberin am
// Tresen-Tablet an und wieder ab, bleibt das Tablet trotzdem freigegeben.
//
// Edge-kompatibel (nur Signatur) – proxy.ts liest es für die Zuordnung zum
// Betrieb; ob das Gerät inzwischen entzogen wurde, prüft lib/session.ts
// gegen die Datenbank.
import { tokenErstellen, tokenPruefen } from '@/lib/signiertesToken'

export type GeraeteToken = { geraetId: string; organisationId: string; art: 'tresen' | 'handy' }

export const GERAET_COOKIE_NAME = 'maestoso_geraet'

// 400 Tage ist die Obergrenze, die Browser für Cookies noch annehmen – das
// Tablet soll nicht alle paar Wochen neu freigegeben werden müssen.
export const GERAET_GUELTIGKEIT_SEKUNDEN = 60 * 60 * 24 * 400

export async function geraeteTokenErstellen(token: GeraeteToken): Promise<string> {
  return tokenErstellen(token, GERAET_GUELTIGKEIT_SEKUNDEN * 1000)
}

export async function geraeteTokenPruefen(wert: string | undefined | null): Promise<GeraeteToken | null> {
  return tokenPruefen<GeraeteToken>(wert)
}
