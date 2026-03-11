import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Simplified route protection
    const { pathname } = request.nextUrl
    const isAuthPage = pathname.startsWith('/login')
    const isLandingPage = pathname === '/'
    const isPublicFile = pathname.includes('.') || pathname.startsWith('/_next')

    if (isPublicFile) return response

    try {
        // Use a timeout to prevent middleware from hanging if Supabase is slow
        const getUserWithTimeout = Promise.race([
            supabase.auth.getUser(),
            new Promise<any>((_, reject) =>
                setTimeout(() => reject(new Error('Auth timeout')), 3000)
            )
        ])

        const { data: { user } } = await getUserWithTimeout

        if (!user && !isAuthPage && !isLandingPage) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        if (user && isAuthPage) {
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return NextResponse.redirect(url)
        }
    } catch (err) {
        console.error('Middleware auth error or timeout:', err)
        // If Supabase fails or times out, we allow the request to continue
        // to avoid a 504 timeout on Vercel. The page component will handle the empty session.
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
