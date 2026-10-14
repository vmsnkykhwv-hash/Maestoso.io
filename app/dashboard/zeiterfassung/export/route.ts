import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { getServiceClient } from '@/lib/supabase/server'
import { getMitarbeiterSitzung } from '@/lib/mitarbeiter/session'
import { arbeitsminuten } from '@/lib/zeiterfassung/zeit'
import { EINTRAG_ART_LABEL, type EintragArt } from '@/lib/zeiterfassung/types'

const SPALTEN_BREITE = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 11 }, { wch: 9 }, { wch: 28 }]

function zeileAusEintrag(e: Record<string, unknown>, mitarbeiterName: string): (string | number)[] {
  const beginn = e.beginn as string | null
  const ende = e.ende as string | null
  const minuten = beginn && ende ? arbeitsminuten(beginn, ende, e.pause_minuten as number) : 0

  return [
    mitarbeiterName,
    e.arbeitstag as string,
    EINTRAG_ART_LABEL[e.art as EintragArt] ?? (e.art as string),
    beginn ?? '',
    ende ?? '',
    e.pause_minuten as number,
    Math.round((minuten / 60) * 100) / 100,
    (e.notiz as string | null) ?? '',
  ]
}

// Excel erlaubt in Blattnamen weder : \ / ? * [ ] noch mehr als 31 Zeichen.
function blattname(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Mitarbeiter'
}

export async function GET(request: NextRequest) {
  const sitzung = await getMitarbeiterSitzung()
  if (!sitzung) return new Response('Nicht angemeldet', { status: 401 })

  const params = request.nextUrl.searchParams
  const von = params.get('von')
  const bis = params.get('bis')
  const format = params.get('format')

  if (!von || !bis) return new Response('von/bis fehlt', { status: 400 })

  const supabase = getServiceClient()
  const arbeitsmappe = XLSX.utils.book_new()

  // Steuerberater-Export: immer alle (aktiven) Mitarbeiter der Organisation,
  // ein Tabellenblatt pro Person – nur der Leitung zugänglich.
  if (format === 'buchhaltung') {
    if (sitzung.rolle !== 'leitung') return new Response('Keine Berechtigung', { status: 403 })

    const { data: mitarbeiterListe } = await supabase
      .from('mitarbeiter')
      .select('id, name')
      .eq('organisation_id', sitzung.organisationId)
      .order('name')

    for (const m of mitarbeiterListe ?? []) {
      const { data: eintraege } = await supabase
        .from('zeiteintraege')
        .select('arbeitstag, art, beginn, ende, pause_minuten, notiz')
        .eq('mitarbeiter_id', m.id)
        .gte('arbeitstag', von)
        .lte('arbeitstag', bis)
        .order('arbeitstag')

      const name = m.name as string
      const zeilen: (string | number)[][] = [['Mitarbeiter', 'Datum', 'Typ', 'Beginn', 'Ende', 'Pause (Min.)', 'Stunden', 'Notiz']]
      for (const e of eintraege ?? []) zeilen.push(zeileAusEintrag(e, name))

      const blatt = XLSX.utils.aoa_to_sheet(zeilen)
      blatt['!cols'] = SPALTEN_BREITE
      XLSX.utils.book_append_sheet(arbeitsmappe, blatt, blattname(name))
    }

    if (arbeitsmappe.SheetNames.length === 0) {
      XLSX.utils.book_append_sheet(arbeitsmappe, XLSX.utils.aoa_to_sheet([['Keine Mitarbeiter']]), 'Zeiterfassung')
    }

    const buffer = XLSX.write(arbeitsmappe, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="zeiterfassung-steuerberater-${von}_bis_${bis}.xlsx"`,
      },
    })
  }

  const angeforderteIds = params.getAll('mitarbeiterId')

  // Mitarbeiter dürfen nur sich selbst exportieren, Leitung beliebige.
  const erlaubteIds = sitzung.rolle === 'leitung' ? angeforderteIds : [sitzung.mitarbeiterId]
  if (erlaubteIds.length === 0) return new Response('Keine Mitarbeiter ausgewählt', { status: 400 })

  const [{ data: mitarbeiterListe }, { data: eintraege }] = await Promise.all([
    supabase.from('mitarbeiter').select('id, name').in('id', erlaubteIds),
    supabase
      .from('zeiteintraege')
      .select('mitarbeiter_id, arbeitstag, art, beginn, ende, pause_minuten, notiz')
      .in('mitarbeiter_id', erlaubteIds)
      .gte('arbeitstag', von)
      .lte('arbeitstag', bis)
      .order('arbeitstag'),
  ])

  const nameNachId = new Map((mitarbeiterListe ?? []).map((m) => [m.id as string, m.name as string]))

  const zeilen: (string | number)[][] = [
    ['Mitarbeiter', 'Datum', 'Typ', 'Beginn', 'Ende', 'Pause (Min.)', 'Stunden', 'Notiz'],
  ]
  for (const e of eintraege ?? []) zeilen.push(zeileAusEintrag(e, nameNachId.get(e.mitarbeiter_id as string) ?? ''))

  const blatt = XLSX.utils.aoa_to_sheet(zeilen)
  blatt['!cols'] = SPALTEN_BREITE
  XLSX.utils.book_append_sheet(arbeitsmappe, blatt, 'Zeiterfassung')

  const buffer = XLSX.write(arbeitsmappe, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="zeiterfassung-${von}_bis_${bis}.xlsx"`,
    },
  })
}

export const dynamic = 'force-dynamic'
