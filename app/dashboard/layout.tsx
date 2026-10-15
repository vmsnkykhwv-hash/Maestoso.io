import { redirect } from 'next/navigation'
import { getBetriebsSitzung } from '@/lib/session'
import { organisationsName } from '@/lib/tischplan/daten'
import DashboardShell from '@/components/DashboardShell'
import ThemeBereich from '@/components/ThemeBereich'

export const dynamic = 'force-dynamic'

// Gemeinsamer Rahmen für alle Dashboard-Seiten (Sidebar + mobiles
// Navigations-Overlay) – vorher musste jede Modul-Seite ihre eigene
// Kopfzeile ohne Navigation zu den anderen Modulen rendern.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sitzung = await getBetriebsSitzung()
  if (!sitzung) redirect('/team')

  const organisationName = (await organisationsName(sitzung.organisationId)) ?? 'Eure Organisation'

  return (
    <ThemeBereich>
      <DashboardShell organisationName={organisationName}>{children}</DashboardShell>
    </ThemeBereich>
  )
}
