// PIN-Hashing für Organisationen und Mitarbeiter: Salt pro Eintrag + scrypt
// (langsame KDF), unabhängig von SESSION_SECRET. Das ist bewusst getrennt
// von lib/signiertesToken.ts: ein geleakter SESSION_SECRET würde sonst
// gleichzeitig alle PINs offline knackbar machen UND Sessions fälschbar
// machen (ein einzelnes Geheimnis für beides).
//
// node:crypto – darf NIE von proxy.ts (Edge-Runtime) erreichbar sein, auch
// nicht transitiv. Nur aus Server Actions/Route Handlers importieren.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const SCHLUESSEL_LAENGE = 32

// Gespeichertes Format: "<salt-hex>:<hash-hex>" – ein einzelnes Textfeld,
// passt in dieselbe pin_hash-Spalte wie vorher.
export async function pinHashErstellen(pin: string): Promise<string> {
  const salt = randomBytes(16)
  const abgeleitet = (await scrypt(pin, salt, SCHLUESSEL_LAENGE)) as Buffer
  return `${salt.toString('hex')}:${abgeleitet.toString('hex')}`
}

export async function pinHashPruefen(pin: string, gespeichert: string): Promise<boolean> {
  const [saltHex, hashHex] = gespeichert.split(':')
  if (!saltHex || !hashHex) return false

  const salt = Buffer.from(saltHex, 'hex')
  const erwartet = Buffer.from(hashHex, 'hex')
  const abgeleitet = (await scrypt(pin, salt, erwartet.length)) as Buffer

  if (abgeleitet.length !== erwartet.length) return false
  return timingSafeEqual(abgeleitet, erwartet)
}
