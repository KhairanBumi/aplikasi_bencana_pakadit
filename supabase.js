import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// URL menggunakan format tautan, Key menggunakan format sandi
const supabaseUrl = 'https://aggxzyzngewhlkebatxk.supabase.co'; 
const supabaseAnonKey = 'sb_publishable_vXBqqx_fpHh5zbEu9_MdGA_81awo3zA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});