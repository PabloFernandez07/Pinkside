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
      // Auditoría: cada vuelta de Discord queda registrada; si falla, no impide entrar.
      const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
      await supabase.rpc('log_access', { p_ip: ip, p_user_agent: request.headers.get('user-agent') ?? '' })

      // Lleva a este dispositivo el tema y el acento guardados en el perfil.
      const { data: prefs } = await supabase
        .from('profiles')
        .select('theme, accent, status')
        .eq('id', data.user.id)
        .maybeSingle()
      // ID de Discord sin autorizar: se registró su intento y se le cierra la sesión.
      if (prefs?.status === 'denied') {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=denied`)
      }
      writePreferenceCookies(
        await cookies(),
        isTheme(prefs?.theme) ? prefs.theme : DEFAULT_THEME,
        isAccent(prefs?.accent) ? prefs.accent : DEFAULT_ACCENT,
      )
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  // Si el ID de Discord no está en la lista de acceso, el registro falla en la base de datos y Supabase
  // devuelve este error (sin `code`). Es la única causa habitual, así que se explica con un mensaje propio.
  const description = searchParams.get('error_description') ?? ''
  const denied = !code && /saving new user/i.test(description)
  return NextResponse.redirect(`${origin}/login?error=${denied ? 'denied' : 'auth'}`)
}
