import AppHeader from '@/components/AppHeader'
import { ladeProtokoll } from '@/lib/protokoll'
import { seiteFuer } from '@/lib/zugriff'
import ProtokollAnsicht from './ProtokollAnsicht'

export const dynamic = 'force-dynamic'

export default async function ProtokollPage() {
  const sitzung = await seiteFuer(null, { verwaltung: true })
  const eintraege = await ladeProtokoll(sitzung.organisationId)

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Änderungsprotokoll" />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <ProtokollAnsicht anfangsEintraege={eintraege} />
      </main>
    </div>
  )
}
