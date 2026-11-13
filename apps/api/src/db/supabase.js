const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

// Cliente con service_role: SOLO servidor. Nunca exponer al frontend.
const supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

module.exports = { supabase };
