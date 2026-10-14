// Generischer signierter Token (HMAC-SHA256 über Web Crypto, läuft sowohl
// im Node- als auch im Edge-Runtime) für beliebige JSON-Payloads mit
// Ablaufzeit. Von lib/auth.ts (Organisation/Plattform-Admin) und
// lib/mitarbeiter/auth.ts (Mitarbeiter-PIN-Login) gemeinsam genutzt, statt
// die Krypto-Grundbausteine mehrfach zu duplizieren.
//
// PIN-Hashing lebt bewusst NICHT hier, sondern in lib/pinHash.ts: das
// braucht node:crypto (scrypt), was im Edge-Runtime (proxy.ts importiert
// diese Datei) nicht verfügbar ist.

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET ist nicht gesetzt')
  }
  return secret
}

function bufToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function strToBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToStr(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '=')
  return atob(padded)
}

async function signieren(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return bufToBase64Url(sigBuf)
}

// Konstante-Zeit-Vergleich ohne node:crypto (Edge-kompatibel) – verhindert,
// dass ein Angreifer über die Antwortzeit byteweise auf die erwartete
// Signatur schließen kann. Vergleicht erst die Länge (kein Geheimnis bei
// einer HMAC-Signatur fester Länge), danach jedes Byte unabhängig vom
// Ergebnis der vorherigen Bytes.
export function konstantZeitGleich(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a)
  const bufB = new TextEncoder().encode(b)
  if (bufA.length !== bufB.length) return false
  let unterschied = 0
  for (let i = 0; i < bufA.length; i++) unterschied |= bufA[i] ^ bufB[i]
  return unterschied === 0
}

export async function tokenErstellen<T>(daten: T, gueltigkeitMs: number): Promise<string> {
  const ablauf = Date.now() + gueltigkeitMs
  const payload = `${strToBase64Url(JSON.stringify(daten))}.${ablauf}`
  const sig = await signieren(payload, getSecret())
  return `${payload}.${sig}`
}

export async function tokenPruefen<T>(token: string | undefined | null): Promise<T | null> {
  if (!token) return null

  const teile = token.split('.')
  if (teile.length !== 3) return null
  const [datenB64, ablauf, sig] = teile

  if (Date.now() > Number(ablauf)) return null

  const erwartet = await signieren(`${datenB64}.${ablauf}`, getSecret())
  if (!konstantZeitGleich(sig, erwartet)) return null

  try {
    return JSON.parse(base64UrlToStr(datenB64)) as T
  } catch {
    return null
  }
}
