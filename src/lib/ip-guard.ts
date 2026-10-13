import { isIP } from 'node:net'

/** `10.0.0.1` → 4 octetos, o null si no es una IPv4 válida. */
function octets(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const values = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN))
  return values.every((value) => value >= 0 && value <= 255) ? values : null
}

function isPublicIpv4(ip: string): boolean {
  const o = octets(ip)
  if (!o) return false
  const [a, b, c] = o
  if (a === 0 || a === 10 || a === 127) return false // red "esta", privada, loopback
  if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
  if (a === 169 && b === 254) return false // link-local (incluye metadatos de la nube)
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 192 && b === 0 && c === 0) return false
  if (a === 192 && b === 0 && c === 2) return false // documentación
  if (a === 198 && (b === 18 || b === 19)) return false // pruebas de rendimiento
  if (a === 198 && b === 51 && c === 100) return false
  if (a === 203 && b === 0 && c === 113) return false
  return a < 224 // multicast y reservados (224+)
}

function isPublicIpv6(raw: string): boolean {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, '')
  if (ip === '::' || ip === '::1') return false
  // IPv4 mapeada (::ffff:1.2.3.4 o ::ffff:7f00:1): se juzga la IPv4 de dentro.
  const mapped = ip.match(/^::ffff:(.+)$/)
  if (mapped) {
    const inner = mapped[1]
    if (inner.includes('.')) return isPublicIpv4(inner)
    const hex = inner.split(':')
    if (hex.length === 2) {
      const high = Number.parseInt(hex[0], 16)
      const low = Number.parseInt(hex[1], 16)
      return isPublicIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
    }
    return false
  }
  const first = Number.parseInt(ip.split(':')[0] || '0', 16)
  if ((first & 0xfe00) === 0xfc00) return false // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return false // multicast
  if (ip.startsWith('2001:db8')) return false // documentación
  if (ip.startsWith('64:ff9b:')) return false // NAT64
  return true
}

/** Una IP a la que es seguro conectarse desde el servidor: pública y enrutable. Cualquier otra cosa, no. */
export function isPublicIp(ip: string): boolean {
  const version = isIP(ip.replace(/^\[|\]$/g, ''))
  if (version === 4) return isPublicIpv4(ip)
  if (version === 6) return isPublicIpv6(ip)
  return false
}

export type UrlCheck = { ok: true; url: URL } | { ok: false }

/** Reglas previas a conectar: solo https al puerto 443, sin credenciales, y nada de nombres locales o IP privadas. */
export function checkRemoteUrl(raw: string): UrlCheck {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false }
  }
  if (url.protocol !== 'https:') return { ok: false }
  if (url.username || url.password) return { ok: false }
  if (url.port && url.port !== '443') return { ok: false }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false }
  }
  if (isIP(host) && !isPublicIp(host)) return { ok: false }
  return { ok: true, url }
}
