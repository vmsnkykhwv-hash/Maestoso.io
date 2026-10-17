'use client'

import { useState, useTransition } from 'react'
import { anfrageSendenAktion } from '@/app/anfrage-actions'

const feld = 'w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-[15px] text-white placeholder:text-white/40 focus:border-m-gold focus:outline-none focus:ring-2 focus:ring-m-gold/40'
const label = 'mb-1.5 block text-sm font-medium text-white/85'

export default function FoundingPartnerFormular() {
  const [werte, setWerte] = useState({ name: '', betrieb: '', email: '', telefon: '', paket: '', nachricht: '', firma: '' })
  const [angezeigtUm] = useState(() => Date.now())
  const [fehler, setFehler] = useState<string | null>(null)
  const [gesendet, setGesendet] = useState(false)
  const [pending, startTransition] = useTransition()

  const setzen = (k: keyof typeof werte) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setWerte((w) => ({ ...w, [k]: e.target.value }))

  function absenden(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await anfrageSendenAktion({ ...werte, art: 'founding_partner', wunschtag: '', tageszeit: '', angezeigtUm })
      if (ergebnis.fehler) setFehler(ergebnis.fehler)
      else setGesendet(true)
    })
  }

  if (gesendet) {
    return (
      <div className="rounded-2xl border border-m-gold/40 bg-white/5 p-8 text-center" role="status">
        <p className="font-marke text-2xl font-semibold text-white">Danke, deine Bewerbung ist da.</p>
        <p className="mt-2 text-white/70">Wir melden uns innerhalb eines Werktags und vereinbaren ein kurzes Gespräch.</p>
      </div>
    )
  }

  return (
    <form onSubmit={absenden} className="space-y-4 rounded-2xl border border-white/10 bg-m-nacht-2 p-5 sm:p-7" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="fp-name" className={label}>Dein Name *</label>
          <input id="fp-name" className={feld} value={werte.name} onChange={setzen('name')} autoComplete="name" required />
        </div>
        <div className="min-w-0">
          <label htmlFor="fp-betrieb" className={label}>Betrieb *</label>
          <input id="fp-betrieb" className={feld} value={werte.betrieb} onChange={setzen('betrieb')} autoComplete="organization" placeholder="z. B. Café Musterbetrieb" required />
        </div>
        <div className="min-w-0">
          <label htmlFor="fp-email" className={label}>E-Mail *</label>
          <input id="fp-email" type="email" className={feld} value={werte.email} onChange={setzen('email')} autoComplete="email" required />
        </div>
        <div className="min-w-0">
          <label htmlFor="fp-telefon" className={label}>Telefon (optional)</label>
          <input id="fp-telefon" type="tel" className={feld} value={werte.telefon} onChange={setzen('telefon')} autoComplete="tel" />
        </div>
      </div>
      <div>
        <label htmlFor="fp-paket" className={label}>Welches Paket interessiert dich?</label>
        <select id="fp-paket" className={`${feld} min-h-[46px]`} value={werte.paket} onChange={setzen('paket')}>
          <option value="" className="text-m-tinte">Weiß ich noch nicht</option>
          <option value="basic" className="text-m-tinte">Basic</option>
          <option value="plus" className="text-m-tinte">Plus</option>
          <option value="full" className="text-m-tinte">Full</option>
        </select>
      </div>
      <div>
        <label htmlFor="fp-nachricht" className={label}>Was soll Maestoso in deinem Betrieb erleichtern? (optional)</label>
        <textarea id="fp-nachricht" rows={3} className={feld} value={werte.nachricht} onChange={setzen('nachricht')} />
      </div>

      {/* Für Menschen unsichtbar – füllen nur Bots aus. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="fp-firma">Firma</label>
        <input id="fp-firma" tabIndex={-1} autoComplete="off" value={werte.firma} onChange={setzen('firma')} />
      </div>

      {fehler && <p className="rounded-xl bg-[#f6e3de] px-3.5 py-2.5 text-sm font-medium text-[#9c3a26]" role="alert">{fehler}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-white/50">
          Unverbindlich. Wir nutzen deine Angaben nur für deine Bewerbung, mehr in der{' '}
          <a href="/datenschutz" className="underline">Datenschutzerklärung</a>.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="whitespace-nowrap rounded-full bg-m-gold px-6 py-3 text-sm font-semibold text-m-nacht transition hover:bg-m-gold-hell disabled:opacity-50"
        >
          {pending ? 'Wird gesendet …' : 'Jetzt Founding Partner werden'}
        </button>
      </div>
    </form>
  )
}
