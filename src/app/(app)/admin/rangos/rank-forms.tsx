'use client'

import { saveRankRequirements } from '@/app/actions/community'
import { createRank, deleteRank, updateRank } from '@/app/actions/ranks'
import { Field, FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'
import { METRIC_KEYS, METRICS, type MetricKey } from '@/lib/community'

interface RequirementsFormProps {
  rankId: number
  rankName: string
  values: Partial<Record<MetricKey, number>>
}

/** Qué hace falta para llegar a este rango. Un campo vacío quita ese requisito. */
export function RequirementsForm({ rankId, rankName, values }: RequirementsFormProps) {
  const { state, pending, onSubmit } = useManualForm(saveRankRequirements)
  const errors = Object.values(state?.errors ?? {}).flat().filter(Boolean)
  return (
    <form onSubmit={onSubmit} className="req-form" noValidate>
      <b>Para llegar a {rankName}</b>
      <input type="hidden" name="rankId" value={rankId} />
      {METRIC_KEYS.map((key) => {
        const id = `req-${rankId}-${key}`
        return (
          <div key={key} className="field">
            <label htmlFor={id}>{METRICS[key].label}</label>
            <input id={id} name={key} defaultValue={values[key] ?? ''} inputMode="numeric" autoComplete="off" placeholder="—" />
          </div>
        )
      })}
      <div className="wide">
        <SubmitButton pending={pending} className="btn sm" pendingLabel="Guardando…">
          Guardar requisitos
        </SubmitButton>
      </div>
      {(state?.message || errors.length > 0) && (
        <p className={state?.ok ? 'notice ok' : 'notice bad'} role={state?.ok ? 'status' : 'alert'}>
          {state?.message ?? errors[0]}
        </p>
      )}
    </form>
  )
}

export function CreateRankForm() {
  const { state, pending, onSubmit } = useManualForm(createRank)
  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      <Field name="name" label="Nombre del rango" autoComplete="off" error={state?.errors?.name} required />
      <Field
        name="level"
        label="Nivel (1-99)"
        inputMode="numeric"
        autoComplete="off"
        hint="Más alto = más poder"
        error={state?.errors?.level}
        required
      />
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Creando…">
          Crear rango
        </SubmitButton>
      </div>
    </form>
  )
}

interface EditRankFormProps {
  rankId: number
  name: string
  level: number
  /** El Líder solo se puede renombrar: su nivel es fijo. */
  isLeader: boolean
}

export function EditRankForm({ rankId, name, level, isLeader }: EditRankFormProps) {
  const { state, pending, onSubmit } = useManualForm(updateRank)
  return (
    <form onSubmit={onSubmit} className="rank-edit" noValidate>
      <input type="hidden" name="rankId" value={rankId} />
      <input name="name" defaultValue={name} aria-label={`Nombre del rango ${name}`} maxLength={30} autoComplete="off" />
      <input
        name="level"
        defaultValue={level}
        aria-label={`Nivel del rango ${name}`}
        inputMode="numeric"
        readOnly={isLeader}
        title={isLeader ? 'El nivel del Líder no se puede cambiar' : undefined}
        autoComplete="off"
      />
      <SubmitButton pending={pending} className="btn sm ghost" pendingLabel="…">
        Guardar
      </SubmitButton>
      {(state?.message || state?.errors) && (
        <p className="rank-msg" role={state?.ok ? 'status' : 'alert'}>
          {state?.message ?? Object.values(state?.errors ?? {}).flat().filter(Boolean)[0]}
        </p>
      )}
    </form>
  )
}

interface DeleteRankFormProps {
  rankId: number
  name: string
  /** Motivo por el que no se puede borrar; si existe, el botón queda desactivado. */
  blockedReason?: string
}

export function DeleteRankForm({ rankId, name, blockedReason }: DeleteRankFormProps) {
  const { state, pending, onSubmit } = useManualForm(deleteRank)
  return (
    <form onSubmit={onSubmit} className="inline-form end">
      <input type="hidden" name="rankId" value={rankId} />
      <SubmitButton
        pending={pending || Boolean(blockedReason)}
        className="btn sm ghost danger"
        pendingLabel={blockedReason ? 'Borrar' : '…'}
      >
        Borrar
      </SubmitButton>
      {blockedReason && <span className="sr-only">{`No se puede borrar ${name}: ${blockedReason}`}</span>}
      <FormMessage state={state} />
    </form>
  )
}
