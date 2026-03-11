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

    // Using getUser() for verification, with basic error handling
    try {
        const { data: { user }, error } = await supabase.auth.getUser()

        // Protect routes - exclude static assets, login and the landing page
        const isAuthPage = request.nextUrl.pathname.startsWith('/login')
        const isLandingPage = request.nextUrl.pathname === '/'

        if (!user && !isAuthPage && !isLandingPage) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            // Keep original search params if any
            return NextResponse.redirect(url)
        }

        // If user is logged in and trying to access /login, redirect to /
        if (user && isAuthPage) {
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return NextResponse.redirect(url)
        }
    } catch (err) {
        console.error('Middleware auth error:', err)
        // In case of error, we can still allow the request but logs the error
        // Or redirect to an error page if necessary
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
