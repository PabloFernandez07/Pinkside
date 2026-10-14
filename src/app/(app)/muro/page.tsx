import type { Metadata } from 'next'
import { Pager } from '@/components/pager'
import { requireMember } from '@/lib/access'
import { relativeTime } from '@/lib/activity'
import { PAGE_SIZE, parsePage } from '@/lib/pagination'
import { createClient } from '@/lib/supabase/server'
import { PostControls, ReactionBar, WallForm } from './wall-forms'

export const metadata: Metadata = { title: 'Muro' }

export default async function MuroPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { profile, permissions } = await requireMember('active')
  const canPost = permissions.has('wall.post')
  const page = parsePage((await searchParams).pagina)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const postsRes = await supabase
    .from('wall_posts')
    .select('id, author_id, author_name, body, pinned, created_at', { count: 'exact' })
    .order('pinned', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (postsRes.error) throw new Error('No se pudo cargar el muro')

  const posts = postsRes.data
  const total = postsRes.count ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const reactionsRes = posts.length
    ? await supabase.from('wall_reactions').select('post_id, member_id, emoji').in('post_id', posts.map((post) => post.id))
    : { data: [], error: null }
  if (reactionsRes.error) throw new Error('No se pudo cargar el muro')

  const reactions = new Map<number, { counts: Record<string, number>; mine: string[] }>()
  for (const row of reactionsRes.data ?? []) {
    const entry = reactions.get(row.post_id) ?? { counts: {}, mine: [] }
    entry.counts[row.emoji] = (entry.counts[row.emoji] ?? 0) + 1
    if (row.member_id === profile.id) entry.mine.push(row.emoji)
    reactions.set(row.post_id, entry)
  }

  return (
    <div className="page">
      <div className="phead">
        <h1>Muro de la banda</h1>
        <p>Avisos y novedades. Reacciona con un emoji para decir «visto».</p>
      </div>

      <div className={`grid${canPost ? ' g-urg' : ''}`}>
        <section className="card">
          <header>
            <h2>Avisos</h2>
            <span className="hint">{total === 0 ? 'ninguno todavía' : `${total} ${total === 1 ? 'aviso' : 'avisos'}`}</span>
          </header>
          <div className="scroll">
            {posts.length === 0 ? (
              <p className="muted">
                {canPost ? 'Escribe el primer aviso de la banda.' : 'Todavía no hay avisos. Cuando un líder publique uno, saldrá aquí.'}
              </p>
            ) : (
              <ul className="wall">
                {posts.map((post) => {
                  const entry = reactions.get(post.id)
                  return (
                    <li key={post.id} className={post.pinned ? 'pinned' : undefined}>
                      <header>
                        <b>{post.author_name}</b>
                        {post.pinned && <span className="chip tag">📌 Fijado</span>}
                        <time className="small muted" dateTime={post.created_at}>
                          {relativeTime(post.created_at)}
                        </time>
                      </header>
                      <p>{post.body}</p>
                      <footer>
                        <ReactionBar postId={post.id} counts={entry?.counts ?? {}} mine={entry?.mine ?? []} />
                        <PostControls
                          id={post.id}
                          pinned={post.pinned}
                          canModerate={canPost}
                          canDelete={canPost || post.author_id === profile.id}
                        />
                      </footer>
                    </li>
                  )
                })}
              </ul>
            )}
            <Pager label="Paginación del muro" path="/muro" page={page} lastPage={lastPage} previous="← Más recientes" next="Más antiguos →" />
          </div>
        </section>

        {canPost && (
          <section className="card">
            <header>
              <h2>Publicar</h2>
            </header>
            <div className="scroll">
              <WallForm />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
