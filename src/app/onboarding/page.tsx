import type { Metadata } from 'next'
import { requireMember } from '@/lib/access'
import { OnboardingForm } from './onboarding-form'

export const metadata: Metadata = { title: 'Tu ficha' }

export default async function OnboardingPage() {
  const { profile } = await requireMember('onboarding')

  return (
    <main className="auth">
      <section className="auth-card wide">
        <div className="brand">
          <i aria-hidden="true" />
          Pinkside
        </div>
        <h1>Bienvenido{profile.discord_username ? `, ${profile.discord_username}` : ''}</h1>
        <p className="muted">
          Antes de entrar necesitamos tu ficha. Un administrador la revisará y te dará acceso.
        </p>
        <OnboardingForm />
      </section>
    </main>
  )
}
