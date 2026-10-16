'use client'

import { useState, useTransition } from 'react'
import { anfrageSendenAktion } from '@/app/anfrage-actions'

type Art = 'demo' | 'frage' | 'sonstiges'

const feld = 'w-full rounded-xl border border-m-linie bg-white px-3.5 py-2.5 text-[15px] text-m-tinte placeholder:text-m-leise/70 focus:border-m-gold-dunkel focus:outline-none focus:ring-2 focus:ring-m-gold/40'
const label = 'mb-1.5 block text-sm font-medium text-m-tinte'

export default function KontaktFormular() {
  const [art, setArt] = useState<Art>('demo')
  const [werte, setWerte] = useState({ name: '', betrieb: '', email: '', telefon: '', wunschtag: '', tageszeit: '', nachricht: '', firma: '' })
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
      const ergebnis = await anfrageSendenAktion({ ...werte, art, angezeigtUm })
      if (ergebnis.fehler) setFehler(ergebnis.fehler)
      else setGesendet(true)
    })
  }

  if (gesendet) {
    return (
      <div className="rounded-2xl border border-m-linie bg-white p-8 text-center" role="status">
        <p className="font-marke text-2xl font-semibold text-m-tinte">Danke, deine Anfrage ist da.</p>
        <p className="mt-2 text-m-leise">
          Wir melden uns in der Regel innerhalb eines Werktags per E-Mail{art === 'demo' ? ' und schlagen dir einen Termin vor' : ''}.
        </p>
      </div>
    )
  }

  const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })

  return (
    <form onSubmit={absenden} className="space-y-5 rounded-2xl border border-m-linie bg-white p-5 sm:p-7" noValidate>
      <fieldset>
        <legend className={label}>Worum geht es?</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['demo', 'Demo-Termin'],
              ['frage', 'Frage'],
              ['sonstiges', 'Sonstiges'],
            ] as const
          ).map(([wert, text]) => (
            <button
              key={wert}
              type="button"
              onClick={() => setArt(wert)}
              aria-pressed={art === wert}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                art === wert ? 'border-m-tinte bg-m-tinte text-white' : 'border-m-linie bg-m-creme text-m-tinte hover:border-m-gold-dunkel'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="k-name" className={label}>Dein Name *</label>
          <input id="k-name" className={feld} value={werte.name} onChange={setzen('name')} autoComplete="name" required />
        </div>
        <div>
          <label htmlFor="k-betrieb" className={label}>Betrieb</label>
          <input id="k-betrieb" className={feld} value={werte.betrieb} onChange={setzen('betrieb')} autoComplete="organization" placeholder="z. B. Café Musterbetrieb" />
        </div>
        <div>
          <label htmlFor="k-email" className={label}>E-Mail *</label>
          <input id="k-email" type="email" className={feld} value={werte.email} onChange={setzen('email')} autoComplete="email" required />
        </div>
        <div>
          <label htmlFor="k-telefon" className={label}>Telefon (optional)</label>
          <input id="k-telefon" type="tel" className={feld} value={werte.telefon} onChange={setzen('telefon')} autoComplete="tel" />
        </div>
      </div>

      {art === 'demo' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="k-tag" className={label}>Wunschtag</label>
            <input
              id="k-tag"
              type="date"
              min={heute}
              className={`${feld} block min-h-[46px] min-w-0 appearance-none text-left [&::-webkit-date-and-time-value]:text-left`}
              value={werte.wunschtag}
              onChange={setzen('wunschtag')}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="k-zeit" className={label}>Tageszeit</label>
            <select id="k-zeit" className={`${feld} min-h-[46px]`} value={werte.tageszeit} onChange={setzen('tageszeit')}>
              <option value="">egal</option>
              <option value="vormittags">vormittags</option>
              <option value="nachmittags">nachmittags</option>
              <option value="abends">abends</option>
            </select>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="k-nachricht" className={label}>
          {art === 'demo' ? 'Was interessiert dich besonders? (optional)' : 'Deine Nachricht *'}
        </label>
        <textarea id="k-nachricht" rows={4} className={feld} value={werte.nachricht} onChange={setzen('nachricht')} />
      </div>

      {/* Für Menschen unsichtbar, Bots füllen es aus. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="k-firma">Firma</label>
        <input id="k-firma" tabIndex={-1} autoComplete="off" value={werte.firma} onChange={setzen('firma')} />
      </div>

      {fehler && <p className="rounded-xl bg-[#f6e3de] px-3.5 py-2.5 text-sm font-medium text-[#9c3a26]" role="alert">{fehler}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-m-leise">
          Wir nutzen deine Angaben nur, um deine Anfrage zu beantworten. Mehr in der{' '}
          <a href="/datenschutz" className="underline">Datenschutzerklärung</a>.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="whitespace-nowrap rounded-full bg-m-tinte px-6 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {pending ? 'Wird gesendet …' : art === 'demo' ? 'Demo anfragen' : 'Nachricht senden'}
        </button>
      </div>
    </form>
  )
}
