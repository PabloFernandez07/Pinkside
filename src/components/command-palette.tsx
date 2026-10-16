'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { getPaletteData, type PaletteData } from '@/app/actions/palette'
import { matchesSearch } from '@/lib/stock'

interface PalettePage {
  href: string
  label: string
}

interface Result {
  key: string
  group: string
  label: string
  hint: string | null
  href: string
}

const MAX_PER_GROUP = 6
const PALETTE_TTL_MS = 60_000

function buildResults(query: string, pages: PalettePage[], data: PaletteData | null): Result[] {
  const match = (name: string) => matchesSearch({ name, category: null }, query)
  const take = <T,>(rows: T[]) => rows.slice(0, MAX_PER_GROUP)
  const results: Result[] = pages
    .filter((page) => match(page.label))
    .map((page) => ({ key: `p${page.href}`, group: 'Páginas', label: page.label, hint: null, href: page.href }))
  if (!query.trim() || !data) return results
  return [
    ...results,
    ...take(data.items.filter((item) => match(item.name))).map((item) => ({
      key: `i${item.id}`, group: 'Items', label: item.name, hint: item.hint, href: `/inventario/${item.id}`,
    })),
    ...take(data.recipes.filter((recipe) => match(recipe.name))).map((recipe) => ({
      key: `r${recipe.id}`, group: 'Recetas', label: recipe.name, hint: null, href: `/recetas?r=${recipe.id}`,
    })),
    ...take(data.members.filter((member) => match(member.name))).map((member) => ({
      key: `m${member.id}`, group: 'Miembros', label: member.name, hint: member.hint, href: `/miembros/${member.id}`,
    })),
  ]
}

/** Paleta de búsqueda global (Ctrl+K o ⌘K): salta a una página, item, receta o miembro. */
export function CommandPalette({ pages }: { pages: PalettePage[] }) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [data, setData] = useState<PaletteData | null>(null)
  const loadedAt = useRef(0)

  const open = () => {
    if (dialogRef.current?.open) return
    dialogRef.current?.showModal()
    // Se refresca al abrir, pero no más de una vez por minuto: así no se repiten las 3 consultas.
    if (Date.now() - loadedAt.current < PALETTE_TTL_MS) return
    loadedAt.current = Date.now()
    getPaletteData().then(setData, () => {
      loadedAt.current = 0
    })
  }
  const close = () => dialogRef.current?.close()

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (dialogRef.current?.open) dialogRef.current.close()
        else open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => buildResults(query, pages, data), [query, pages, data])
  const current = Math.min(active, Math.max(0, results.length - 1))

  const go = (result: Result | undefined) => {
    if (!result) return
    close()
    router.push(result.href)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((results.length + current + step) % Math.max(1, results.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go(results[current])
    }
  }

  return (
    <>
      <button type="button" className="btn sm ghost palette-trigger" onClick={open} aria-keyshortcuts="Control+K Meta+K">
        Buscar <kbd>Ctrl K</kbd>
      </button>
      <dialog
        ref={dialogRef}
        className="palette"
        aria-label="Buscar en Pinkside"
        onClose={() => {
          setQuery('')
          setActive(0)
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
      >
        <input
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[current] ? `${listId}-${current}` : undefined}
          aria-label="Buscar páginas, items, recetas o miembros"
          placeholder="Busca páginas, items, recetas o miembros…"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
        <ul id={listId} role="listbox" aria-label="Resultados">
          {results.map((result, index) => {
            const heading = results[index - 1]?.group !== result.group
            return (
              <li key={result.key} role="presentation">
                {heading && <span className="group">{result.group}</span>}
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === current}
                  className="option"
                  onMouseMove={() => setActive(index)}
                  onClick={() => go(result)}
                >
                  <span>{result.label}</span>
                  {result.hint && <small className="muted">{result.hint}</small>}
                </div>
              </li>
            )
          })}
        </ul>
        {results.length === 0 && <p className="muted palette-empty">Sin resultados para «{query.trim()}».</p>}
        {query.trim() && !data && <p className="muted small palette-empty">Cargando items, recetas y miembros…</p>}
      </dialog>
    </>
  )
}
