'use server'

// Mitarbeiter-Anmeldung/-Abmeldung – modulübergreifend (Zeiterfassung und
// Dienstplan teilen sich dieselbe Mitarbeiter-Sitzung, siehe auth.ts),
// deshalb hier statt in einem der beiden Module.

import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase/server'
import { getSitzung } from '@/lib/session'
import { pinHashPruefen } from '@/lib/pinHash'
import { rateLimitFehlgeschlagen, rateLimitPruefen, rateLimitZuruecksetzen } from '@/lib/rateLimit'
import { createMitarbeiterToken, MITARBEITER_COOKIE_NAME, MITARBEITER_MAX_AGE_SECONDS } from './auth'
import type { Mitarbeiter, MitarbeiterRolle, MitarbeiterTyp } from './types'

const SPERRE_AB_VERSUCHEN = 5

export async function mitarbeiterAnmelden(pin: string): Promise<{ fehler?: string; mitarbeiter?: Mitarbeiter }> {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') throw new Error('Nicht angemeldet')
  const organisationId = sitzung.organisationId

  // Gesperrt pro Organisation, nicht pro Mitarbeiter – der 4-stellige PIN
  // ist kurz genug, dass ein Angreifer sonst einfach einen anderen
  // Mitarbeiternamen/-code durchprobiert, um die Sperre zu umgehen.
  const sperrschluessel = `mitarbeiter:${organisationId}`
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) {
    const minuten = Math.ceil(sperre.wartenSekunden! / 60)
    return { fehler: `Zu viele Fehlversuche. Bitte in ${minuten} Minute${minuten === 1 ? '' : 'n'} erneut versuchen.` }
  }

  const supabase = getServiceClient()

  // Der PIN-Hash ist gesalzen (siehe lib/pinHash.ts) und kann deshalb
  // nicht direkt per Gleichheit gesucht werden – stattdessen alle aktiven
  // Mitarbeiter der Organisation laden und den PIN gegen jeden Hash
  // prüfen. Organisationen haben nur eine Handvoll Mitarbeiter, das bleibt
  // unproblematisch schnell.
  const { data } = await supabase
    .from('mitarbeiter')
    .select('id, name, rolle, mitarbeiter_typ, stunden_grenze, aktiv, pin_hash')
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

  const token = await createMitarbeiterToken({
    organisationId,
    mitarbeiterId: treffer.id as string,
    rolle: treffer.rolle as MitarbeiterRolle,
  })

  const cookieStore = await cookies()
  cookieStore.set(MITARBEITER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: MITARBEITER_MAX_AGE_SECONDS,
    path: '/',
  })

  return {
    mitarbeiter: {
      id: treffer.id as string,
      name: treffer.name as string,
      rolle: treffer.rolle as MitarbeiterRolle,
      mitarbeiterTyp: treffer.mitarbeiter_typ as MitarbeiterTyp,
      stundenGrenze: Number(treffer.stunden_grenze),
      aktiv: treffer.aktiv as boolean,
    },
  }
}

export async function mitarbeiterAbmelden() {
  const cookieStore = await cookies()
  cookieStore.delete(MITARBEITER_COOKIE_NAME)
}
