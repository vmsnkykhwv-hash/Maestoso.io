import type { Metadata } from 'next'
import { Fraunces, Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' })

export const metadata: Metadata = {
  title: 'Partitura',
  description: 'Die Plattform, die Reservierungen, Personal, Lager und Bestellungen im selben Takt hält.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${manrope.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground">{children}</body>
    </html>
  )
}
