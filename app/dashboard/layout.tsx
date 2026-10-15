import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import ThemeBereich from '@/components/ThemeBereich'
import type { ShellNutzer } from '@/components/Sidebar'
import { teamHref } from '@/lib/gaesteLinks'
import { HANDY_MODULE } from '@/lib/mitarbeiter/types'
import { getBetriebsSitzung } from '@/lib/session'
import { organisationsName } from '@/lib/tischplan/daten'
import Inaktivitaet from './Inaktivitaet'
import TresenAnmeldung from './TresenAnmeldung'

export const dynamic = 'force-dynamic'

// Gemeinsamer Rahmen für alle Dashboard-Seiten (Sidebar + mobiles
// Navigations-Overlay). Am Tresen-Gerät steht davor die PIN-Anmeldung.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sitzung = await getBetriebsSitzung()
  if (!sitzung) redirect('/team')

  const organisationName = (await organisationsName(sitzung.organisationId)) ?? 'Eure Organisation'

  if (sitzung.art === 'tresen' && !sitzung.mitarbeiter) {
    return (
      <ThemeBereich>
        <TresenAnmeldung
          organisationName={organisationName}
          geraetName={sitzung.geraetName}
          verwaltungHref={await teamHref(sitzung.organisationId)}
        />
      </ThemeBereich>
    )
  }

  const nutzer: ShellNutzer =
    sitzung.art === 'inhaber'
      ? { art: 'inhaber' }
      : sitzung.art === 'tresen'
        ? { art: 'tresen', name: sitzung.mitarbeiter!.name, module: sitzung.mitarbeiter!.module }
        : { art: 'handy', name: sitzung.mitarbeiter.name, module: sitzung.mitarbeiter.module.filter((m) => HANDY_MODULE.includes(m)) }

  return (
    <ThemeBereich>
      {sitzung.art === 'tresen' && <Inaktivitaet />}
      <DashboardShell organisationName={organisationName} nutzer={nutzer}>
        {children}
      </DashboardShell>
    </ThemeBereich>
  )
}
