import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getSitzung } from '@/lib/session'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeGutscheinEinstellungen, ladeGutscheineFuerOrganisation } from '@/lib/gutschein/daten'
import { ladePaypalEinstellungen } from '@/lib/paypal/daten'
import GutscheinApp from './GutscheinApp'

export const dynamic = 'force-dynamic'

export default async function GutscheinPage() {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') redirect('/login')

  const [freischaltungen, einstellungen, gutscheine, paypal] = await Promise.all([
    ladeFreischaltungen(sitzung.organisationId),
    ladeGutscheinEinstellungen(sitzung.organisationId),
    ladeGutscheineFuerOrganisation(sitzung.organisationId),
    ladePaypalEinstellungen(sitzung.organisationId),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Gutschein-Verkauf" />
      <GutscheinApp
        freigeschaltet={freischaltungen.gutschein}
        anfangsEinstellungen={einstellungen}
        anfangsGutscheine={gutscheine}
        anfangsPaypal={{
          clientId: paypal.clientId ?? '',
          secretHinterlegt: !!paypal.clientSecret,
          modus: paypal.modus,
          aktiv: paypal.aktiv,
        }}
      />
    </div>
  )
}
