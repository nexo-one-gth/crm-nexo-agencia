require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    const { data, error } = await supabase.from('leads').select('*').limit(10);
    console.log('Using service role (bypass RLS) works?', !!data, error || '');

    // But we want to see policies
    const { data: policies, error: pe } = await supabase.from('pg_policies').select('*').eq('tablename', 'leads');
    console.log('Policies for leads:', policies || pe);
}

check();
