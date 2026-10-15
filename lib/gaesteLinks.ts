import { headers } from 'next/headers'
import { internerPfad, ORG_HOST_HEADER } from '@/lib/gaestePfade'

// Relativer Link auf eine Gästeseite für Server-Komponenten: auf der Domain
// des Betriebs kurz (/impressum), sonst die interne Route mit ID. So sieht
// ein Gast auf musterbetrieb.de nie eine Adresse mit maestoso oder UUID.
export async function gaesteHref(organisationId: string, pfad: string): Promise<string> {
  const h = await headers()
  if (h.get(ORG_HOST_HEADER) === organisationId) return pfad
  return internerPfad(organisationId, pfad)
}

// Wie gaesteHref, für den Team-Bereich (Anmeldung, Einladung, Passwort
// vergessen): auf der Domain des Betriebs /team…, sonst /team/<id>….
export async function teamHref(organisationId: string, pfad = ''): Promise<string> {
  const h = await headers()
  if (h.get(ORG_HOST_HEADER) === organisationId) return `/team${pfad}`
  return `/team/${organisationId}${pfad}`
}
