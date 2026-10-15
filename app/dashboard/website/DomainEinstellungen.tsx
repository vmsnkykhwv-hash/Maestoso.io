// Nur Anzeige: Die eigene Domain trägt ausschließlich der Plattform-Admin
// ein (app/plattform-admin). Dürfte ein Betrieb sie selbst setzen, könnte er
// die Domain eines anderen Betriebs beanspruchen, solange der sie noch nicht
// hinterlegt hat – Besucher dieser Domain sähen dann seine Website.
export default function DomainEinstellungen({
  subdomain,
  anfangsCustomDomain,
}: {
  subdomain: string | null
  anfangsCustomDomain: string | null
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Plattform-Subdomain</h3>
        <p className="text-sm text-muted">{subdomain ?? 'Noch keine Subdomain zugewiesen – bitte beim Plattform-Admin melden.'}</p>
        <p className="mt-2 text-xs text-muted">Funktioniert sofort, keine weiteren Schritte nötig.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Eigene Domain (optional)</h3>
        <p className="text-sm text-muted">{anfangsCustomDomain ?? 'Noch keine eigene Domain eingerichtet.'}</p>
        <p className="mt-3 text-xs text-muted">
          Eine eigene Domain richten wir für euch ein – meldet euch einfach bei uns, egal ob ihr schon eine Domain
          habt oder eine neue braucht. Bis sie eingerichtet ist, erreichen Gäste eure Website über die Subdomain.
        </p>
      </div>
    </div>
  )
}
