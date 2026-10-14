import type { Metadata } from 'next'
import { requireMember } from '@/lib/access'
import { isAccent, isTheme, DEFAULT_ACCENT, DEFAULT_THEME } from '@/lib/accents'
import { PreferencesForm, ProfileForm } from './profile-forms'

export const metadata: Metadata = { title: 'Mi perfil' }

export default async function PerfilPage() {
  const { profile, rankName } = await requireMember('active')
  const installUrl = process.env.NEXT_PUBLIC_DISCORD_INSTALL_URL

  return (
    <div className="page">
      <div className="phead">
        <h1>Mi perfil</h1>
        <p>Tus datos y cómo quieres ver la web</p>
      </div>
      <div className="grid g-profile">
        <section className="card">
          <header>
            <h2>Datos personales</h2>
          </header>
          <div className="scroll">
            <dl className="facts">
              <div>
                <dt>StateID</dt>
                <dd className="mono">{profile.state_id}</dd>
              </div>
              <div>
                <dt>Discord</dt>
                <dd className="mono">@{profile.discord_username ?? '—'}</dd>
              </div>
              <div>
                <dt>Rango</dt>
                <dd>{rankName ?? 'Sin rango'}</dd>
              </div>
            </dl>
            <ProfileForm
              defaults={{
                firstName: profile.first_name ?? '',
                lastName: profile.last_name ?? '',
                phone: profile.phone ?? '',
                motto: profile.motto ?? '',
              }}
            />
          </div>
        </section>
        <section className="card">
          <header>
            <h2>Preferencias</h2>
          </header>
          <div className="scroll">
            <PreferencesForm
              theme={isTheme(profile.theme) ? profile.theme : DEFAULT_THEME}
              accent={isAccent(profile.accent) ? profile.accent : DEFAULT_ACCENT}
              dmUrgent={profile.dm_urgent}
            />
            {installUrl && (
              <p className="muted small">
                Para recibir los avisos por MD, añade la app de pedidos a tu Discord una sola vez:{' '}
                <a href={installUrl} target="_blank" rel="noopener noreferrer">
                  instalar en mi cuenta
                </a>
                .
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
