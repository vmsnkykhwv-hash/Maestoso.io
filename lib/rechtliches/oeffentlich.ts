import { ladeFreischaltungen } from '@/lib/organisationen'
import { organisationsName } from '@/lib/tischplan/daten'
import { ladeRechtlicheAngaben } from './daten'
import { angabenVollstaendig } from './types'

// Alles, was die öffentlichen Impressum-/Datenschutzseiten eines Betriebs
// brauchen. null, wenn es die Organisation nicht gibt.
export async function ladeRechtsseitenDaten(organisationId: string) {
  const name = await organisationsName(organisationId)
  if (!name) return null

  const [angaben, freischaltungen] = await Promise.all([
    ladeRechtlicheAngaben(organisationId),
    ladeFreischaltungen(organisationId),
  ])
  return { name, angaben, freischaltungen, vollstaendig: angabenVollstaendig(angaben) }
}
