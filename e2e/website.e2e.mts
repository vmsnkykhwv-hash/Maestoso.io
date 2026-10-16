// Öffentliche Website auf der Plattform-Domain: Startseite, Anfrage, Preise.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { tokenErstellen } from '../lib/signiertesToken'

const PORT = 3200, SEITE = `http://maestoso.test:${PORT}`
const ok = (b: boolean, t: string) => { console.log(b ? '✓' : '✗', t); if (!b) process.exitCode = 1 }
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  args: ['--host-resolver-rules=MAP maestoso.test 127.0.0.1'],
})
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()

await p.goto(SEITE + '/')
ok(await p.getByRole('heading', { level: 1 }).isVisible(), 'Startseite zeigt die Hauptüberschrift')
ok((await p.locator('#funktionen article h3').first().innerText()) === 'Website', 'Website steht bei den Funktionen ganz oben')
ok((await p.locator('meta[name="robots"]').getAttribute('content'))?.includes('noindex') === true, 'Noch keine Indexierung, solange das Impressum Platzhalter hat')
ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Startseite ragt auf dem Handy nicht über den Rand')

await p.getByRole('link', { name: 'Demo anfragen' }).first().click()
await p.getByLabel('Dein Name *').fill('Erika Muster')
await p.getByLabel('Betrieb').fill('Café Musterbetrieb')
await p.getByLabel('E-Mail *').fill('erika@musterbetrieb.de')
await p.waitForTimeout(3200) // Spamschutz: Formular muss ein paar Sekunden offen sein
await p.locator('form').getByRole('button', { name: 'Demo anfragen' }).click()
ok(await p.getByText('Danke, deine Anfrage ist da.').waitFor({ timeout: 8000 }).then(() => true, () => false), 'Demo-Anfrage wird angenommen')
await p.waitForTimeout(1000)
const log = fs.readFileSync(process.env.E2E_NEXT_LOG ?? 'e2e/next.log', 'utf8')
ok(log.includes('Mail "Neue Anfrage" übersprungen'), 'Benachrichtigung an den Admin ausgelöst (ohne Resend nur geloggt)')

const preise = await fetch(`http://127.0.0.1:${PORT}/preise`, { headers: { host: 'maestoso.test' } })
const preiseHtml = await preise.text()
ok(preise.status === 200 && preiseHtml.includes('149') && preiseHtml.includes('Einzelne Module'), 'Preisseite ist freigegeben und zeigt die Pakete')
const robots = await (await fetch(`http://127.0.0.1:${PORT}/robots.txt`, { headers: { host: 'maestoso.test' } })).text()
ok(robots.includes('Disallow: /dashboard') && robots.includes('Disallow: /plattform-admin'), 'robots.txt hält Verwaltungsbereiche aus der Suche')

// Abmeldelink aus der Bewertungsmail: erst der Klick meldet ab, nicht schon das Öffnen.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const { data: org } = await db.from('organisationen').insert({ name: 'Café Abmeldung' }).select('id').single()
const token = await tokenErstellen({ o: org!.id, e: 'gast@musterbetrieb.de' }, 60_000)
await p.goto(`${SEITE}/bewertung-abmelden?t=${encodeURIComponent(token)}`)
const vorher = await db.from('bewertung_abmeldungen').select('email').eq('organisation_id', org!.id)
ok((await p.getByText('Keine Bewertungsanfragen mehr?').isVisible()) && vorher.data!.length === 0, 'Abmeldeseite erreichbar, Öffnen allein meldet nicht ab')
await p.getByRole('button', { name: 'Abmelden' }).click()
await p.waitForURL(/fertig=1/, { timeout: 15000 }).catch(() => {})
// Als Überschrift suchen: nach der Navigation steht derselbe Text auch im
// Ansage-Element von Next.js für Screenreader.
ok(await p.getByRole('heading', { name: 'Du bist abgemeldet' }).waitFor({ timeout: 8000 }).then(() => true, () => false), 'Abmeldung bestätigt')
const nachher = await db.from('bewertung_abmeldungen').select('email').eq('organisation_id', org!.id)
ok(nachher.data?.[0]?.email === 'gast@musterbetrieb.de', 'Abmeldung gespeichert')
await p.goto(`${SEITE}/bewertung-abmelden?t=${encodeURIComponent(token.slice(0, -3) + 'xyz')}`)
ok(await p.getByText('Link ungültig').isVisible(), 'Manipulierter Link wird abgelehnt')

await browser.close()
