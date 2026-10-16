'use server'

import { anfrageAktualisieren, type AnfrageStatus } from '@/lib/anfragen/daten'
import { getSitzung } from '@/lib/session'

const STATUS: AnfrageStatus[] = ['neu', 'in_bearbeitung', 'erledigt']

// Server Actions sind ohne die Seite aufrufbar – deshalb hier selbst prüfen.
export async function anfrageAktualisierenAktion(
  id: string,
  patch: { status?: AnfrageStatus; notiz?: string }
): Promise<{ fehler?: string }> {
  const sitzung = await getSitzung()
  if (sitzung?.typ !== 'plattform-admin') return { fehler: 'Keine Berechtigung' }
  if (patch.status && !STATUS.includes(patch.status)) return { fehler: 'Unbekannter Status' }
  const ok = await anfrageAktualisieren(id, {
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.notiz !== undefined ? { notiz: patch.notiz.trim().slice(0, 2000) || null } : {}),
  })
  return ok ? {} : { fehler: 'Speichern fehlgeschlagen' }
}
