'use client'

import { approveMember, setMemberBlocked, setMemberRank } from '@/app/actions/members'
import { FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'

interface RankOption {
  id: number
  name: string
}

function RankOptions({ ranks }: { ranks: RankOption[] }) {
  return ranks.map((rank) => (
    <option key={rank.id} value={rank.id}>
      {rank.name}
    </option>
  ))
}

export function ApproveForm({ memberId, ranks }: { memberId: string; ranks: RankOption[] }) {
  const { state, pending, onSubmit } = useManualForm(approveMember)
  // Por defecto, el rango más bajo disponible.
  const lowest = ranks[ranks.length - 1]
  return (
    <form onSubmit={onSubmit} className="inline-form">
      <input type="hidden" name="memberId" value={memberId} />
      <select name="rankId" defaultValue={lowest?.id} aria-label="Rango inicial">
        <RankOptions ranks={ranks} />
      </select>
      <SubmitButton pending={pending} className="btn sm" pendingLabel="Aprobando…">
        Aprobar
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  )
}

export function RankForm({
  memberId,
  current,
  ranks,
}: {
  memberId: string
  current: number
  ranks: RankOption[]
}) {
  const { state, pending, onSubmit } = useManualForm(setMemberRank)
  return (
    <form onSubmit={onSubmit} className="inline-form">
      <input type="hidden" name="memberId" value={memberId} />
      <select name="rankId" defaultValue={current} aria-label="Rango">
        <RankOptions ranks={ranks} />
      </select>
      <SubmitButton pending={pending} className="btn sm ghost" pendingLabel="Guardando…">
        Cambiar
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  )
}

export function BlockForm({ memberId, blocked }: { memberId: string; blocked: boolean }) {
  const { state, pending, onSubmit } = useManualForm(setMemberBlocked)
  return (
    <form onSubmit={onSubmit} className="inline-form end">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="blocked" value={String(!blocked)} />
      <SubmitButton pending={pending} className="btn sm ghost" pendingLabel="…">
        {blocked ? 'Desbloquear' : 'Bloquear'}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  )
}
