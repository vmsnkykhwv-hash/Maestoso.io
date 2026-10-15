import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { getBetriebsSitzung } from '@/lib/session'
import { ladeMitarbeiterNamen } from '@/lib/mitarbeiter/daten'
import { ladeSchichtenFuerZeitraum } from '@/lib/dienstplan/daten'
import { wochentagKurz } from '@/lib/datum'

export async function GET(request: NextRequest) {
  // Exporte und Personaldokumente: nur Verwaltungskonto.
  const sitzung = await getBetriebsSitzung()
  if (!sitzung) return new Response('Nicht angemeldet', { status: 401 })
  if (sitzung.art !== 'inhaber') return new Response('Keine Berechtigung', { status: 403 })

  const von = request.nextUrl.searchParams.get('von')
  const bis = request.nextUrl.searchParams.get('bis')
  if (!von || !bis) return new Response('von/bis fehlt', { status: 400 })

  const [schichten, mitarbeiterListe] = await Promise.all([
    ladeSchichtenFuerZeitraum(sitzung.organisationId, von, bis),
    ladeMitarbeiterNamen(sitzung.organisationId),
  ])

  const nameNachId = new Map(mitarbeiterListe.map((m) => [m.id, m.name]))

  const zeilen: (string | number)[][] = [['Datum', 'Wochentag', 'Beginn', 'Ende', 'Mitarbeiter', 'Notiz']]
  for (const s of schichten) {
    zeilen.push([
      s.datum,
      wochentagKurz(s.datum),
      s.beginn,
      s.ende,
      s.mitarbeiterId ? (nameNachId.get(s.mitarbeiterId) ?? '') : 'Offen',
      s.notiz ?? '',
    ])
  }

  const blatt = XLSX.utils.aoa_to_sheet(zeilen)
  blatt['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 28 }]

  const arbeitsmappe = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(arbeitsmappe, blatt, 'Dienstplan')

  const buffer = XLSX.write(arbeitsmappe, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="dienstplan-${von}_bis_${bis}.xlsx"`,
    },
  })
}

export const dynamic = 'force-dynamic'
