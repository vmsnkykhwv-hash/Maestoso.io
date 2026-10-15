import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { getBetriebsSitzung } from '@/lib/session'
import { ladeArtikelFuerLieferant, ladeLieferant, ladePruefung, ladePruefungEintraege } from '@/lib/lager/daten'

export async function GET(request: NextRequest) {
  // Exporte und Personaldokumente: nur Verwaltungskonto.
  const sitzung = await getBetriebsSitzung()
  if (!sitzung) return new Response('Nicht angemeldet', { status: 401 })
  if (sitzung.art !== 'inhaber') return new Response('Keine Berechtigung', { status: 403 })

  const pruefungId = request.nextUrl.searchParams.get('pruefungId')
  if (!pruefungId) return new Response('pruefungId fehlt', { status: 400 })

  const pruefung = await ladePruefung(pruefungId, sitzung.organisationId)
  if (!pruefung) return new Response('Prüfung nicht gefunden', { status: 404 })

  const [lieferant, artikel, eintraege] = await Promise.all([
    ladeLieferant(pruefung.lieferantId, sitzung.organisationId),
    ladeArtikelFuerLieferant(pruefung.lieferantId),
    ladePruefungEintraege(pruefungId),
  ])

  const eintragNachArtikel = new Map(eintraege.map((e) => [e.artikelId, e]))

  const zeilen: (string | number)[][] = [['Artikel', 'Einheit', 'Mindestbestand', 'Aktueller Bestand', 'Bestellmenge']]
  for (const a of artikel) {
    const eintrag = eintragNachArtikel.get(a.id)
    if (!eintrag?.nachbestellen) continue
    zeilen.push([a.name, a.einheit, a.mindestbestand, eintrag.aktuellerBestand ?? '', eintrag.bestellmenge ?? ''])
  }

  const blatt = XLSX.utils.aoa_to_sheet(zeilen)
  blatt['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }]

  const arbeitsmappe = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(arbeitsmappe, blatt, 'Bestellliste')

  const buffer = XLSX.write(arbeitsmappe, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const lieferantSlug = (lieferant?.name ?? 'lieferant').replace(/[^a-zA-Z0-9äöüÄÖÜß-]+/g, '-')

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bestellliste-${lieferantSlug}-${pruefung.bestelldatum}.xlsx"`,
    },
  })
}

export const dynamic = 'force-dynamic'
