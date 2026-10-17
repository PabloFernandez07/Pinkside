'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const DEBOUNCE_MS = 300

/** Recarga la página al instante cuando alguien cambia una de estas tablas (Supabase Realtime). No pinta nada. */
export function LiveRefresh({ tables }: { tables: readonly string[] }) {
  const router = useRouter()
  const key = tables.join(',')

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), DEBOUNCE_MS) // varios cambios seguidos = una sola recarga
    }

    const channel = supabase.channel(`live-${key}`)
    for (const table of key.split(',')) channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
    channel.subscribe()

    // Pestaña dormida o sin conexión: al volver se pone al día.
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [key, router])

  return null
}
