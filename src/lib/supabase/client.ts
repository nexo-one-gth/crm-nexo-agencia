import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase client error: Missing environment variables', {
            url: !!supabaseUrl,
            key: !!supabaseKey
        })
    }

    return createBrowserClient<Database>(
        supabaseUrl!,
        supabaseKey!
    )
}
