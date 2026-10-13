import { describe, expect, it } from 'vitest'
import { checkRemoteUrl, isPublicIp } from '@/lib/ip-guard'

describe('isPublicIp', () => {
  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1', '100.63.0.1', '2606:4700:4700::1111'])(
    'acepta la pública %s',
    (ip) => expect(isPublicIp(ip)).toBe(true),
  )

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '127.255.255.254',
    '169.254.169.254', // metadatos de la nube
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '100.64.0.1',
    '100.127.255.255',
    '192.0.0.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:10.0.0.1',
    '::ffff:a9fe:a9fe',
  ])('rechaza la no pública %s', (ip) => expect(isPublicIp(ip)).toBe(false))

  it('una IPv4 mapeada pública sí vale', () => {
    expect(isPublicIp('::ffff:8.8.8.8')).toBe(true)
  })

  it.each(['', 'abc', '999.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4x'])('lo que no es una IP (%j) no pasa', (value) => {
    expect(isPublicIp(value)).toBe(false)
  })
})

describe('checkRemoteUrl', () => {
  it('acepta una URL https normal', () => {
    const result = checkRemoteUrl('  https://i.imgur.com/abc.png  ')
    expect(result.ok && result.url.hostname).toBe('i.imgur.com')
  })

  it.each([
    'http://i.imgur.com/a.png',
    'ftp://i.imgur.com/a.png',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://user:pass@i.imgur.com/a.png',
    'https://i.imgur.com:8443/a.png',
    'https://localhost/a.png',
    'https://mi.localhost/a.png',
    'https://servidor.local/a.png',
    'https://metadata.internal/a.png',
    'https://127.0.0.1/a.png',
    'https://169.254.169.254/latest/meta-data',
    'https://10.1.2.3/a.png',
    'https://[::1]/a.png',
    'https://[fd00::1]/a.png',
    'https://[::ffff:127.0.0.1]/a.png',
    'no es una url',
    '',
  ])('rechaza %j', (raw) => {
    expect(checkRemoteUrl(raw).ok).toBe(false)
  })

  it('acepta el puerto 443 explícito y una IP pública', () => {
    expect(checkRemoteUrl('https://example.com:443/a.png').ok).toBe(true)
    expect(checkRemoteUrl('https://8.8.8.8/a.png').ok).toBe(true)
  })
})
