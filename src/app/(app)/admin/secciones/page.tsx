import type { Metadata } from 'next'
import { AdminTabs } from '@/components/admin-tabs'
import { getDisabledSections, requirePermission } from '@/lib/access'
import { SECTION_IDS, SECTION_LABEL } from '@/lib/sections'
import { SectionToggle } from './section-toggle'

export const metadata: Metadata = { title: 'Secciones' }

const DESCRIPTION = {
  inventario: 'Items, stock, movimientos y fotos. Al ocultarla, también se esconde del resumen y de los atajos.',
  recetas: 'Recetas de crafteo y calculadora. Al ocultarla, también se esconde del resumen.',
} as const

export default async function SeccionesPage() {
  const actor = await requirePermission('roles.manage')
  const disabled = await getDisabledSections()

  return (
    <div className="page">
      <div className="phead">
        <h1>Administración</h1>
        <p>Elige qué ventanas aparecen en el menú superior</p>
      </div>
      <AdminTabs current="secciones" canMembers={actor.permissions.has('members.manage')} canRoles />
      <div className="grid">
        <section className="card">
          <header>
            <h2>Ventanas del menú</h2>
            <span className="hint">Los datos no se borran</span>
          </header>
          <div className="scroll">
            <p className="muted small allow-intro">
              Una ventana desactivada desaparece del menú para todos y sus páginas dejan de abrirse. Puedes volver a
              activarla cuando quieras: no se pierde nada.
            </p>
            <div className="stacked-rows">
              {SECTION_IDS.map((id) => (
                <SectionToggle
                  key={id}
                  section={id}
                  label={SECTION_LABEL[id]}
                  description={DESCRIPTION[id]}
                  enabled={!disabled.has(id)}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
