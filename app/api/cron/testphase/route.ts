// Täglicher Lauf (vercel.json → "crons"). Vercel schickt
// "Authorization: Bearer <CRON_SECRET>", sobald die Variable im Projekt
// gesetzt ist. Ohne Secret läuft hier nichts – sonst könnte jeder von außen
// Sperren und Löschungen anstoßen (auch wenn sie nur fällige Fristen
// ausführen).
import { timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'
import { testphasenPruefen } from '@/lib/testphase/ablauf'

export const dynamic = 'force-dynamic'

function berechtigt(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const erwartet = Buffer.from(`Bearer ${secret}`)
  const erhalten = Buffer.from(request.headers.get('authorization') ?? '')
  return erwartet.length === erhalten.length && timingSafeEqual(erwartet, erhalten)
}

export async function GET(request: NextRequest) {
  if (!berechtigt(request)) return new Response('Nicht berechtigt', { status: 401 })
  const ereignisse = await testphasenPruefen()
  return Response.json({ ereignisse })
}
