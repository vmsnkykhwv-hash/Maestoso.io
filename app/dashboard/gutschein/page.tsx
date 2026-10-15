import AppHeader from '@/components/AppHeader'
import { istVerwaltung, seiteFuer } from '@/lib/zugriff'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeGutscheinEinstellungen, ladeGutscheineFuerOrganisation } from '@/lib/gutschein/daten'
import { ladePaypalEinstellungen } from '@/lib/paypal/daten'
import GutscheinApp from './GutscheinApp'

export const dynamic = 'force-dynamic'

export default async function GutscheinPage() {
  const sitzung = await seiteFuer('gutschein', { ohneHandy: true })

  const verwaltung = istVerwaltung(sitzung)
  const [freischaltungen, einstellungen, gutscheine, paypal] = await Promise.all([
    ladeFreischaltungen(sitzung.organisationId),
    ladeGutscheinEinstellungen(sitzung.organisationId),
    ladeGutscheineFuerOrganisation(sitzung.organisationId),
    // Am Tresen gar nicht erst laden – auch ausgeblendet hätte der Browser
    // die PayPal-Zugangsdaten sonst in den Seitendaten.
    verwaltung ? ladePaypalEinstellungen(sitzung.organisationId) : null,
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Gutschein-Verkauf" />
      <GutscheinApp
        darfVerwalten={verwaltung}
        freigeschaltet={freischaltungen.gutschein}
        anfangsEinstellungen={einstellungen}
        anfangsGutscheine={gutscheine}
        anfangsPaypal={{
          clientId: paypal?.clientId ?? '',
          secretHinterlegt: !!paypal?.clientSecret,
          modus: paypal?.modus ?? 'sandbox',
          aktiv: paypal?.aktiv ?? false,
        }}
      />
    </div>
  )
}
