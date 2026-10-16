import type { Metadata } from 'next'
import { Fraunces, Manrope, Outfit } from 'next/font/google'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' })
// Geometrische Schrift des Maestoso-Schriftzugs (Logo, Website-Überschriften).
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

export const metadata: Metadata = {
  title: 'Maestoso',
  description: 'Die Plattform, die Reservierungen, Personal, Lager und Bestellungen im selben Takt hält.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${manrope.variable} ${fraunces.variable} ${outfit.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground">{children}</body>
    </html>
  )
}
