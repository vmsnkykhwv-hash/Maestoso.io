import { redirect } from 'next/navigation'
import { getSitzung } from '@/lib/session'
import { organisationsName } from '@/lib/tischplan/daten'
import DashboardShell from '@/components/DashboardShell'

export const dynamic = 'force-dynamic'

// Gemeinsamer Rahmen für alle Dashboard-Seiten (Sidebar + mobiles
// Navigations-Overlay) – vorher musste jede Modul-Seite ihre eigene
// Kopfzeile ohne Navigation zu den anderen Modulen rendern.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') redirect('/login')

  const organisationName = (await organisationsName(sitzung.organisationId)) ?? 'Eure Organisation'

  return <DashboardShell organisationName={organisationName}>{children}</DashboardShell>
}
