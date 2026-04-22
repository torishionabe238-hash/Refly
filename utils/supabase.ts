import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://archspufopbgrlaprfgg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyY2hzcHVmb3BiZ3JsYXByZmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTA1MDAsImV4cCI6MjA5MjE2NjUwMH0.1tawvhXTxtT_XJ8JbeySqCfl1sNMu2jMZSgq9P9AB1g'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)