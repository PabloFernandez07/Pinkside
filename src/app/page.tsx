import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { getAccess } from '@/lib/access'
import { routeForStatus } from '@/lib/rules'

/** Punto de entrada: según la sesión y el estado del miembro, manda a la pantalla correcta. */
export default async function Home() {
  const access = await getAccess()
  if (access.state === 'anon') redirect('/login')
  if (access.state === 'member') redirect(routeForStatus(access.profile.status))

  // Hay sesión pero no hay perfil: no debería pasar. Mostramos un aviso en vez de redirigir en bucle.
  return (
    <main className="auth">
      <section className="auth-card">
        <h1>Algo ha fallado con tu cuenta</h1>
        <p className="muted">
          Tu sesión está iniciada, pero no encontramos tu perfil. Cierra sesión y vuelve a entrar con
          Discord.
        </p>
        <form action={signOut}>
          <button type="submit" className="btn block">
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  )
}
