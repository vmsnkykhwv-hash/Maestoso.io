import { createClient } from '@supabase/supabase-js'

// Nur serverseitig verwenden (Server Actions/Components) – der Service-Role-Key
// umgeht Row Level Security komplett. Es gibt bewusst keinen Browser-Client:
// weder Organisationen noch der Plattform-Admin bekommen direkten DB-Zugriff,
// nur über die Server Actions.
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase-Umgebungsvariablen fehlen')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
