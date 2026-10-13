import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { getAccess } from '@/lib/access'
import { routeForStatus } from '@/lib/rules'

export const metadata: Metadata = { title: 'Acceso pendiente' }

export default async function PendientePage() {
  const access = await getAccess()
  if (access.state === 'anon') redirect('/login')
  if (access.state === 'orphan') redirect('/')
  const { status } = access.profile
  if (status !== 'pending' && status !== 'blocked') redirect(routeForStatus(status))

  const blocked = status === 'blocked'
  return (
    <main className="auth">
      <section className="auth-card">
        <div className="brand">
          <i aria-hidden="true" />
          Pinkside
        </div>
        <h1>{blocked ? 'Acceso bloqueado' : 'Ficha enviada'}</h1>
        <p className="muted">
          {blocked
            ? 'Un administrador ha bloqueado tu acceso. Si crees que es un error, habla con él por Discord.'
            : 'Un administrador tiene que aprobar tu acceso. Vuelve a comprobarlo en un rato.'}
        </p>
        <div className="actions">
          {!blocked && (
            <Link href="/" className="btn">
              Comprobar de nuevo
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className="btn ghost">
              Salir
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
