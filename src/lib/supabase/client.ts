import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase client error: Missing environment variables', {
            url: !!supabaseUrl,
            key: !!supabaseKey
        })
    }

    return createBrowserClient(
        supabaseUrl!,
        supabaseKey!
    )
}
