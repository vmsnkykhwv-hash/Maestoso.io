'use server'

import { verwaltungFuer } from '@/lib/zugriff'
import { rechtlicheAngabenSpeichern } from '@/lib/rechtliches/daten'
import type { RechtlicheAngaben } from '@/lib/rechtliches/types'
import { mitProtokoll } from '@/lib/protokoll'

export async function rechtlicheAngabenSpeichernAktion(angaben: RechtlicheAngaben): Promise<{ fehler?: string }> {
  const sitzung = await verwaltungFuer(null).catch(() => null)
  if (!sitzung) return { fehler: 'Keine Berechtigung' }

  // Nur ganz grob – ein Tippfehler in der Impressums-Mail wäre schlimmer als
  // keine Prüfung, eine echte Zustellbarkeitsprüfung gibt es hier aber nicht.
  if (angaben.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(angaben.email.trim())) {
    return { fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }
  }

  return mitProtokoll(rechtlicheAngabenSpeichern(sitzung.organisationId, angaben), 'rechtliches', 'Angaben geändert', null, null)
}
