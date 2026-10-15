// Passwortregeln und -Hashing für persönliche Konten. Gehasht wird mit
// demselben scrypt wie die PINs (lib/pinHash.ts) – das Verfahren ist für
// Passwörter genauso geeignet, eine zweite KDF wäre nur mehr Pflegeaufwand.
import { pinHashErstellen, pinHashPruefen } from '@/lib/pinHash'

export { PASSWORT_MINDESTLAENGE, passwortFehler } from './regeln'

export const passwortHashErstellen = pinHashErstellen
export const passwortPruefen = pinHashPruefen
