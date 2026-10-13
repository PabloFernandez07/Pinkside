# Pinkside · Gestión de banda

Panel web para gestionar la banda **Pinkside** de Prodigy RP 4.0 (FiveM): caja común, inventario con fotos, recetas de
crafteo, pedidos urgentes con aviso por Discord, miembros, rangos y permisos editables.

- **Stack:** Next.js 16 (App Router, `proxy.ts`) · React 19 · Supabase (Postgres, Auth con Discord, Storage) · Zod · Vitest.
- **Acceso:** solo con Discord. Cada miembro nuevo completa su ficha (StateID, nombre, teléfono) y espera aprobación.
- **Diseño:** estilo «Daylight» (esmeralda por defecto y otros acentos), claro/oscuro/sistema, panel sin scroll de página.

> Next.js 16 cambia APIs respecto a versiones anteriores (`params`/`searchParams` son Promises, `middleware` → `proxy`).
> Antes de tocar código de framework, consulta `node_modules/next/dist/docs/`.

## Puesta en marcha local

Requisitos: **Node 22 o superior** (`supabase-js` usa WebSocket nativo; con Node 20 el servidor no arranca).

```bash
npm install
cp .env.example .env.local   # rellena las tres variables públicas
npm run dev                  # http://localhost:3000
```

| Variable | Qué es |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave *publishable* (pública) |
| `NEXT_PUBLIC_SITE_URL` | URL pública de la web. **Obligatoria en producción** |

Nunca pongas en el repositorio ni en variables `NEXT_PUBLIC_*` la clave `service_role` ni el token del bot de Discord.

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:coverage`

## Supabase

1. **Migraciones:** `supabase/migrations/*.sql`, en orden de nombre (0001 base, 0002 revoca ejecución del trigger,
   0003 rangos, 0004 nombre de Discord, 0005–0006 caja, 0007 inventario, 0008 recetas, 0009 resumen, 0010 urgentes,
   0011 endurecimiento, 0012 fotos de items). Aplícalas con la CLI de Supabase o desde el editor SQL.
2. **Auth → Providers:** activa **solo Discord** (Client ID y Secret de tu aplicación de Discord) y desactiva el registro
   por email y cualquier otro proveedor. El trigger `handle_new_user` rechaza registros que no vengan de Discord.
3. **Auth → URL Configuration:** añade como *Redirect URL* `https://<tu-dominio>/auth/callback` (y
   `http://localhost:3000/auth/callback` para desarrollo) y fija *Site URL* a tu dominio.
4. **Primer Líder:** en `app_settings`, clave `bootstrap_admin_discord_ids`, pon un array JSON con tu ID de Discord
   (`["123456789012345678"]`). Quien inicie sesión con ese ID pasa a Líder activo al completar su ficha.
   **Lista de acceso:** solo pueden registrarse los IDs de Discord de la tabla `allowed_discord_ids` (y los de
   `bootstrap_admin_discord_ids`). Quien tiene el permiso `members.allow` (por defecto Líder y Lugarteniente) los
   añade y quita en **Miembros → Acceso permitido**. Quitar un ID bloquea la cuenta si ya existía.
5. **Storage:** la migración 0012 crea el bucket público `item-images` (256 KB, WebP/PNG/JPG). Solo `inventory.edit`
   sube o borra fotos.
6. **Claves JWT:** el proyecto debe usar claves de firma asimétricas (Project Settings → JWT Keys) para que la sesión
   se verifique en local sin llamadas de red extra.

## Cómo está organizado

```
src/app/(app)/        pantallas con sesión: resumen, caja, inventario, recetas, urgentes, miembros, perfil, admin
src/app/actions/      Server Actions (validan con Zod, comprueban permiso y llaman a una RPC)
src/lib/              lógica pura y testeada (dinero, stock, recetas, gráficos, validación, imágenes…)
src/lib/supabase/     clientes de servidor y navegador, sesión, variables
src/components/       piezas compartidas (menú, campos, gráficos, miniaturas)
src/proxy.ts          refresco de sesión y protección de rutas
supabase/migrations/  esquema, RLS y funciones
supabase/functions/   Edge Function de MD de Discord (preparada, sin desplegar)
```

Reglas de diseño que conviene mantener:

- **Libros de solo añadir:** `cash_movements` y `stock_movements` no se editan ni se borran (trigger con errcode
  `PK001`). Los errores se corrigen con una anulación: un movimiento contrario enlazado con `reverses_id` (único).
- **Toda escritura pasa por una función SQL** `SECURITY DEFINER` con `search_path = ''` que comprueba el permiso;
  las tablas solo tienen `select` para `authenticated`, filtrado por RLS. La web nunca confía solo en la interfaz.
- **Errores con código propio:** `PK001` libro inmutable · `PK002` stock insuficiente · `PK003` demasiados pedidos.
  No uses `P0004` (es `assert_failure` y `WHEN OTHERS` no lo captura).
- **Permisos:** `cash.view/write/withdraw`, `inventory.view/edit`, `recipes.view/edit`, `urgent.send`,
  `members.manage`, `roles.manage`. El Líder (nivel 100) nunca pierde `members.manage` ni `roles.manage`.
- Los tipos de vistas y de argumentos de RPC no admiten `null`: ver `toInventoryItem` y los casts comentados.

## Avisos urgentes por Discord

Los pedidos urgentes dejan un aviso en cola por destinatario (`urgent_notifications`). El envío real lo hace la Edge
Function `supabase/functions/send-urgent-dms`, **preparada pero sin desplegar**:

1. Crea una aplicación con bot en el portal de desarrolladores de Discord e invítala al servidor de la banda. Un bot
   solo puede escribir por MD a quien comparta servidor con él, y cada miembro debe permitir MD de miembros del servidor.
2. En Supabase → Edge Functions → Secrets define `DISCORD_BOT_TOKEN` y `URGENT_WORKER_SECRET` (nunca por chat ni en el repo).
3. Despliega la función y llámala con `POST` y la cabecera `x-worker-secret` (webhook al insertar en
   `urgent_notifications`, o cron cada minuto).

Pendiente antes de activarla: reservar las filas de forma atómica (si se invoca dos veces a la vez puede duplicar
avisos) y comparar el secreto en tiempo constante.

## Despliegue en Vercel

1. Sube el repositorio a GitHub e impórtalo en Vercel (framework Next.js; Node 22 o superior).
2. Variables de entorno de producción: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y
   `NEXT_PUBLIC_SITE_URL` (el dominio final, con `https://` y sin barra final).
3. En Supabase añade ese dominio a *Redirect URLs* y *Site URL* (ver arriba) y en Discord, la URL de callback de
   Supabase (`https://<ref>.supabase.co/auth/v1/callback`).
4. Despliega, entra con Discord con la cuenta del primer Líder y comprueba `/resumen`, `/caja`, `/inventario`,
   `/recetas`, `/urgentes`, `/miembros` y `/admin`.

## Seguridad

Revisado con RLS y funciones probadas en SQL, `npm audit` sin vulnerabilidades, cabeceras de seguridad en
`next.config.ts` y validación con Zod en cada acción. Pendiente de valorar: una CSP con nonce y límite de ritmo
propio en las acciones (hoy solo lo tienen los pedidos urgentes).
