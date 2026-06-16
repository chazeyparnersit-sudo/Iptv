const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://vrauojztjfkpgwxkdbia.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyYXVvanp0amZrcGd3eGtkYmlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQ2NjgzNCwiZXhwIjoyMDk3MDQyODM0fQ.JwRsuCJgU6uDcUuHPZc-UUaKYoaPkgJn9hG3ZWgnXyM'
)

async function migrate() {
  const db = JSON.parse(fs.readFileSync('db.json', 'utf8'))

  console.log('Migrando usuarios...')
  const { error: e1 } = await supabase.from('users').upsert(db.users)
  if (e1) { console.error('ERROR users:', e1.message); process.exit(1) }
  console.log('✓ Usuarios migrados:', db.users.length)

  console.log('Migrando TVs...')
  const { error: e2 } = await supabase.from('tvs').upsert(db.tvs)
  if (e2) { console.error('ERROR tvs:', e2.message); process.exit(1) }
  console.log('✓ TVs migradas:', db.tvs.length)

  console.log('Migrando canales...')
  const { error: e3 } = await supabase.from('channels').upsert(db.channels)
  if (e3) { console.error('ERROR channels:', e3.message); process.exit(1) }
  console.log('✓ Canales migrados:', db.channels.length)

  if (db.schedule.length > 0) {
    console.log('Migrando schedule...')
    const { error: e4 } = await supabase.from('schedule').upsert(db.schedule)
    if (e4) { console.error('ERROR schedule:', e4.message); process.exit(1) }
    console.log('✓ Schedule migrado:', db.schedule.length)
  } else {
    console.log('✓ Schedule vacío, saltando')
  }

  console.log('\n✅ Migración completa')
}

migrate().catch(console.error)
