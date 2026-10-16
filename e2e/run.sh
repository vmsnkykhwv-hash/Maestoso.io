#!/usr/bin/env bash
# Browser-Tests komplett lokal: Testdatenbank starten, Migrationen
# einspielen, App mit Testumgebung bauen und starten, Tests ausführen.
# Aufruf: npm run e2e  (braucht Docker; Chromium per `npx playwright install chromium`
# oder CHROMIUM_PATH auf ein vorhandenes Chromium setzen)
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f e2e/docker-compose.yml -p maestoso-e2e"
PSQL="$COMPOSE exec -T -e PGOPTIONS=--client-min-messages=warning db psql -U postgres -d maestoso -v ON_ERROR_STOP=1 -q"
JWT_SECRET=e2e-nur-fuer-tests-e2e-nur-fuer-tests-123

# Der App-Server läuft in einer eigenen Prozessgruppe: `next start` startet
# Unterprozesse, die ein kill auf die Eltern-PID allein überleben würden.
aufraeumen() {
  [ -n "${NEXT_PID:-}" ] && kill -- -"$NEXT_PID" 2>/dev/null || true
  [ -n "${GATEWAY_PID:-}" ] && kill "$GATEWAY_PID" 2>/dev/null || true
  [ -z "${E2E_DB_BEHALTEN:-}" ] && $COMPOSE down -v >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

if curl -s -o /dev/null http://127.0.0.1:3200; then
  echo "Port 3200 ist belegt – läuft noch ein alter Server?" >&2
  exit 1
fi

$COMPOSE down -v >/dev/null 2>&1 || true
$COMPOSE up -d --wait db 2>/dev/null
$PSQL < e2e/init.sql
for f in supabase/migrations/*.sql; do $PSQL < "$f" > /dev/null; done
$COMPOSE up -d rest 2>/dev/null
$PSQL < e2e/grants.sql

node e2e/gateway.mjs &
GATEWAY_PID=$!

SERVICE_KEY=$(node -e "const c=require('crypto');const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'}),p=b({role:'service_role'});console.log(h+'.'+p+'.'+c.createHmac('sha256','$JWT_SECRET').update(h+'.'+p).digest('base64url'))")
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
export SESSION_SECRET=$(openssl rand -hex 32)
export ZWEI_FAKTOR_SCHLUESSEL=$(openssl rand -hex 32)
export PLATTFORM_ADMIN_PIN=482913
export CRON_SECRET=e2e-cron-geheimnis
export NEXT_PUBLIC_PLATTFORM_DOMAIN=maestoso.test
export E2E_NEXT_LOG=e2e/next.log
unset RESEND_API_KEY VERCEL_API_TOKEN

npm run build > e2e/build.log 2>&1 || { tail -30 e2e/build.log; exit 1; }
PORT=3200 setsid npx next start > "$E2E_NEXT_LOG" 2>&1 &
NEXT_PID=$!
for _ in $(seq 1 30); do curl -s -o /dev/null -H "Host: maestoso.test" http://127.0.0.1:3200/login && break; sleep 1; done

status=0
for t in ${E2E_NUR:-e2e/*.e2e.mts}; do
  echo "== $t"
  $PSQL -c "truncate organisationen, plattform_admins, login_versuche cascade"
  npx tsx "$t" || status=1
done
exit $status
