// TOTP nach RFC 6238 (30 Sekunden, 6 Ziffern, SHA-1) – das Verfahren, das
// Google Authenticator, Microsoft Authenticator, Aegis & Co. sprechen.
// Bewusst selbst implementiert statt als Abhängigkeit: es sind ein paar
// Zeilen um node:crypto herum.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const SCHRITT_SEKUNDEN = 30

function base32Kodieren(daten: Buffer): string {
  let bits = 0
  let wert = 0
  let ergebnis = ''
  for (const byte of daten) {
    wert = (wert << 8) | byte
    bits += 8
    while (bits >= 5) {
      ergebnis += BASE32[(wert >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) ergebnis += BASE32[(wert << (5 - bits)) & 31]
  return ergebnis
}

function base32Dekodieren(text: string): Buffer {
  let bits = 0
  let wert = 0
  const bytes: number[] = []
  for (const zeichen of text.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(zeichen)
    if (index === -1) continue
    wert = (wert << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((wert >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function geheimnisErzeugen(): string {
  return base32Kodieren(randomBytes(20))
}

function codeFuerSchritt(geheimnis: string, schritt: number): string {
  const zaehler = Buffer.alloc(8)
  zaehler.writeBigUInt64BE(BigInt(schritt))
  const hmac = createHmac('sha1', base32Dekodieren(geheimnis)).update(zaehler).digest()
  const versatz = hmac[hmac.length - 1] & 15
  const zahl = (hmac.readUInt32BE(versatz) & 0x7fffffff) % 1_000_000
  return zahl.toString().padStart(6, '0')
}

// Akzeptiert den aktuellen und je einen Schritt davor/danach (Uhren von
// Handy und Server gehen selten exakt gleich). letzterSchritt verhindert,
// dass ein abgefangener Code innerhalb seiner Gültigkeit ein zweites Mal
// benutzt wird.
export function codePruefen(
  geheimnis: string,
  eingabe: string,
  letzterSchritt: number | null
): { gueltig: boolean; schritt?: number } {
  const code = eingabe.replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) return { gueltig: false }
  const jetzt = Math.floor(Date.now() / 1000 / SCHRITT_SEKUNDEN)
  for (const schritt of [jetzt - 1, jetzt, jetzt + 1]) {
    if (letzterSchritt !== null && schritt <= letzterSchritt) continue
    const erwartet = Buffer.from(codeFuerSchritt(geheimnis, schritt))
    if (timingSafeEqual(erwartet, Buffer.from(code))) return { gueltig: true, schritt }
  }
  return { gueltig: false }
}

export function otpauthUri(konto: string, geheimnis: string): string {
  const aussteller = 'Maestoso'
  return `otpauth://totp/${encodeURIComponent(`${aussteller}:${konto}`)}?secret=${geheimnis}&issuer=${aussteller}&algorithm=SHA1&digits=6&period=${SCHRITT_SEKUNDEN}`
}

// Nur für Tests: Code zum aktuellen Zeitpunkt.
export function aktuellerCode(geheimnis: string): string {
  return codeFuerSchritt(geheimnis, Math.floor(Date.now() / 1000 / SCHRITT_SEKUNDEN))
}
