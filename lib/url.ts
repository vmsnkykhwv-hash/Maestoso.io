import { headers } from 'next/headers'
import { getServiceClient } from '@/lib/supabase/server'

// Basis-URL aus dem eingehenden Request – funktioniert unabhängig von
// Subdomain/eigener Domain der jeweiligen Organisation. Server Actions sind
// aber eigenständig aufrufbare Endpunkte (siehe proxy.ts): der `Host`-Header
// lässt sich vom Aufrufer frei setzen und wird von der Middleware nicht
// geprüft. Ungefiltert übernommen, würde er z. B. die PayPal-Webhook-URL auf
// eine fremde Domain umleiten. Deshalb nur gegen eine Zulassliste
// (Plattform-Domain, die eigene Subdomain/Custom-Domain der Organisation)
// akzeptieren – sonst zurück auf die Plattform-Domain.
export async function herkunftUrl(organisationId?: string): Promise<string> {
  const h = await headers()
  const protokoll = h.get('x-forwarded-proto') ?? 'https'
  const host = (h.get('host') ?? '').toLowerCase()

  const plattformDomain = process.env.NEXT_PUBLIC_PLATTFORM_DOMAIN
  if (!plattformDomain) return `${protokoll}://${h.get('host')}` // lokale Entwicklung: keine Zulassliste verfügbar

  const erlaubt = new Set([plattformDomain, `www.${plattformDomain}`])

  if (organisationId) {
    const supabase = getServiceClient()
    const { data } = await supabase.from('organisationen').select('subdomain, custom_domain').eq('id', organisationId).maybeSingle()
    if (data?.subdomain) erlaubt.add(`${data.subdomain}.${plattformDomain}`)
    if (data?.custom_domain) erlaubt.add(data.custom_domain as string)
  }

  const hostOhnePort = host.split(':')[0]
  if (erlaubt.has(hostOhnePort)) return `${protokoll}://${host}`

  return `https://${plattformDomain}`
}
