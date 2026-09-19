import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import { getPublicEnvironment } from "@/lib/env.client"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const environment = getPublicEnvironment()
  const client = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) {
    const signIn = request.nextUrl.clone()
    signIn.pathname = "/sign-in"
    signIn.searchParams.set("next", request.nextUrl.pathname)
    return NextResponse.redirect(signIn)
  }

  return response
}

export const config = {
  matcher: ["/notebooks/:path*"],
}
