'use server'

// PIN-Anmeldung am Tresen-Gerät: wer gerade am Tablet arbeitet. Gilt für
// alle Module gleichzeitig (siehe app/dashboard/TresenAnmeldung.tsx).

import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase/server'
import { getBetriebsSitzung } from '@/lib/session'
import { pinHashPruefen } from '@/lib/pinHash'
import { rateLimitFehlgeschlagen, rateLimitPruefen, rateLimitZuruecksetzen, warteHinweis } from '@/lib/rateLimit'
import { createMitarbeiterToken, MITARBEITER_COOKIE_NAME, MITARBEITER_MAX_AGE_SECONDS } from './auth'
import { MITARBEITER_SPALTEN, mitarbeiterAusZeile } from './daten'

const SPERRE_AB_VERSUCHEN = 5

export async function mitarbeiterAnmelden(pin: string): Promise<{ fehler?: string }> {
  const sitzung = await getBetriebsSitzung()
  // Nur an einem freigegebenen Tresen-Gerät – sonst ließe sich mit einer
  // 4-stelligen PIN von irgendwo aus ins Tagesgeschäft.
  if (sitzung?.art !== 'tresen') return { fehler: 'Die PIN-Anmeldung geht nur am Tresen-Gerät.' }
  const organisationId = sitzung.organisationId

  // Gesperrt pro Organisation, nicht pro Mitarbeiter – der 4-stellige PIN
  // ist kurz genug, dass ein Angreifer sonst einfach einen anderen
  // Mitarbeiternamen/-code durchprobiert, um die Sperre zu umgehen.
  const sperrschluessel = `mitarbeiter:${organisationId}`
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const supabase = getServiceClient()

  // Der PIN-Hash ist gesalzen (siehe lib/pinHash.ts) und kann deshalb
  // nicht direkt per Gleichheit gesucht werden – stattdessen alle aktiven
  // Mitarbeiter der Organisation laden und den PIN gegen jeden Hash
  // prüfen. Organisationen haben nur eine Handvoll Mitarbeiter, das bleibt
  // unproblematisch schnell.
  const { data } = await supabase
    .from('mitarbeiter')
    .select(`${MITARBEITER_SPALTEN}, pin_hash`)
    .eq('organisation_id', organisationId)
    .eq('aktiv', true)

  let treffer: Record<string, unknown> | null = null
  for (const kandidat of data ?? []) {
    if (await pinHashPruefen(pin, kandidat.pin_hash as string)) {
      treffer = kandidat
      break
    }
  }

  if (!treffer) {
    await rateLimitFehlgeschlagen(sperrschluessel, SPERRE_AB_VERSUCHEN)
    return { fehler: 'Falscher PIN' }
  }

  await rateLimitZuruecksetzen(sperrschluessel)
  const mitarbeiter = mitarbeiterAusZeile(treffer)

  const token = await createMitarbeiterToken({ organisationId, mitarbeiterId: mitarbeiter.id, rolle: mitarbeiter.rolle })
  const cookieStore = await cookies()
  cookieStore.set(MITARBEITER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: MITARBEITER_MAX_AGE_SECONDS,
    path: '/',
  })
  return {}
}

export async function mitarbeiterAbmelden() {
  const cookieStore = await cookies()
  cookieStore.delete(MITARBEITER_COOKIE_NAME)
}
