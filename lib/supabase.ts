import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://vrauojztjfkpgwxkdbia.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyYXVvanp0amZrcGd3eGtkYmlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQ2NjgzNCwiZXhwIjoyMDk3MDQyODM0fQ.JwRsuCJgU6uDcUuHPZc-UUaKYoaPkgJn9hG3ZWgnXyM'
)
