import { describe, expect, it } from 'vitest'
import {
  LEADER_LEVEL,
  canManageRank,
  isProtectedPermission,
  routeForStatus,
  safeNextPath,
} from '@/lib/rules'

describe('canManageRank', () => {
  it('el Líder gestiona cualquier rango, incluido el suyo', () => {
    expect(canManageRank(LEADER_LEVEL, 100)).toBe(true)
    expect(canManageRank(LEADER_LEVEL, 80)).toBe(true)
    expect(canManageRank(LEADER_LEVEL, 10)).toBe(true)
  })

  it('el resto solo gestiona rangos estrictamente inferiores al suyo', () => {
    expect(canManageRank(80, 50)).toBe(true)
    expect(canManageRank(80, 80)).toBe(false)
    expect(canManageRank(80, 100)).toBe(false)
    expect(canManageRank(10, 10)).toBe(false)
  })
})

describe('isProtectedPermission', () => {
  it.each(['members.manage', 'roles.manage'])('%s está protegido en el Líder', (permission) => {
    expect(isProtectedPermission(100, permission)).toBe(true)
  })

  it('no protege otros permisos del Líder', () => {
    expect(isProtectedPermission(100, 'cash.view')).toBe(false)
  })

  it('no protege nada en rangos que no son el Líder', () => {
    expect(isProtectedPermission(80, 'members.manage')).toBe(false)
    expect(isProtectedPermission(99, 'roles.manage')).toBe(false)
  })
})

describe('routeForStatus', () => {
  it.each([
    ['onboarding', '/onboarding'],
    ['pending', '/pendiente'],
    ['blocked', '/pendiente'],
    ['active', '/resumen'],
  ] as const)('manda a %s a %s', (status, route) => {
    expect(routeForStatus(status)).toBe(route)
  })
})

describe('safeNextPath', () => {
  it('conserva rutas internas', () => {
    expect(safeNextPath('/caja')).toBe('/caja')
    expect(safeNextPath('/admin?tab=miembros')).toBe('/admin?tab=miembros')
  })

  it.each([
    null,
    undefined,
    '',
    'caja',
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/ok\nSet-Cookie: x=1',
    '/ok\u0000',
  ])('descarta %j y usa la ruta por defecto', (input) => {
    expect(safeNextPath(input)).toBe('/')
  })

  it('respeta una ruta por defecto personalizada', () => {
    expect(safeNextPath('//evil.com', '/resumen')).toBe('/resumen')
  })
})
