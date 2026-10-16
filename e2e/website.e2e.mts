// Öffentliche Website auf der Plattform-Domain: Startseite, Anfrage, Preise.
import fs from 'node:fs'
import { chromium } from 'playwright'

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
ok(preise.status === 404, 'Preisseite ist bis zur Freigabe versteckt')
const robots = await (await fetch(`http://127.0.0.1:${PORT}/robots.txt`, { headers: { host: 'maestoso.test' } })).text()
ok(robots.includes('Disallow: /dashboard') && robots.includes('Disallow: /plattform-admin'), 'robots.txt hält Verwaltungsbereiche aus der Suche')

await browser.close()
