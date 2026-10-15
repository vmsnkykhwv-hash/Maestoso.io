'use server'

import { getBetriebsSitzung } from '@/lib/session'
import { rechtlicheAngabenSpeichern } from '@/lib/rechtliches/daten'
import type { RechtlicheAngaben } from '@/lib/rechtliches/types'

export async function rechtlicheAngabenSpeichernAktion(angaben: RechtlicheAngaben): Promise<{ fehler?: string }> {
  const sitzung = await getBetriebsSitzung()
  if (!sitzung) return { fehler: 'Nicht angemeldet' }

  // Nur ganz grob – ein Tippfehler in der Impressums-Mail wäre schlimmer als
  // keine Prüfung, eine echte Zustellbarkeitsprüfung gibt es hier aber nicht.
  if (angaben.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(angaben.email.trim())) {
    return { fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }
  }

  return rechtlicheAngabenSpeichern(sitzung.organisationId, angaben)
}
