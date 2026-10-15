// Einmal nutzbare Wiederherstellungscodes für den Fall, dass das Handy mit
// der Authenticator-App verloren geht. Gespeichert wird nur der SHA-256-Hash
// – die Codes sind zufällig und lang genug, dass ein langsamer KDF wie bei
// Passwörtern nichts bringt.
import { createHash, randomBytes } from 'node:crypto'

const ZEICHEN = 'abcdefghjkmnpqrstuvwxyz23456789'
export const ANZAHL_CODES = 10

function hash(code: string): string {
  return createHash('sha256').update(code.toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex')
}

export function codesErzeugen(): { klartext: string[]; hashes: string[] } {
  const klartext = Array.from({ length: ANZAHL_CODES }, () => {
    const zufall = Array.from(randomBytes(8), (b) => ZEICHEN[b % ZEICHEN.length]).join('')
    return `${zufall.slice(0, 4)}-${zufall.slice(4)}`
  })
  return { klartext, hashes: klartext.map(hash) }
}

// Gibt die verbleibenden Hashes zurück, wenn der Code passte – sonst null.
export function codeEinloesen(eingabe: string, hashes: string[]): string[] | null {
  const gesucht = hash(eingabe)
  if (!hashes.includes(gesucht)) return null
  return hashes.filter((h) => h !== gesucht)
}

export function einmalTokenErzeugen(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: createHash('sha256').update(token).digest('hex') }
}

export function einmalTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
