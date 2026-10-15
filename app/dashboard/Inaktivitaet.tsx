'use client'

import { useEffect } from 'react'
import { mitarbeiterAbmelden } from '@/lib/mitarbeiter/aktionen'

// Am Tresen nach einigen Minuten ohne Eingabe abmelden – sonst arbeitet die
// nächste Person unter dem Namen der vorigen weiter, und das
// Änderungsprotokoll stimmt nicht mehr.
const MINUTEN = 10

export default function Inaktivitaet() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const neuStarten = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await mitarbeiterAbmelden()
        window.location.href = '/dashboard'
      }, MINUTEN * 60 * 1000)
    }
    const ereignisse = ['pointerdown', 'keydown', 'scroll'] as const
    ereignisse.forEach((e) => window.addEventListener(e, neuStarten, { passive: true }))
    neuStarten()
    return () => {
      clearTimeout(timer)
      ereignisse.forEach((e) => window.removeEventListener(e, neuStarten))
    }
  }, [])
  return null
}
