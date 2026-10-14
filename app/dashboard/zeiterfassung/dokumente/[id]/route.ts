import { NextRequest } from 'next/server'
import { getMitarbeiterSitzung } from '@/lib/mitarbeiter/session'
import { dokumentDatei, ladeDokumentFuerDownload } from '@/lib/zeiterfassung/dokumente'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sitzung = await getMitarbeiterSitzung()
  if (!sitzung) return new Response('Nicht angemeldet', { status: 401 })
  if (sitzung.rolle !== 'leitung') return new Response('Keine Berechtigung', { status: 403 })

  const { id } = await params
  const dokument = await ladeDokumentFuerDownload(id)
  if (!dokument || dokument.organisationId !== sitzung.organisationId) {
    return new Response('Nicht gefunden', { status: 404 })
  }

  const datei = await dokumentDatei(dokument.storagePfad)
  if (!datei) return new Response('Datei nicht gefunden', { status: 404 })

  const buffer = Buffer.from(await datei.arrayBuffer())
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': datei.type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${dokument.dateiname}"`,
    },
  })
}

export const dynamic = 'force-dynamic'
