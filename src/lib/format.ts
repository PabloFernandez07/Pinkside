const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
})

/** Fecha y hora para los listados, siempre en hora de Madrid (el servidor puede estar en otra zona). */
export const formatDateTime = (iso: string): string => DATE_TIME.format(new Date(iso))
