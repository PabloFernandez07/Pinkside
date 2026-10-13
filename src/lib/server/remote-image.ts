import dns from 'node:dns'
import type { LookupFunction } from 'node:net'
import { request } from 'node:https'
import { checkRemoteUrl, isPublicIp } from '@/lib/ip-guard'

export type RemoteImage =
  | { ok: true; bytes: Buffer }
  | { ok: false; reason: 'url' | 'blocked' | 'network' | 'type' | 'size' }

const MAX_BYTES = 3 * 1024 * 1024
const TIMEOUT_MS = 6000
const MAX_REDIRECTS = 2
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])

/**
 * Resuelve el nombre y rechaza cualquier dirección que no sea pública. Se ejecuta en el momento de conectar,
 * así que un DNS que cambie de respuesta entre la comprobación y la conexión (DNS rebinding) tampoco cuela.
 */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error, '', 4)
    if (addresses.length === 0 || addresses.some((entry) => !isPublicIp(entry.address))) {
      return callback(new Error('blocked') as NodeJS.ErrnoException, '', 4)
    }
    if (options.all) return callback(null, addresses)
    return callback(null, addresses[0].address, addresses[0].family)
  })
}

function fetchOnce(url: URL, redirectsLeft: number): Promise<RemoteImage> {
  return new Promise((resolve) => {
    const req = request(
      {
        protocol: 'https:',
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: { 'user-agent': 'PinksideImageFetcher/1.0', accept: 'image/*' },
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (REDIRECT_STATUS.has(status) && res.headers.location) {
          res.resume()
          if (redirectsLeft <= 0) return resolve({ ok: false, reason: 'network' })
          let next
          try {
            next = checkRemoteUrl(new URL(res.headers.location, url).toString())
          } catch {
            return resolve({ ok: false, reason: 'url' })
          }
          if (!next.ok) return resolve({ ok: false, reason: 'blocked' })
          return resolve(fetchOnce(next.url, redirectsLeft - 1))
        }
        if (status !== 200) {
          res.resume()
          return resolve({ ok: false, reason: 'network' })
        }
        if (!String(res.headers['content-type'] ?? '').toLowerCase().startsWith('image/')) {
          res.resume()
          return resolve({ ok: false, reason: 'type' })
        }
        if (Number(res.headers['content-length'] ?? 0) > MAX_BYTES) {
          res.resume()
          return resolve({ ok: false, reason: 'size' })
        }
        const chunks: Buffer[] = []
        let total = 0
        res.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > MAX_BYTES) {
            req.destroy()
            return resolve({ ok: false, reason: 'size' })
          }
          chunks.push(chunk)
        })
        res.on('end', () => resolve({ ok: true, bytes: Buffer.concat(chunks) }))
        res.on('error', () => resolve({ ok: false, reason: 'network' }))
      },
    )
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, reason: 'network' })
    })
    req.on('error', (error) => resolve({ ok: false, reason: error.message === 'blocked' ? 'blocked' : 'network' }))
    req.end()
  })
}

/** Descarga una imagen de una URL https pública (3 MB, 6 s, 2 redirecciones como máximo). */
export async function fetchRemoteImage(raw: string): Promise<RemoteImage> {
  const checked = checkRemoteUrl(raw)
  if (!checked.ok) return { ok: false, reason: 'url' }
  return fetchOnce(checked.url, MAX_REDIRECTS)
}
