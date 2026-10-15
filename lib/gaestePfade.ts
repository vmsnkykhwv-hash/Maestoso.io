// Öffentliche Gästepfade auf der Domain eines Betriebs (Subdomain oder
// eigene Domain) und ihre internen Next.js-Routen. Reine Funktionen ohne
// Imports, weil proxy.ts (Edge-Runtime) sie genauso braucht wie
// Server-Komponenten beim Bauen von Links – eine Quelle statt zwei, die
// auseinanderlaufen könnten.
//
// Auf der Domain des Betriebs heißt es musterbetrieb.de/reservieren, intern
// /reservieren/<organisationId>. Ohne Plattform-Domain (lokale Entwicklung)
// gibt es nur die internen Pfade.

export const GAESTE_ROUTEN = ['reservieren', 'bestellen', 'gutschein', 'veranstaltung'] as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function istUuid(wert: string | undefined): boolean {
  return !!wert && UUID.test(wert)
}

function istGaesteRoute(segment: string | undefined): boolean {
  return !!segment && (GAESTE_ROUTEN as readonly string[]).includes(segment)
}

// Pfade, die auf der Domain eines Betriebs NICHT zur Website gehören und
// unverändert durchgereicht werden.
const DURCHREICHEN = ['api', 'dashboard', 'team']

// Eingehender Pfad auf der Domain eines Betriebs → öffentlicher Pfad.
// Akzeptiert auch die alten Formen mit ID (/reservieren/<id>,
// /website/<id>/impressum), die ID wird dabei verworfen: maßgeblich ist
// immer die Organisation des Hosts, sonst ließe sich unter
// musterbetrieb.de die Seite eines fremden Betriebs anzeigen.
// null = kein Gästepfad, nicht umschreiben.
export function oeffentlicherPfadAus(pathname: string): string | null {
  const teile = pathname.split('/').filter(Boolean)
  if (DURCHREICHEN.includes(teile[0])) return null
  if (teile[0] === 'website') teile.splice(0, 2)
  else if (istGaesteRoute(teile[0]) && teile[1] && UUID.test(teile[1])) teile.splice(1, 1)
  return '/' + teile.join('/')
}

// Öffentlicher Pfad → interne Route. Unbekannte Pfade landen auf der
// Startseite der Website statt auf einer Fehlerseite.
export function internerPfad(organisationId: string, oeffentlich: string): string {
  const teile = oeffentlich.split('/').filter(Boolean)
  if (teile.length === 0) return `/website/${organisationId}`
  if (istGaesteRoute(teile[0])) {
    const rest = teile.slice(1).join('/')
    return `/${teile[0]}/${organisationId}${rest ? `/${rest}` : ''}`
  }
  if (teile[0] === 'impressum' || teile[0] === 'datenschutz') return `/website/${organisationId}/${teile[0]}`
  return `/website/${organisationId}`
}

// Alte Plattform-Adressen (maestoso-gastro.de/reservieren/<id> usw.), die auf die
// Domain des Betriebs umgeleitet werden.
export function altePlattformAdresse(pathname: string): string | null {
  const teile = pathname.split('/').filter(Boolean)
  if ((teile[0] === 'website' || teile[0] === 'team' || istGaesteRoute(teile[0])) && teile[1] && UUID.test(teile[1])) return teile[1]
  return null
}

// Header, mit dem proxy.ts den Seiten mitteilt, dass die Anfrage über die
// Domain des Betriebs kam – dann bauen sie kurze Links (/impressum) statt
// der internen (/website/<id>/impressum).
export const ORG_HOST_HEADER = 'x-maestoso-org'

// /team, /team/einladung … auf der Domain des Betriebs → interne Route.
// Eine mitgeschickte ID wird wie bei den Gästepfaden verworfen.
export function internerTeamPfad(organisationId: string, pathname: string): string | null {
  const teile = pathname.split('/').filter(Boolean)
  if (teile[0] !== 'team') return null
  const rest = teile.slice(istUuid(teile[1]) ? 2 : 1).join('/')
  return `/team/${organisationId}${rest ? `/${rest}` : ''}`
}
