import { get } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { chromium, type Page } from 'playwright'
import { aktuellerCode } from '../lib/konten/totp'

const PORT = 3200, CAFE = `http://cafe-test.maestoso.test:${PORT}`, ADMIN = `http://maestoso.test:${PORT}`
const ok = (b: boolean, t: string) => { console.log(b ? '✓' : '✗', t); if (!b) process.exitCode = 1 }
const sichtbar = (p: Page, text: string) => p.getByText(text).first().waitFor({ timeout: 8000 }).then(() => true, () => false)
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  args: [
  '--host-resolver-rules=MAP *.maestoso.test 127.0.0.1, MAP maestoso.test 127.0.0.1',
  `--unsafely-treat-insecure-origin-as-secure=${ADMIN},${CAFE}` ] })
const lokal = (link: string) => link.replace('https://', 'http://').replace('.maestoso.test/', `.maestoso.test:${PORT}/`)
async function zweiFa(p: Page) {
  await p.getByText('Oder von Hand eingeben').waitFor()
  const g = (await p.locator('span.font-mono').first().textContent()).replace(/\s/g, '')
  await p.getByPlaceholder('123456').fill(aktuellerCode(g))
  await p.getByRole('button', { name: 'Einrichtung abschließen' }).click()
  await p.getByRole('button', { name: 'Gesichert – weiter' }).click()
}
const cron = (secret?: string) =>
  fetch(`http://127.0.0.1:${PORT}/api/cron/testphase`, { headers: { host: 'maestoso.test', ...(secret ? { authorization: `Bearer ${secret}` } : {}) } })
const tageAb = (tage: number) => new Date(Date.now() + tage * 86400000).toISOString()

const admin = await (await browser.newContext()).newPage()
await admin.goto(`${ADMIN}/login`)
await admin.getByLabel('PLATTFORM_ADMIN_PIN').fill('482913')
await admin.getByLabel('E-Mail').fill('admin@musterbetrieb.de')
await admin.getByLabel(/^Passwort \(mind/).fill('Lange-Sichere-Phrase-77')
await admin.getByLabel('Passwort wiederholen').fill('Lange-Sichere-Phrase-77')
await admin.getByRole('button', { name: 'Admin-Konto anlegen' }).click()
await zweiFa(admin); await admin.waitForURL('**/plattform-admin')
await admin.getByPlaceholder('Name (z. B. Café Musterbetrieb)').fill('Café Test')
await admin.getByPlaceholder('E-Mail Inhaber*in').fill('inhaber@musterbetrieb.de')
await admin.getByRole('button', { name: 'Anlegen und einladen' }).click()
const link = lokal((await admin.locator('button.font-mono span').first().textContent())!)
ok(await sichtbar(admin, 'Test bis '), 'Neuer Betrieb startet in der Testphase')

const inhaber = await (await browser.newContext()).newPage()
await inhaber.goto(link)
await inhaber.getByLabel(/^Neues Passwort/).fill('Kaffee-Bohnen-Tresen-42')
await inhaber.getByLabel('Passwort wiederholen').fill('Kaffee-Bohnen-Tresen-42')
await inhaber.getByRole('button', { name: 'Passwort festlegen' }).click()
await zweiFa(inhaber)
await inhaber.waitForURL('**/dashboard')

const { data: org } = await db.from('organisationen').select('id, test_bis').eq('name', 'Café Test').single()
const tage = (new Date(org!.test_bis).getTime() - Date.now()) / 86400000
ok(tage > 29 && tage <= 30, `Testphase endet in 30 Tagen (${tage.toFixed(2)})`)

// Testphase abgelaufen – gesperrt schon vor dem Cron-Lauf
await db.from('organisationen').update({ test_bis: tageAb(-1) }).eq('id', org!.id)
await inhaber.goto(`${CAFE}/dashboard`)
ok(await sichtbar(inhaber, 'Diese Seite ist gerade nicht erreichbar'), 'Abgelaufener Test: Dashboard gesperrt (ohne Cron)')
await inhaber.goto(`${CAFE}/team`)
ok(await sichtbar(inhaber, 'Diese Seite ist gerade nicht erreichbar'), 'Abgelaufener Test: Team-Anmeldung gesperrt')
const gast = await (await browser.newContext()).newPage()
await gast.goto(`${CAFE}/reservieren`)
ok(await sichtbar(gast, 'Diese Seite ist gerade nicht erreichbar'), 'Abgelaufener Test: Gästeseite gesperrt')
// Alte interne Adresse auf der Plattform-Domain: Umleitung auf den Betrieb,
// dort greift die Sperrseite.
// (fetch() lässt keinen eigenen Host-Header zu, deshalb node:http.)
const intern = await new Promise<{ status?: number; location?: string }>((fertig) =>
  get({ host: '127.0.0.1', port: PORT, path: `/reservieren/${org!.id}`, headers: { host: 'maestoso.test' } }, (r) => {
    r.resume(); fertig({ status: r.statusCode, location: r.headers.location })
  }))
ok(intern.status === 308 && (intern.location ?? '').startsWith('https://cafe-test.maestoso.test/'), `Alte Plattform-Adresse leitet auf die (gesperrte) Betriebsdomain (${intern.status} ${intern.location})`)

ok((await cron()).status === 401, 'Cron ohne Secret abgelehnt')
ok((await cron('falsch')).status === 401, 'Cron mit falschem Secret abgelehnt')
const lauf = await cron(process.env.CRON_SECRET)
const ereignisse = ((await lauf.json()) as { ereignisse: string[] }).ereignisse
ok(lauf.status === 200 && ereignisse.some((e) => e.includes('gesperrt')), `Cron sperrt: ${ereignisse.join(' | ')}`)
const { data: gesperrt } = await db.from('organisationen').select('vertrag_status, loeschung_am').eq('id', org!.id).single()
const bisLoeschung = (new Date(gesperrt!.loeschung_am).getTime() - Date.now()) / 86400000
ok(gesperrt!.vertrag_status === 'gesperrt' && bisLoeschung > 29 && bisLoeschung <= 30, 'Status gesperrt, Löschung in 30 Tagen')
const zweiterLauf = ((await (await cron(process.env.CRON_SECRET)).json()) as { ereignisse: string[] }).ereignisse
ok(zweiterLauf.length === 0, 'Zweiter Cron-Lauf am selben Tag ändert nichts')

await admin.reload()
ok(await sichtbar(admin, 'Gesperrt · Löschung am'), 'Admin sieht Sperre und Löschdatum')
await admin.getByRole('button', { name: 'Test verlängern (+14 Tage)' }).click()
ok(await sichtbar(admin, 'Test bis '), 'Admin verlängert den Test')
await inhaber.goto(`${CAFE}/dashboard`)
ok(!(await inhaber.getByText('Diese Seite ist gerade nicht erreichbar').isVisible()) && inhaber.url() === `${CAFE}/dashboard`, 'Nach Verlängerung: Dashboard wieder offen, Sitzung gilt weiter')

await admin.getByRole('button', { name: 'Vertrag aktiv' }).click()
ok(await sichtbar(admin, 'Vertrag aktiv'), 'Admin setzt Vertrag aktiv')
await db.from('organisationen').update({ test_bis: tageAb(-100) }).eq('id', org!.id)
await inhaber.reload()
ok(inhaber.url() === `${CAFE}/dashboard` && !(await inhaber.getByText('Diese Seite ist gerade nicht erreichbar').isVisible()), 'Aktiver Vertrag: altes Testende spielt keine Rolle')

// Löschfrist abgelaufen
await db.from('organisationen').update({ vertrag_status: 'gesperrt', loeschung_am: tageAb(-1) }).eq('id', org!.id)
const loeschLauf = ((await (await cron(process.env.CRON_SECRET)).json()) as { ereignisse: string[] }).ereignisse
const { data: weg } = await db.from('organisationen').select('id').eq('id', org!.id).maybeSingle()
const { count: konten } = await db.from('benutzer').select('id', { count: 'exact', head: true }).eq('organisation_id', org!.id)
ok(!weg && konten === 0 && loeschLauf.some((e) => e.includes('gelöscht')), 'Nach Ablauf der Frist: Betrieb samt Konten gelöscht')

await browser.close()
