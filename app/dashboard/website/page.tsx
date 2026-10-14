import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getSitzung } from '@/lib/session'
import { getServiceClient } from '@/lib/supabase/server'
import { ladeFreischaltungen } from '@/lib/organisationen'
import { ladeBilder, ladeInhalt, ladeMenuEintraege, ladeMenuKategorien } from '@/lib/website/daten'
import WebsiteApp from './WebsiteApp'

export const dynamic = 'force-dynamic'

export default async function WebsitePage() {
  const sitzung = await getSitzung()
  if (!sitzung || sitzung.typ !== 'organisation') redirect('/login')

  const supabase = getServiceClient()
  const [freischaltungen, inhalt, heroBilder, galerieBilder, kategorien, eintraege, { data: organisation }] = await Promise.all([
    ladeFreischaltungen(sitzung.organisationId),
    ladeInhalt(sitzung.organisationId),
    ladeBilder(sitzung.organisationId, 'hero'),
    ladeBilder(sitzung.organisationId, 'galerie'),
    ladeMenuKategorien(sitzung.organisationId),
    ladeMenuEintraege(sitzung.organisationId),
    supabase.from('organisationen').select('subdomain, custom_domain').eq('id', sitzung.organisationId).maybeSingle(),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader titel="Website" />
      <WebsiteApp
        organisationId={sitzung.organisationId}
        freigeschaltet={freischaltungen.website}
        anfangsInhalt={inhalt}
        anfangsHeroBild={heroBilder[0] ?? null}
        anfangsGalerie={galerieBilder}
        anfangsKategorien={kategorien}
        anfangsEintraege={eintraege}
        subdomain={(organisation?.subdomain as string | null) ?? null}
        customDomain={(organisation?.custom_domain as string | null) ?? null}
      />
    </div>
  )
}
