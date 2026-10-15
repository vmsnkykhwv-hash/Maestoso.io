import { chromium, type Page } from 'playwright'
import { aktuellerCode } from '../lib/konten/totp'

const PORT = 3200, BASIS = (h: string) => `http://${h}.maestoso.test:${PORT}`.replace('http://.', 'http://')
const ADMIN = `http://maestoso.test:${PORT}`
const sichtbar = (p: Page, text: string) => p.getByText(text).first().waitFor({ timeout: 8000 }).then(() => true, () => false)
const ok = (b: boolean, t: string) => { console.log(b ? '✓' : '✗', t); if (!b) process.exitCode = 1 }
const browser = await chromium.launch({
  // Volles Chromium statt Headless-Shell: nur dieses respektiert die
  // Ausnahme für die http-Testadressen, ohne sie setzt der Browser unsere
  // Secure-Cookies (Anmeldung) nicht.
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  args: [
  '--host-resolver-rules=MAP *.maestoso.test 127.0.0.1, MAP maestoso.test 127.0.0.1',
  `--unsafely-treat-insecure-origin-as-secure=${ADMIN},${BASIS('cafe-test')},${BASIS('andere')}` ] })
const lokal = (link: string) => link.replace('https://', 'http://').replace('.maestoso.test/', `.maestoso.test:${PORT}/`)
async function neuerSchritt() { const s = Math.floor(Date.now() / 30000); while (Math.floor(Date.now() / 30000) === s) await new Promise(r => setTimeout(r, 500)) }
async function zweiFaEinrichten(p: Page) {
  await p.getByText('Oder von Hand eingeben').waitFor()
  const geheimnis = (await p.locator('span.font-mono').first().textContent()).replace(/\s/g, '')
  await p.getByPlaceholder('123456').fill(aktuellerCode(geheimnis))
  await p.getByRole('button', { name: 'Einrichtung abschließen' }).click()
  await p.getByText('Wiederherstellungscodes sichern').waitFor({ timeout: 10000 }).catch(async (e: unknown) => { await p.screenshot({ path: 'e2e/fehler.png' }); throw e })
  const codes = await p.locator('ul li').allTextContents()
  await p.getByRole('button', { name: 'Gesichert – weiter' }).click()
  return { geheimnis, codes }
}

// 1. Admin-Ersteinrichtung
const admin = await (await browser.newContext()).newPage()
await admin.goto(`${ADMIN}/login`)
await admin.getByLabel('PLATTFORM_ADMIN_PIN').fill('000000')
await admin.getByLabel('E-Mail').fill('admin@musterbetrieb.de')
await admin.getByLabel(/^Passwort \(mind/).fill('Lange-Sichere-Phrase-77')
await admin.getByLabel('Passwort wiederholen').fill('Lange-Sichere-Phrase-77')
await admin.getByRole('button', { name: 'Admin-Konto anlegen' }).click()
ok(await sichtbar(admin, 'PIN falsch.'), 'Ersteinrichtung mit falschem PIN abgelehnt')
await admin.getByLabel('PLATTFORM_ADMIN_PIN').fill('482913')
await admin.getByRole('button', { name: 'Admin-Konto anlegen' }).click()
const adminZweiFa = await zweiFaEinrichten(admin)
ok(adminZweiFa.codes.length === 10, '10 Wiederherstellungscodes angezeigt')
await admin.waitForURL('**/plattform-admin')
ok(true, 'Admin nach 2FA-Einrichtung im Plattform-Admin')

// 2. Zwei Betriebe anlegen
async function betriebAnlegen(name: string, email: string) {
  await admin.getByPlaceholder('Name (z. B. Café Musterbetrieb)').fill(name)
  await admin.getByPlaceholder('Name Inhaber*in').fill('Ina Haber')
  await admin.getByPlaceholder('E-Mail Inhaber*in').fill(email)
  await admin.getByRole('button', { name: 'Anlegen und einladen' }).click()
  const link = admin.locator('button.font-mono span').first()
  await link.waitFor()
  const text = (await link.textContent())!
  await admin.reload()
  return lokal(text)
}
const einladungCafe = await betriebAnlegen('Café Test', 'inhaber@musterbetrieb.de')
const einladungAndere = await betriebAnlegen('Andere', 'andere@musterbetrieb.de')
ok(einladungCafe.startsWith(`${BASIS('cafe-test')}/team/einladung?token=`), `Einladungslink auf Betriebsdomain: ${einladungCafe.slice(0, 60)}…`)

// 3. Gästeseite unter der Subdomain
const gast = await (await browser.newContext()).newPage()
await gast.goto(`${BASIS('cafe-test')}/reservieren`)
ok(await gast.getByText('Tisch reservieren bei Café Test').isVisible(), 'Gästeseite /reservieren auf der Subdomain')
ok(await gast.locator('footer a', { hasText: 'Impressum' }).getAttribute('href') === '/impressum', 'Fußzeile mit kurzem Link /impressum')

// 4. Fremde Einladung auf falscher Domain
await gast.goto(einladungAndere.replace(BASIS('andere'), BASIS('cafe-test')))
ok(await sichtbar(gast, 'ungültig, abgelaufen'), 'Einladung von Betrieb B auf Domain von A abgelehnt')

// 5. Einladung annehmen + 2FA
const inhaberCtx = await browser.newContext(), inhaber = await inhaberCtx.newPage()
await inhaber.goto(einladungCafe)
await inhaber.getByLabel('Dein Name').fill('Ina Haber')
await inhaber.getByLabel(/^Neues Passwort/).fill('kurz')
await inhaber.getByLabel('Passwort wiederholen').fill('kurz')
await inhaber.getByRole('button', { name: 'Passwort festlegen' }).click()
ok(await sichtbar(inhaber, 'mindestens 12 Zeichen'), 'Zu kurzes Passwort abgelehnt')
await inhaber.getByLabel(/^Neues Passwort/).fill('Kaffee-Bohnen-Tresen-42')
await inhaber.getByLabel('Passwort wiederholen').fill('Kaffee-Bohnen-Tresen-42')
await inhaber.getByRole('button', { name: 'Passwort festlegen' }).click()
const inhaberZweiFa = await zweiFaEinrichten(inhaber)
await inhaber.waitForURL('**/dashboard')
ok(inhaber.url() === `${BASIS('cafe-test')}/dashboard`, 'Inhaber nach Einrichtung im Dashboard der eigenen Domain')
await inhaber.goto(einladungCafe)
ok(await inhaber.getByText('ungültig, abgelaufen').isVisible() || inhaber.url().endsWith('/dashboard'), 'Einladungslink nur einmal nutzbar')

// 6. Sitzung gilt nicht beim anderen Betrieb
await inhaber.goto(`${BASIS('andere')}/dashboard`)
ok(inhaber.url() === `${BASIS('andere')}/team`, 'Dashboard von Betrieb B leitet auf dessen /team')

// 7. Abmelden und normal anmelden (mit Replay-Schutz: neuer 30-s-Schritt)
await inhaber.goto(`${BASIS('cafe-test')}/dashboard`)
await inhaber.getByRole('button', { name: 'Abmelden' }).first().click()
await inhaber.waitForURL('**/team')
await inhaber.getByLabel('E-Mail').fill('inhaber@musterbetrieb.de')
await inhaber.getByLabel('Passwort').fill('falsch-falsch-falsch')
await inhaber.getByRole('button', { name: 'Weiter' }).click()
ok(await sichtbar(inhaber, 'E-Mail oder Passwort falsch.'), 'Falsches Passwort abgelehnt')
await inhaber.getByLabel('Passwort').fill('Kaffee-Bohnen-Tresen-42')
await inhaber.getByRole('button', { name: 'Weiter' }).click()
await inhaber.getByLabel('Code aus deiner Authenticator-App').waitFor()
ok(!(await inhaberCtx.cookies()).some((c) => c.name === 'sfp_session'), 'Nach Passwort allein noch keine Sitzung')
await inhaber.getByLabel('Code aus deiner Authenticator-App').fill(aktuellerCode(inhaberZweiFa.geheimnis))
await inhaber.getByRole('button', { name: 'Anmelden' }).click()
ok(await sichtbar(inhaber, 'Code ungültig.'), 'Bereits benutzter Code (gleicher 30-s-Schritt) abgelehnt')
await neuerSchritt()
await inhaber.getByLabel('Code aus deiner Authenticator-App').fill(aktuellerCode(inhaberZweiFa.geheimnis))
await inhaber.getByRole('button', { name: 'Anmelden' }).click()
await inhaber.waitForURL('**/dashboard')
ok(true, 'Anmeldung mit Passwort + neuem Code')

// 8. Wiederherstellungscode
await inhaber.getByRole('button', { name: 'Abmelden' }).first().click()
await inhaber.waitForURL('**/team')
await inhaber.getByLabel('E-Mail').fill('inhaber@musterbetrieb.de')
await inhaber.getByLabel('Passwort').fill('Kaffee-Bohnen-Tresen-42')
await inhaber.getByRole('button', { name: 'Weiter' }).click()
await inhaber.getByRole('button', { name: /Wiederherstellungscode/ }).click()
await inhaber.getByLabel('Wiederherstellungscode').fill(inhaberZweiFa.codes[0])
await inhaber.getByRole('button', { name: 'Anmelden' }).click()
await inhaber.waitForURL('**/dashboard')
ok(true, 'Anmeldung mit Wiederherstellungscode')

// 9. Admin setzt 2FA zurück → Inhaber-Sitzung sofort ungültig
await admin.reload()
await admin.getByRole('button', { name: '2FA zurücksetzen' }).first().click()
await admin.getByRole('button', { name: /Wirklich zurücksetzen/ }).click()
await admin.waitForTimeout(1500)
await inhaber.goto(`${BASIS('cafe-test')}/dashboard/tischplan`)
ok(inhaber.url().endsWith('/team'), 'Nach 2FA-Reset durch Admin ist die Inhaber-Sitzung beendet')

// 10. Admin-Bereich auf Betriebsdomain nicht erreichbar
await gast.goto(`${BASIS('cafe-test')}/plattform-admin`)
ok(!(await gast.content()).includes('Plattform-Admin'), '/plattform-admin auf Betriebsdomain zeigt nicht den Admin')
await browser.close()
