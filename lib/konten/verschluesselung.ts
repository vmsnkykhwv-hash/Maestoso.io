// AES-256-GCM für TOTP-Geheimnisse. Eigener Schlüssel (ZWEI_FAKTOR_SCHLUESSEL),
// getrennt von SESSION_SECRET und der Datenbank: wer nur die Datenbank
// erbeutet, kann damit keine gültigen 2FA-Codes erzeugen.
//
// node:crypto – nur serverseitig, nie aus proxy.ts erreichbar.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function schluessel(): Buffer {
  const hex = process.env.ZWEI_FAKTOR_SCHLUESSEL
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('ZWEI_FAKTOR_SCHLUESSEL fehlt oder hat nicht 64 Hex-Zeichen (openssl rand -hex 32)')
  }
  return Buffer.from(hex, 'hex')
}

export function verschluesseln(klartext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', schluessel(), iv)
  const daten = Buffer.concat([cipher.update(klartext, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), daten.toString('base64')].join(':')
}

export function entschluesseln(gespeichert: string): string {
  const [version, iv, tag, daten] = gespeichert.split(':')
  if (version !== 'v1' || !iv || !tag || !daten) throw new Error('Unbekanntes Format')
  const decipher = createDecipheriv('aes-256-gcm', schluessel(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(daten, 'base64')), decipher.final()]).toString('utf8')
}
