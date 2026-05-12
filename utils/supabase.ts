import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://onlwhtzxflglsmbfhxao.supabase.co'
const supabaseAnonKey = 'sb_publishable_Ah6ig6Q0DoDmz67IrKB5HA_WtcL-W5Y'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)