import { notFound } from 'next/navigation'
import { Instagram, Mail, MapPin, Phone } from 'lucide-react'
import { heuteBerlin } from '@/lib/datum'
import { ladeAusnahmeFuerDatum, ladeEinstellungen, organisationsName } from '@/lib/tischplan/daten'
import { ladeBilder, ladeInhalt, ladeMenuEintraege, ladeMenuKategorien } from '@/lib/website/daten'
import { ladeBestellEinstellungen } from '@/lib/bestellung/daten'
import { kanalAktiv } from '@/lib/bestellung/regeln'
import BuchungsFormular from '@/app/reservieren/[organisationId]/BuchungsFormular'
import BestellFormular from '@/app/bestellen/[organisationId]/BestellFormular'
import RechtlicheFusszeile from '@/components/rechtliches/RechtlicheFusszeile'

export const dynamic = 'force-dynamic'

function formatPreis(preis: number): string {
  return preis.toFixed(2).replace('.', ',') + ' €'
}

export default async function WebsitePage({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params
  const name = await organisationsName(organisationId)
  if (!name) notFound()

  const [inhalt, heroBilder, galerie, kategorien, alleEintraege, einstellungen, bestellEinstellungen, ausnahmeHeute] = await Promise.all([
    ladeInhalt(organisationId),
    ladeBilder(organisationId, 'hero'),
    ladeBilder(organisationId, 'galerie'),
    ladeMenuKategorien(organisationId),
    ladeMenuEintraege(organisationId),
    ladeEinstellungen(organisationId),
    ladeBestellEinstellungen(organisationId),
    ladeAusnahmeFuerDatum(organisationId, heuteBerlin()),
  ])

  const heroBild = heroBilder[0] ?? null
  const eintraege = alleEintraege.filter((e) => e.aktiv)
  const hatSpeisekarte = kategorien.some((k) => eintraege.some((e) => e.kategorieId === k.id))
  // Synchron mit dem Bestellung-Modul: taucht die Leitung dort einen Kanal
  // ab (Toggle oder Schnellpause), verschwindet der Bestellen-Bereich hier
  // sofort wieder (force-dynamic, kein Caching) – keine zweite Quelle, die
  // auseinanderlaufen könnte.
  const bestellungMoeglich = kanalAktiv('abholung', bestellEinstellungen).aktiv || kanalAktiv('lieferung', bestellEinstellungen).aktiv

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/90 px-6 py-3 backdrop-blur">
        <span className="text-sm font-semibold">{name}</span>
        <nav className="flex gap-4 text-xs font-medium text-muted">
          {hatSpeisekarte && <a href="#speisekarte">Speisekarte</a>}
          {bestellungMoeglich && <a href="#bestellen">Bestellen</a>}
          <a href="#reservieren">Reservieren</a>
          <a href="#kontakt">Kontakt</a>
        </nav>
      </header>

      {ausnahmeHeute && (
        <div className="bg-locked-bg px-6 py-3 text-center text-sm font-medium text-locked">
          {ausnahmeHeute.geschlossen
            ? `Heute geschlossen${ausnahmeHeute.notiz ? ` – ${ausnahmeHeute.notiz}` : ''}.`
            : `Heute abweichende Öffnungszeiten: ${ausnahmeHeute.von}–${ausnahmeHeute.bis} Uhr${ausnahmeHeute.notiz ? ` (${ausnahmeHeute.notiz})` : ''}.`}
        </div>
      )}

      <section
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-cover bg-center px-6 py-20 text-center"
        style={
          heroBild
            ? { backgroundImage: `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)), url(${heroBild.url})`, color: '#fff' }
            : undefined
        }
      >
        <h1 className="text-3xl font-bold">{inhalt.heroTitel || name}</h1>
        {inhalt.heroUntertitel && <p className="max-w-md text-sm opacity-90">{inhalt.heroUntertitel}</p>}
        <a href="#reservieren" className="mt-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground">
          Jetzt reservieren
        </a>
      </section>

      <main className="mx-auto w-full max-w-2xl space-y-12 px-6 py-12">
        {inhalt.ueberUns && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Über uns</h2>
            <p className="whitespace-pre-line text-sm text-muted">{inhalt.ueberUns}</p>
          </section>
        )}

        {inhalt.tagesmenuAktiv && inhalt.tagesmenuText && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-2 text-lg font-semibold">Heute</h2>
            <p className="whitespace-pre-line text-sm text-muted">{inhalt.tagesmenuText}</p>
          </section>
        )}

        {hatSpeisekarte && (
          <section id="speisekarte">
            <h2 className="mb-4 text-lg font-semibold">Speisekarte</h2>
            <div className="space-y-6">
              {kategorien.map((kategorie) => {
                const eintraegeDerKategorie = eintraege.filter((e) => e.kategorieId === kategorie.id)
                if (eintraegeDerKategorie.length === 0) return null
                return (
                  <div key={kategorie.id}>
                    <h3 className="mb-2 text-sm font-semibold text-muted">{kategorie.name}</h3>
                    <ul className="space-y-1.5">
                      {eintraegeDerKategorie.map((eintrag) => (
                        <li key={eintrag.id} className="flex items-baseline justify-between gap-3 text-sm">
                          <span>
                            {eintrag.name}
                            {eintrag.beschreibung && <span className="block text-xs text-muted">{eintrag.beschreibung}</span>}
                          </span>
                          <span className="flex-none font-medium">{formatPreis(eintrag.preis)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-lg font-semibold">Öffnungszeiten</h2>
          <ul className="text-sm text-muted">
            <li>Montag – Samstag: {einstellungen.wocheStart} – {einstellungen.wocheEnde} Uhr</li>
            <li>Sonntag & Feiertag: {einstellungen.sonntagStart} – {einstellungen.sonntagEnde} Uhr</li>
          </ul>
        </section>

        {bestellungMoeglich && (
          <section id="bestellen">
            <h2 className="mb-4 text-lg font-semibold">Online bestellen</h2>
            <BestellFormular organisationId={organisationId} />
          </section>
        )}

        <section id="reservieren">
          <h2 className="mb-4 text-lg font-semibold">Tisch reservieren</h2>
          <BuchungsFormular organisationId={organisationId} />
        </section>

        {galerie.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold">Galerie</h2>
            <div className="grid grid-cols-3 gap-2">
              {galerie.map((bild) => (
                // eslint-disable-next-line @next/next/no-img-element -- extern aus Supabase Storage
                <img key={bild.id} src={bild.url} alt="" className="aspect-square rounded-lg object-cover" />
              ))}
            </div>
          </section>
        )}

        <section id="kontakt" className="space-y-2 text-sm text-muted">
          <h2 className="mb-2 text-lg font-semibold text-foreground">Kontakt</h2>
          {inhalt.kontaktAdresse && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 flex-none" /> {inhalt.kontaktAdresse}
            </p>
          )}
          {inhalt.kontaktTelefon && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 flex-none" /> {inhalt.kontaktTelefon}
            </p>
          )}
          {inhalt.kontaktEmail && (
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 flex-none" /> {inhalt.kontaktEmail}
            </p>
          )}
          {inhalt.instagramUrl && (
            <p className="flex items-center gap-2">
              <Instagram className="h-4 w-4 flex-none" />
              <a href={inhalt.instagramUrl} target="_blank" rel="noreferrer">
                Instagram
              </a>
            </p>
          )}
        </section>
      </main>
      <RechtlicheFusszeile organisationId={organisationId} className="border-t border-border py-6" />
    </div>
  )
}
