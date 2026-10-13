import { buildBarChart, buildLineChart, type BarGroupInput, type Tick } from '@/lib/charts'
import { formatMoney } from '@/lib/money'

/**
 * Gráficos SVG renderizados en el servidor. El SVG usa un lienzo 0-100 que se estira a su tarjeta
 * (`preserveAspectRatio="none"`); las etiquetas y el punto final son HTML posicionado en % para no deformarse.
 */

function Grid({ ticks, left, right }: { ticks: readonly Tick[]; left: number; right: number }) {
  return (
    <>
      {ticks.map((tick) => (
        <line
          key={tick.value}
          className="chart-grid"
          x1={left}
          x2={100 - right}
          y1={tick.y}
          y2={tick.y}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  )
}

function YLabels({ ticks }: { ticks: readonly Tick[] }) {
  return (
    <>
      {ticks.map((tick) => (
        <span key={tick.value} aria-hidden="true" className="chart-y mono" style={{ top: `${tick.y}%` }}>
          {tick.label}
        </span>
      ))}
    </>
  )
}

interface LineProps {
  values: readonly number[]
  labels: readonly string[]
  /** Descripción para lectores de pantalla. */
  title: string
}

export function LineChart({ values, labels, title }: LineProps) {
  const chart = buildLineChart(values, labels)
  const { margins } = chart
  return (
    <figure className="chart">
      <div className="chart-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={title}>
          <Grid ticks={chart.ticks} left={margins.left} right={margins.right} />
          {chart.path && <path className="chart-area" d={chart.area} />}
          {chart.path && <path className="chart-line" d={chart.path} vectorEffect="non-scaling-stroke" />}
        </svg>
        <YLabels ticks={chart.ticks} />
        {chart.xLabels.map((label) => (
          <span key={label.x} aria-hidden="true" className={`chart-x ${label.anchor}`} style={{ left: `${label.x}%` }}>
            {label.text}
          </span>
        ))}
        {chart.last && <i aria-hidden="true" className="chart-dot" style={{ left: `${chart.last.x}%`, top: `${chart.last.y}%` }} />}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {values.map((value, index) => (
            <tr key={labels[index] + index}>
              <td>{labels[index]}</td>
              <td>{formatMoney(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

interface BarsProps {
  groups: readonly BarGroupInput[]
  title: string
}

export function BarChart({ groups, title }: BarsProps) {
  const chart = buildBarChart(groups)
  const { margins } = chart
  return (
    <figure className="chart">
      <div className="chart-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={title}>
          <Grid ticks={chart.ticks} left={margins.left} right={margins.right} />
          {chart.groups.map((group) => (
            <g key={group.label}>
              <rect className="chart-bar in" {...group.income} />
              <rect className="chart-bar out" {...group.expense} />
            </g>
          ))}
        </svg>
        <YLabels ticks={chart.ticks} />
        {chart.groups.map((group) => (
          <span key={group.label} aria-hidden="true" className="chart-x middle" style={{ left: `${group.center}%` }}>
            {group.label}
          </span>
        ))}
      </div>
      <figcaption className="chart-legend">
        <span>
          <i className="lg in" /> Entradas
        </span>
        <span>
          <i className="lg out" /> Salidas
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Desde</th>
            <th scope="col">Entradas</th>
            <th scope="col">Salidas</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.label}>
              <td>{group.label}</td>
              <td>{formatMoney(group.income)}</td>
              <td>{formatMoney(group.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
