'use server'

import { benutzerAnlegen, ladeBenutzerDerOrganisation, type BenutzerUebersicht } from '@/lib/konten/einladung'
import { einladungVerschicken } from '@/lib/konten/einladungVersand'
import { ladeKonto, sitzungenBeenden } from '@/lib/konten/daten'
import { getBetriebsSitzung } from '@/lib/session'
import { getServiceClient } from '@/lib/supabase/server'

async function inhaberOderFehler() {
  const sitzung = await getBetriebsSitzung()
  if (sitzung?.art !== 'inhaber') throw new Error('Keine Berechtigung')
  return sitzung
}

export async function kontoEinladenAktion(
  email: string,
  name: string
): Promise<{ fehler?: string; link?: string; versendet?: boolean; benutzer?: BenutzerUebersicht[] }> {
  const sitzung = await inhaberOderFehler()
  const angelegt = await benutzerAnlegen(sitzung.organisationId, email, name)
  if (!angelegt.benutzerId) return { fehler: angelegt.fehler }
  const einladung = await einladungVerschicken(sitzung.organisationId, angelegt.benutzerId, email)
  return { ...einladung, benutzer: await ladeBenutzerDerOrganisation(sitzung.organisationId) }
}

export async function kontoEinladungErneuernAktion(benutzerId: string): Promise<{ fehler?: string; link?: string; versendet?: boolean }> {
  const sitzung = await inhaberOderFehler()
  const konto = await ladeKonto('benutzer', benutzerId)
  if (!konto || konto.organisationId !== sitzung.organisationId) return { fehler: 'Konto nicht gefunden.' }
  if (konto.passwortHash) return { fehler: 'Das Konto ist schon eingerichtet.' }
  return einladungVerschicken(sitzung.organisationId, benutzerId, konto.email)
}

// Sich selbst zu sperren ginge nur aus Versehen – und dann käme niemand
// mehr ins Dashboard, wenn es das einzige Konto ist.
export async function kontoAktivSetzenAktion(benutzerId: string, aktiv: boolean): Promise<{ fehler?: string; benutzer?: BenutzerUebersicht[] }> {
  const sitzung = await inhaberOderFehler()
  if (benutzerId === sitzung.kontoId) return { fehler: 'Das eigene Konto kann nicht gesperrt werden.' }
  const konto = await ladeKonto('benutzer', benutzerId)
  if (!konto || konto.organisationId !== sitzung.organisationId) return { fehler: 'Konto nicht gefunden.' }

  const { error } = await getServiceClient().from('benutzer').update({ aktiv }).eq('id', benutzerId).eq('organisation_id', sitzung.organisationId)
  if (error) return { fehler: error.message }
  if (!aktiv) await sitzungenBeenden(konto)
  return { benutzer: await ladeBenutzerDerOrganisation(sitzung.organisationId) }
}
