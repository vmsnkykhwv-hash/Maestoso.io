// Formatregeln für PINs – bewusst getrennt von lib/pinHash.ts (node:crypto),
// damit sie auch in Client-Komponenten für Hinweise nutzbar sind.
//
// Gilt nur beim Anlegen/Ändern – bestehende kürzere PINs funktionieren weiter.
export const MITARBEITER_PIN = { min: 4, max: 8 }

export function pinFehler(pin: string, regel: { min: number; max: number }): string | null {
  if (!/^\d+$/.test(pin)) return 'Die PIN darf nur aus Ziffern bestehen.'
  if (pin.length < regel.min || pin.length > regel.max) {
    return `Die PIN muss ${regel.min} bis ${regel.max} Ziffern lang sein.`
  }
  // Offensichtliche PINs wie 0000, 1234 oder 123456 sind die ersten, die
  // jemand ausprobiert.
  const alleGleich = /^(\d)\1+$/.test(pin)
  const aufsteigend = '01234567890123'.includes(pin)
  const absteigend = '98765432109876'.includes(pin)
  if (alleGleich || aufsteigend || absteigend) return 'Diese PIN ist zu leicht zu erraten.'
  return null
}
