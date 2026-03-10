const { execSync } = require('child_process');

const vars = [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', val: 'https://flhoavhmezwkiuqjdxzf.supabase.co' },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', val: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaG9hdmhtZXp3a2l1cWpkeHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODU3NTAsImV4cCI6MjA4Nzk2MTc1MH0.H0Ye0OyJUwBEde8-srsXfTUpxZ5E-Oa3ykNNyQkiQOg' },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', val: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaG9hdmhtZXp3a2l1cWpkeHpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM4NTc1MCwiZXhwIjoyMDg3OTYxNzUwfQ.RIh9MM9tPshZhWAJp-eKVTiQFlqC0bYvDcZTb1WH_80' }
];

const envs = ['production', 'preview', 'development'];

for (const v of vars) {
    for (const e of envs) {
        console.log(`Removing ${v.name} from ${e}...`);
        try {
            execSync(`npx vercel env rm ${v.name} ${e} --yes`, { stdio: 'ignore' });
        } catch (err) { }

        console.log(`Adding ${v.name} to ${e}...`);
        try {
            execSync(`npx vercel env add ${v.name} ${e}`, { input: v.val, stdio: ['pipe', 'inherit', 'inherit'] });
        } catch (err) {
            console.error(`Error adding ${v.name} to ${e}:`, err.message);
        }
    }
}
console.log('Finished updating Vercel environment variables.');
