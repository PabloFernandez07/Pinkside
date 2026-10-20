import type { Metadata } from 'next'
import { requireMember } from '@/lib/access'
import { actionLabel } from '@/lib/band-actions'
import { formatDateTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { ActionPad } from './action-pad'
import { DeleteAction } from './delete-action'

export const metadata: Metadata = { title: 'Acciones' }

const RECENT = 40

export default async function AccionesPage() {
  const { profile, permissions } = await requireMember('active')
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('band_actions')
    .select('id, created_at, member_id, member_name, kind, qty, note')
    .order('id', { ascending: false })
    .limit(RECENT)
  if (error) throw new Error('No se pudo cargar el registro de acciones')
  const canDeleteAny = permissions.has('roles.manage')

  return (
    <div className="page">
      <div className="phead">
        <h1>Acciones</h1>
        <p>Apunta lo que haces con un toque: el informe semanal se rellena con esto</p>
      </div>
      <div className="grid g-actions">
        <section className="card">
          <header>
            <h2>Apuntar acción</h2>
            <span className="hint">Un toque = una entrada</span>
          </header>
          <div className="scroll">
            <ActionPad />
          </div>
        </section>

        <section className="card">
          <header>
            <h2>Últimas acciones</h2>
            <span className="hint">{rows.length === 0 ? 'ninguna todavía' : `las ${rows.length} más recientes`}</span>
          </header>
          <div className="scroll">
            {rows.length === 0 ? (
              <p className="muted">Todavía no hay acciones apuntadas.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Miembro</th>
                    <th>Acción</th>
                    <th className="num">Veces</th>
                    <th>
                      <span className="sr-only">Borrar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="mono nowrap">{formatDateTime(row.created_at)}</td>
                      <td>{row.member_name}</td>
                      <td>
                        {actionLabel(row.kind)}
                        {row.note && (
                          <>
                            <br />
                            <span className="muted small">{row.note}</span>
                          </>
                        )}
                      </td>
                      <td className="num">{row.qty}</td>
                      <td>{(canDeleteAny || row.member_id === profile.id) && <DeleteAction id={row.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
