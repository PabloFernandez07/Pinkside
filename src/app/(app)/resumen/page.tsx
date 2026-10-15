import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getDisabledSections, requireMember } from '@/lib/access'
import { describeActivity, relativeTime, type ActivityRow } from '@/lib/activity'
import { bucketByDays, shortDate } from '@/lib/charts'
import { isMetric, requirementsProgress, toBandStat } from '@/lib/community'
import {
  DASHBOARD_COOKIE,
  parseLayout,
  serializeLayout,
  visibleInSlot,
  type CardId,
} from '@/lib/dashboard-layout'
import { formatMoney } from '@/lib/money'
import { analyzeRecipe, toRecipeData } from '@/lib/recipes'
import { stockState, toInventoryItem, type InventoryItem } from '@/lib/stock'
import { createClient } from '@/lib/supabase/server'
import { BarChart, LineChart } from '@/components/charts'
import { ItemThumb } from '@/components/item-thumb'
import { DashboardEditor } from './dashboard-editor'
import { PathCard, type WelcomeStep } from './path-card'

export const metadata: Metadata = { title: 'Resumen' }

const FEED_SIZE = 15
const CHART_DAYS = 14
const BUCKET_DAYS = 2
const URGENT_SHOWN = 5

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Una consulta que falla en el resumen no debe tumbar la página entera: esa sección se omite. */
const rowsOrEmpty = <T,>(res: { data: T[] | null; error: unknown }): T[] => (res.error ? [] : (res.data ?? []))

async function loadCash(supabase: Supabase) {
  const [summary, daily] = await Promise.all([
    supabase.from('cash_summary').select('balance, income_7d, expense_7d').single(),
    supabase.rpc('cash_daily', { p_days: CHART_DAYS }),
  ])
  return { summary: summary.error ? null : summary.data, daily: rowsOrEmpty(daily) }
}

async function loadStockAndRecipes(supabase: Supabase, withRecipes: boolean) {
  const [itemsRes, recipesRes] = await Promise.all([
    supabase.from('inventory_overview').select('id, name, category, min_stock, unit_cost, archived, stock, created_at, image_path'),
    withRecipes
      ? supabase
          .from('recipes')
          .select('id, name, notes, sale_price, output_qty, output_item_id, craft_location, archived, recipe_ingredients(item_id, quantity)')
      : Promise.resolve({ data: [], error: null }),
  ])
  // El mapa incluye los archivados: una receta con un ingrediente archivado no debe perder esa línea al calcular tandas.
  const items = new Map<number, InventoryItem>()
  for (const row of rowsOrEmpty(itemsRes)) {
    const item = toInventoryItem(row)
    if (item) items.set(item.id, item)
  }
  const low = [...items.values()]
    .filter((item) => !item.archived && stockState(item.stock, item.minStock) !== 'ok')
    .sort((a, b) => a.stock / (a.minStock || 1) - b.stock / (b.minStock || 1))
  const blocked = rowsOrEmpty(recipesRes)
    .map((row) => toRecipeData(row, items))
    .filter((recipe) => !recipe.archived && recipe.ingredients.length > 0 && analyzeRecipe(recipe, 1).maxBatches === 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { low, blocked }
}

/** Estadísticas propias, rango siguiente y sus requisitos. Si algo falla, «Tu camino» simplemente no sale. */
async function loadPath(supabase: Supabase, memberId: string, rankLevel: number | null) {
  const [statsRes, ranksRes, reqRes] = await Promise.all([
    supabase.rpc('band_stats'),
    supabase.from('ranks').select('id, name, level').order('level'),
    supabase.from('rank_requirements').select('rank_id, metric, target'),
  ])
  const row = rowsOrEmpty(statsRes).find((entry) => entry.member_id === memberId)
  if (!row) return null
  const stat = toBandStat(row)
  const ranks = rowsOrEmpty(ranksRes)
  const nextRank = ranks.find((rank) => rank.level > (rankLevel ?? 0)) ?? null
  const requirements = rowsOrEmpty(reqRes).flatMap((req) =>
    req.rank_id === nextRank?.id && isMetric(req.metric) ? [{ metric: req.metric, target: req.target }] : [],
  )
  const next =
    nextRank && requirements.length > 0
      ? { rankName: nextRank.name, ...requirementsProgress(requirements, stat) }
      : null
  return { stat, next, isLowest: ranks[0]?.level === rankLevel }
}

export default async function ResumenPage() {
  const { profile, rankName, rankLevel, permissions } = await requireMember('active')
  const supabase = await createClient()
  const layout = parseLayout((await cookies()).get(DASHBOARD_COOKIE)?.value)

  const canCash = permissions.has('cash.view')
  // Una sección desactivada en Administración tampoco aparece en las alertas ni en los indicadores.
  const disabled = await getDisabledSections()
  const canStock = permissions.has('inventory.view') && !disabled.has('inventario')
  const canRecipes = permissions.has('recipes.view') && canStock && !disabled.has('recetas')
  const canMembers = permissions.has('members.manage')

  const canUrgent = permissions.has('urgent.send')

  const [cash, stock, pendingRes, feedRes, urgentRes, path, wallRes] = await Promise.all([
    canCash ? loadCash(supabase) : null,
    canStock ? loadStockAndRecipes(supabase, canRecipes) : null,
    canMembers
      ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      : null,
    supabase
      .from('activity_feed')
      .select('kind, id, created_at, author_name, detail, amount, item_name, is_reversal')
      .order('created_at', { ascending: false })
      .limit(FEED_SIZE),
    supabase
      .from('urgent_requests')
      .select('id, title, priority, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(URGENT_SHOWN),
    loadPath(supabase, profile.id, rankLevel),
    supabase
      .from('wall_posts')
      .select('id, author_name, body, pinned, created_at')
      .order('pinned', { ascending: false })
      .order('id', { ascending: false })
      .limit(1),
  ])

  const urgent = rowsOrEmpty(urgentRes)
  const pending = pendingRes?.count ?? 0
  const wallPost = rowsOrEmpty(wallRes)[0] ?? null
  const feed: ActivityRow[] = rowsOrEmpty(feedRes).flatMap((row) =>
    row.kind === null ||
    row.id === null ||
    row.created_at === null ||
    row.author_name === null ||
    row.detail === null ||
    row.amount === null
      ? []
      : [
          {
            kind: row.kind,
            id: row.id,
            created_at: row.created_at,
            author_name: row.author_name,
            detail: row.detail,
            amount: row.amount,
            item_name: row.item_name,
            is_reversal: row.is_reversal ?? false,
          },
        ],
  )

  const daily = cash?.daily ?? []
  const balance = cash?.summary?.balance ?? 0
  // Sin ningún movimiento en la ventana el gráfico sería una línea plana pegada al borde: mejor un mensaje.
  const noCashActivity = daily.every((row) => row.balance === 0 && row.income === 0 && row.expense === 0)
  const lowCount = stock?.low.length ?? 0
  const hasAlerts = lowCount > 0 || (stock?.blocked.length ?? 0) > 0 || pending > 0 || urgent.length > 0
  const kpiCount = (canCash ? 3 : 0) + (canStock ? 1 : 0)

  // Pasos de bienvenida: solo el rango más bajo, solo los que su rango le permite hacer y mientras quede alguno.
  const welcome: WelcomeStep[] = path?.isLowest
    ? [
        { label: 'Escribe tu lema en Mi perfil', done: Boolean(profile.motto), href: '/perfil' },
        ...(permissions.has('cash.write')
          ? [{ label: 'Actualiza el saldo de tu cuenta en Caja', done: path.stat.cashMoves > 0, href: '/caja' }]
          : []),
        ...(canStock && permissions.has('inventory.edit')
          ? [{ label: 'Mueve algo en el inventario', done: path.stat.stockMoves > 0, href: '/inventario' }]
          : []),
        ...(canRecipes && permissions.has('recipes.edit')
          ? [{ label: 'Fabrica algo con una receta', done: path.stat.crafts > 0, href: '/recetas' }]
          : []),
      ]
    : []
  const steps = welcome.some((step) => !step.done) ? welcome : null

  const cards: Record<CardId, ReactNode> = {
    kpis:
      kpiCount > 0 ? (
        <div className={`kpis${kpiCount === 4 ? ' kpis-4' : ''}`}>
          {canCash && (
            <>
              <article className="kpi main">
                <span className="l">Saldo de la caja</span>
                <strong className={`v mono${balance < 0 ? ' neg' : ''}`}>{formatMoney(balance)}</strong>
                <span className="s">
                  <Link href="/caja">Ver movimientos →</Link>
                </span>
              </article>
              <article className="kpi">
                <span className="l">Entradas · 7 días</span>
                <strong className="v mono">{formatMoney(cash?.summary?.income_7d ?? 0)}</strong>
                <span className="s">sin contar lo anulado</span>
              </article>
              <article className="kpi">
                <span className="l">Salidas · 7 días</span>
                <strong className="v mono">{formatMoney(cash?.summary?.expense_7d ?? 0)}</strong>
                <span className="s">sin contar lo anulado</span>
              </article>
            </>
          )}
          {canStock && (
            <article className="kpi">
              <span className="l">Items bajo mínimo</span>
              <strong className={`v mono${lowCount > 0 ? ' neg' : ''}`}>{lowCount}</strong>
              <span className="s">
                <Link href="/inventario">Ver inventario →</Link>
              </span>
            </article>
          )}
        </div>
      ) : null,

    camino: steps || path?.next ? <PathCard steps={steps} next={path?.next ?? null} /> : null,

    aviso: wallPost ? (
      <section className="card notice-card">
        <header>
          <h2>{wallPost.pinned ? '📌 Aviso fijado' : 'Último aviso'}</h2>
          <span className="hint">
            {wallPost.author_name} · {relativeTime(wallPost.created_at)}
          </span>
        </header>
        <div className="scroll">
          <p className="wall-text">{wallPost.body}</p>
          <p className="small">
            <Link href="/muro">Ver el muro →</Link>
          </p>
        </div>
      </section>
    ) : null,

    saldo: canCash ? (
      <section className="card">
        <header>
          <h2>Saldo de la caja</h2>
          <span className="hint">últimos {CHART_DAYS} días</span>
        </header>
        <div className="chart-box">
          {noCashActivity ? (
            <p className="muted chart-empty">Todavía no hay movimientos en la caja: el gráfico aparecerá con el primero.</p>
          ) : (
            <LineChart
              values={daily.map((row) => row.balance)}
              labels={daily.map((row) => shortDate(row.day))}
              title={`Saldo de la caja al cierre de cada uno de los últimos ${CHART_DAYS} días`}
            />
          )}
        </div>
      </section>
    ) : (
      <section className="card">
        <header>
          <h2>Tu rango</h2>
        </header>
        <div className="scroll">
          <p className="muted">
            Tu rango no incluye ver la caja. Pide a un líder que ajuste tus permisos si lo necesitas.
          </p>
        </div>
      </section>
    ),

    flujo: canCash ? (
      <section className="card">
        <header>
          <h2>Entradas y salidas</h2>
          <span className="hint">por tramos de {BUCKET_DAYS} días</span>
        </header>
        <div className="chart-box">
          {noCashActivity ? (
            <p className="muted chart-empty">Aquí verás cuánto entra y cuánto sale de la caja.</p>
          ) : (
            <BarChart
              groups={bucketByDays(daily, BUCKET_DAYS)}
              title={`Entradas y salidas de la caja por tramos de ${BUCKET_DAYS} días`}
            />
          )}
        </div>
      </section>
    ) : null,

    atencion: (
      <section className="card">
        <header>
          <h2>Requiere atención</h2>
          <span className="hint">{hasAlerts ? 'pendiente' : 'todo en orden'}</span>
        </header>
        <div className="scroll">
          {!hasAlerts ? (
            <p className="muted">Nada pendiente: stock por encima del mínimo y recetas fabricables.</p>
          ) : (
            <ul className="alerts">
              {urgent.map((request) => (
                <li key={`u${request.id}`}>
                  <Link href="/urgentes">
                    <b>{request.title}</b>
                    <span className="small muted">
                      Urgente · prioridad {request.priority === 'critical' ? 'crítica' : 'alta'} ·{' '}
                      {relativeTime(request.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
              {pending > 0 && (
                <li>
                  <Link href="/admin">
                    <b>
                      {pending} {pending === 1 ? 'miembro espera' : 'miembros esperan'} aprobación
                    </b>
                    <span className="small muted">Asígnales un rango</span>
                  </Link>
                </li>
              )}
              {stock?.low.map((item) => (
                <li key={`i${item.id}`} className="alert-row">
                  <Link href={`/inventario/${item.id}`} className="item-cell">
                    <ItemThumb name={item.name} path={item.imagePath} />
                    <span className="alert-text">
                      <b>{item.name}</b>
                      <span className="small muted">
                        {item.stock <= 0 ? 'agotado' : `${item.stock} en stock`} · mínimo {item.minStock}
                      </span>
                    </span>
                  </Link>
                  {canUrgent && (
                    <Link href={`/urgentes?item=${item.id}`} className="btn sm ghost">
                      Pedir urgente
                    </Link>
                  )}
                </li>
              ))}
              {stock?.blocked.map((recipe) => (
                <li key={`r${recipe.id}`}>
                  <Link href={`/recetas?r=${recipe.id}`}>
                    <b>{recipe.name}</b>
                    <span className="small muted">Receta sin stock suficiente para una tanda</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    ),

    actividad: (
      <section className="card">
        <header>
          <h2>Actividad reciente</h2>
          <span className="hint">caja e inventario</span>
        </header>
        <div className="scroll">
          {feed.length === 0 ? (
            <p className="muted">Todavía no hay actividad.</p>
          ) : (
            <ul className="feed">
              {feed.map((row) => (
                <li key={`${row.kind}${row.id}`}>
                  <p>
                    <b>{row.author_name}</b> {describeActivity(row)}
                  </p>
                  <time className="small muted" dateTime={row.created_at}>
                    {relativeTime(row.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    ),
  }

  // Solo las tarjetas con contenido para este miembro; el editor y el resumen comparten la misma lista.
  const available = new Set((Object.keys(cards) as CardId[]).filter((id) => cards[id] !== null))
  const top = visibleInSlot(layout, 'top', available)
  const left = visibleInSlot(layout, 'left', available)
  const right = visibleInSlot(layout, 'right', available)
  const column = (ids: CardId[], span: boolean) =>
    ids.length > 0 && (
      <div className="dash-col" style={span ? { gridColumn: '1 / -1' } : undefined}>
        {ids.map((id) => (
          <div key={id} className="dash-item">
            {cards[id]}
          </div>
        ))}
      </div>
    )

  return (
    <div className="page">
      <div className="phead">
        <h1>Hola, {profile.first_name ?? profile.discord_username}</h1>
        <p>Rango: {rankName ?? 'sin rango'}</p>
        <DashboardEditor initial={serializeLayout(layout)} available={[...available]} />
      </div>

      {top.map((id) => (
        <div key={id}>{cards[id]}</div>
      ))}

      {(left.length > 0 || right.length > 0) && (
        <div className="grid g-dash">
          {column(left, right.length === 0)}
          {column(right, left.length === 0)}
        </div>
      )}
    </div>
  )
}
