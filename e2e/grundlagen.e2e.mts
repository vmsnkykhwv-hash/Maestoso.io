// Header, Icons und Fehlerseite – unabhängig von Testdaten.
const PORT = 3200
const ok = (b: boolean, t: string) => { console.log(b ? '✓' : '✗', t); if (!b) process.exitCode = 1 }
const hole = (host: string, pfad: string) => fetch(`http://127.0.0.1:${PORT}${pfad}`, { headers: { host }, redirect: 'manual' })

const login = await hole('maestoso.test', '/login')
ok((login.headers.get('content-security-policy') ?? '').includes("frame-ancestors 'none'") && login.headers.get('x-frame-options') === 'DENY', 'Login nicht einbettbar (Clickjacking-Schutz)')
ok(!!login.headers.get('strict-transport-security') && !login.headers.get('x-powered-by'), 'HSTS gesetzt, kein X-Powered-By')

const icon = await hole('cafe-test.maestoso.test', '/icon.svg')
ok(icon.status === 200 && (icon.headers.get('content-type') ?? '').includes('svg'), 'Icon auch auf Betriebsdomain (nicht auf Website umgeschrieben)')
const apple = await hole('cafe-test.maestoso.test', '/apple-icon')
ok(apple.status === 200 && (apple.headers.get('content-type') ?? '').includes('png'), 'Apple-Icon als PNG')
const manifest = await hole('cafe-test.maestoso.test', '/manifest.webmanifest')
ok(manifest.status === 200 && (await manifest.json()).start_url === '/dashboard', 'Manifest mit Start im Dashboard')

const fehlt = await hole('maestoso.test', '/gibt-es-nicht')
ok(fehlt.status === 404 && (await fehlt.text()).includes('Seite nicht gefunden'), 'Deutsche 404-Seite')
