'use client'

import { useState } from 'react'
import Link from 'next/link'
import { craftRecipe } from '@/app/actions/recipes'
import { FormMessage } from '@/components/field'
import { ItemThumb } from '@/components/item-thumb'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'
import { formatMoney } from '@/lib/money'
import { MAX_BATCHES, analyzeRecipe, clampBatches, type RecipeData } from '@/lib/recipes'

interface RecipeCalculatorProps {
  recipe: RecipeData
  /** Puede mover stock (inventory.edit): sin esto solo se calcula. */
  canCraft: boolean
  /** Puede crear pedidos urgentes (urgent.send): muestra «Pedir» junto a lo que falta. */
  canRequestUrgent?: boolean
}

const signed = (value: number) => (value < 0 ? `−${formatMoney(Math.abs(value))}` : formatMoney(value))

export function RecipeCalculator({ recipe, canCraft, canRequestUrgent = false }: RecipeCalculatorProps) {
  const [text, setText] = useState('1')
  const batches = clampBatches(text)
  const a = analyzeRecipe(recipe, batches)
  const { state, pending, onSubmit } = useManualForm(craftRecipe)

  const missingRows = a.rows.filter((row) => row.missing > 0)
  const blockedReason = recipe.archived
    ? 'La receta está archivada.'
    : missingRows.length > 0
      ? `Falta ${missingRows.map((row) => `${row.missing}× ${row.name}`).join(', ')}.`
      : null

  return (
    <div className="calc">
      <div className="calc-input">
        <div className="field">
          <label htmlFor="f-batches">Tandas a fabricar</label>
          <input
            id="f-batches"
            inputMode="numeric"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-describedby="f-batches-hint"
          />
        </div>
        <p id="f-batches-hint" className="muted small">
          Cada tanda produce {recipe.outputQty} {recipe.outputQty === 1 ? 'unidad' : 'unidades'} → {a.units} en total.
          Máximo {MAX_BATCHES.toLocaleString('es-ES')} tandas.
        </p>
      </div>

      <table className="calc-table">
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th className="num">Por tanda</th>
            <th className="num">Necesario</th>
            <th className="num">En stock</th>
            <th className="num">Falta</th>
          </tr>
        </thead>
        <tbody>
          {a.rows.map((row) => (
            <tr key={row.itemId} className={row.missing > 0 ? 'short' : undefined}>
              <td>
                <div className="item-cell">
                  <ItemThumb name={row.name} path={row.imagePath} />
                  <span>{row.name}</span>
                </div>
              </td>
              <td className="num mono">{row.perBatch}</td>
              <td className="num mono">{row.needed}</td>
              <td className="num mono">{row.stock}</td>
              <td className="num mono">
                {row.missing > 0 ? row.missing : '—'}
                {row.missing > 0 && canRequestUrgent && (
                  <Link
                    className="btn sm ghost"
                    href={`/urgentes?item=${row.itemId}&titulo=${encodeURIComponent(`Faltan ${row.missing}× ${row.name} para ${recipe.name}`)}`}
                  >
                    Pedir
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="results">
        <div>
          <dt>Coste de materiales</dt>
          <dd className="mono">{formatMoney(a.totalCost)}</dd>
        </div>
        <div>
          <dt>Ingresos por venta</dt>
          <dd className="mono">{formatMoney(a.totalRevenue)}</dd>
        </div>
        <div className={`hl${a.totalProfit < 0 ? ' neg' : ''}`}>
          <dt>Beneficio{a.marginPercent !== null ? ` (${a.marginPercent} %)` : ''}</dt>
          <dd className="mono">{signed(a.totalProfit)}</dd>
        </div>
        <div>
          <dt>Coste por unidad</dt>
          <dd className="mono">{formatMoney(Math.round(a.costPerUnit))}</dd>
        </div>
        <div>
          <dt>Con el stock actual puedes hacer</dt>
          <dd className="mono">
            {a.maxBatches} {a.maxBatches === 1 ? 'tanda' : 'tandas'}
          </dd>
        </div>
      </dl>

      {canCraft ? (
        <form onSubmit={onSubmit} className="craft" noValidate>
          <input type="hidden" name="recipeId" value={recipe.id} />
          <input type="hidden" name="batches" value={batches} />
          <SubmitButton pending={pending || !a.canCraft} pendingLabel={pending ? 'Fabricando…' : 'Fabricar'} className="btn">
            Fabricar {batches} {batches === 1 ? 'tanda' : 'tandas'}
          </SubmitButton>
          {blockedReason && (
            <span className="muted small" role="status">
              {blockedReason}
            </span>
          )}
          <FormMessage state={state} />
        </form>
      ) : (
        <p className="muted small">Tu rango permite calcular, pero no fabricar (no puedes mover stock).</p>
      )}
    </div>
  )
}
