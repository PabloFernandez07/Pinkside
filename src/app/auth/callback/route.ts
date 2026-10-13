import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAccent, isTheme, writePreferenceCookies, DEFAULT_ACCENT, DEFAULT_THEME } from '@/lib/accents'
import { safeNextPath } from '@/lib/rules'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Lleva a este dispositivo el tema y el acento guardados en el perfil.
      const { data: prefs } = await supabase
        .from('profiles')
        .select('theme, accent')
        .eq('id', data.user.id)
        .maybeSingle()
      writePreferenceCookies(
        await cookies(),
        isTheme(prefs?.theme) ? prefs.theme : DEFAULT_THEME,
        isAccent(prefs?.accent) ? prefs.accent : DEFAULT_ACCENT,
      )
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
