// Anbindung an die Vercel-REST-API, damit der Plattform-Admin Kunden-Domains
// direkt aus Maestoso heraus im Hosting-Projekt anlegen und prüfen kann,
// statt sie zusätzlich von Hand in der Vercel-Oberfläche einzutragen.
//
// Nur serverseitig: VERCEL_API_TOKEN darf Domains des ganzen Projekts
// ändern und gehört nie in den Browser. Ohne Token/Projekt-ID meldet jede
// Funktion einen verständlichen Fehler, die restliche Plattform läuft weiter.

const API = 'https://api.vercel.com'

// Fallback, falls die API keine Empfehlung mitliefert – das sind die von
// Vercel dokumentierten Standardziele für Apex-Domain bzw. Subdomain.
const STANDARD_A_EINTRAG = '76.76.21.21'
const STANDARD_CNAME = 'cname.vercel-dns.com'

export type DnsEintrag = { typ: 'A' | 'CNAME' | 'TXT'; name: string; wert: string; zweck: string }

export type DomainStatus = {
  domain: string
  // Vercel hat bestätigt, dass die Domain zu diesem Projekt gehören darf
  // (sonst ist z. B. ein TXT-Nachweis nötig, weil sie anderswo genutzt wird).
  verifiziert: boolean
  // DNS zeigt korrekt auf Vercel – erst dann erreichen Gäste die Website.
  dnsKorrekt: boolean
  // Was der Kunde (bzw. wer die DNS verwaltet) noch eintragen muss.
  fehlendeEintraege: DnsEintrag[]
}

function konfiguration(): { token: string; projekt: string; team: string | null } | null {
  const token = process.env.VERCEL_API_TOKEN
  const projekt = process.env.VERCEL_PROJECT_ID
  if (!token || !projekt) return null
  return { token, projekt, team: process.env.VERCEL_TEAM_ID || null }
}

export function vercelKonfiguriert(): boolean {
  return konfiguration() !== null
}

async function anfrage(
  methode: 'GET' | 'POST' | 'DELETE',
  pfad: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; daten: Record<string, unknown> }> {
  const k = konfiguration()
  if (!k) throw new Error('Vercel ist nicht eingerichtet (VERCEL_API_TOKEN / VERCEL_PROJECT_ID fehlen).')

  const url = new URL(API + pfad)
  if (k.team) url.searchParams.set('teamId', k.team)

  const antwort = await fetch(url, {
    method: methode,
    headers: { Authorization: `Bearer ${k.token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const text = await antwort.text()
  const daten = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  return { ok: antwort.ok, status: antwort.status, daten }
}

function fehlertext(daten: Record<string, unknown>): string {
  const fehler = daten.error as { code?: string; message?: string } | undefined
  if (fehler?.code === 'domain_already_in_use') {
    return 'Die Domain ist bereits in einem anderen Vercel-Projekt eingetragen. Dort zuerst entfernen.'
  }
  return fehler?.message ?? 'Unbekannter Fehler von Vercel'
}

function projektPfad(): string {
  return `/projects/${encodeURIComponent(konfiguration()!.projekt)}`
}

// Legt die Domain im Projekt an. Mit mitWww zusätzlich www.<domain>, das per
// 308 auf die Hauptdomain weiterleitet – Gäste tippen beides.
export async function domainHinzufuegen(domain: string, mitWww: boolean): Promise<{ fehler?: string }> {
  const haupt = await anfrage('POST', `/v10${projektPfad()}/domains`, { name: domain })
  // 409 = schon in genau diesem Projekt vorhanden – für uns kein Fehler,
  // so kann der Admin "Verbinden" gefahrlos erneut drücken.
  if (!haupt.ok && haupt.status !== 409) return { fehler: fehlertext(haupt.daten) }
  if (haupt.status === 409 && (haupt.daten.error as { code?: string })?.code === 'domain_already_in_use') {
    return { fehler: fehlertext(haupt.daten) }
  }

  if (mitWww) {
    const www = await anfrage('POST', `/v10${projektPfad()}/domains`, {
      name: `www.${domain}`,
      redirect: domain,
      redirectStatusCode: 308,
    })
    if (!www.ok && www.status !== 409) return { fehler: `www: ${fehlertext(www.daten)}` }
  }
  return {}
}

export async function domainEntfernen(domain: string): Promise<{ fehler?: string }> {
  for (const name of [`www.${domain}`, domain]) {
    const ergebnis = await anfrage('DELETE', `/v9${projektPfad()}/domains/${encodeURIComponent(name)}`)
    // 404 = war nie (oder nicht mehr) eingetragen – Ziel ist ohnehin erreicht.
    if (!ergebnis.ok && ergebnis.status !== 404) return { fehler: fehlertext(ergebnis.daten) }
  }
  return {}
}

function istApex(domain: string): boolean {
  // Grobe Heuristik (musterbetrieb.de vs. shop.musterbetrieb.de); für
  // Endungen wie .co.uk liefert die Vercel-Empfehlung ohnehin den richtigen
  // Eintragstyp, die Heuristik greift nur beim Fallback.
  return domain.split('.').length === 2
}

export async function domainStatusLaden(domain: string): Promise<{ fehler?: string; status?: DomainStatus }> {
  const projektDomain = await anfrage('GET', `/v9${projektPfad()}/domains/${encodeURIComponent(domain)}`)
  if (projektDomain.status === 404) return { fehler: 'Domain ist noch nicht im Vercel-Projekt eingetragen.' }
  if (!projektDomain.ok) return { fehler: fehlertext(projektDomain.daten) }

  let verifiziert = projektDomain.daten.verified === true
  const fehlendeEintraege: DnsEintrag[] = []

  if (!verifiziert) {
    // Vercel prüft den TXT-Nachweis nicht laufend von selbst – einmal
    // anstoßen, damit ein inzwischen gesetzter Eintrag sofort zählt.
    const pruefung = await anfrage('POST', `/v9${projektPfad()}/domains/${encodeURIComponent(domain)}/verify`)
    verifiziert = pruefung.ok && pruefung.daten.verified === true
    const nachweise = verifiziert
      ? []
      : ((projektDomain.daten.verification as { type: string; domain: string; value: string }[] | undefined) ?? [])
    for (const n of nachweise) {
      if (n.type === 'TXT') {
        fehlendeEintraege.push({ typ: 'TXT', name: n.domain, wert: n.value, zweck: 'Nachweis, dass die Domain euch gehört' })
      }
    }
  }

  const config = await anfrage('GET', `/v6/domains/${encodeURIComponent(domain)}/config`)
  if (!config.ok) return { fehler: fehlertext(config.daten) }
  const dnsKorrekt = config.daten.misconfigured === false

  if (!dnsKorrekt) {
    const empfIPv4 = (config.daten.recommendedIPv4 as { rank: number; value: string[] }[] | undefined)?.find((e) => e.rank === 1)
    const empfCname = (config.daten.recommendedCNAME as { rank: number; value: string }[] | undefined)?.find((e) => e.rank === 1)
    if (istApex(domain)) {
      fehlendeEintraege.push({
        typ: 'A',
        name: '@',
        wert: empfIPv4?.value[0] ?? STANDARD_A_EINTRAG,
        zweck: 'Hauptdomain auf Maestoso zeigen lassen',
      })
    } else {
      fehlendeEintraege.push({
        typ: 'CNAME',
        name: domain.split('.')[0],
        wert: (empfCname?.value ?? STANDARD_CNAME).replace(/\.$/, ''),
        zweck: 'Subdomain auf Maestoso zeigen lassen',
      })
    }
  }

  // www.<domain> ist nur dann eingetragen, wenn beim Verbinden "mit www"
  // gewählt war. Ohne eigenen CNAME läuft die Weiterleitung ins Leere.
  let wwwKorrekt = true
  const www = `www.${domain}`
  const wwwImProjekt = await anfrage('GET', `/v9${projektPfad()}/domains/${encodeURIComponent(www)}`)
  if (wwwImProjekt.ok) {
    const wwwConfig = await anfrage('GET', `/v6/domains/${encodeURIComponent(www)}/config`)
    wwwKorrekt = wwwConfig.ok && wwwConfig.daten.misconfigured === false
    if (!wwwKorrekt) {
      fehlendeEintraege.push({ typ: 'CNAME', name: 'www', wert: STANDARD_CNAME, zweck: 'www-Adresse auf Maestoso zeigen lassen' })
    }
  }

  return { status: { domain, verifiziert, dnsKorrekt: dnsKorrekt && wwwKorrekt, fehlendeEintraege } }
}
