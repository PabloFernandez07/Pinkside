import type { Metadata } from 'next'
import { signInWithDiscord } from '@/app/actions/auth'
import { SubmitButton } from '@/components/submit-button'

export const metadata: Metadata = { title: 'Entrar' }

const ERRORS: Record<string, string> = {
  oauth: 'No hemos podido iniciar el acceso con Discord. Inténtalo de nuevo.',
  auth: 'El acceso con Discord no se completó. Inténtalo de nuevo.',
  denied: 'Tu cuenta de Discord no está autorizada. Pide a un líder que añada tu ID de Discord a la lista de acceso.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const message = error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : undefined

  return (
    <main className="auth">
      <section className="auth-card">
        <div className="brand">
          <i aria-hidden="true" />
          Pinkside
        </div>
        <h1>Panel de la banda</h1>
        <p className="muted">Caja, inventario y recetas en un solo sitio. Entra con tu cuenta de Discord.</p>
        {message && (
          <p role="alert" className="notice bad">
            {message}
          </p>
        )}
        <form action={signInWithDiscord}>
          <SubmitButton pendingLabel="Conectando con Discord…" className="btn block">
            Entrar con Discord
          </SubmitButton>
        </form>
        <p className="muted small">
          Solo pueden entrar las cuentas que un líder haya autorizado, y la primera vez un administrador aprueba tu acceso.
        </p>
      </section>
    </main>
  )
}
