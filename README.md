# Despliegue en Vercel (monorepo)

SISTEMAIA es un monorepo con npm workspaces que contiene dos aplicaciones
independientes, cada una desplegable como proyecto de Vercel:

```
SISTEMAIA/
├── apps/
│   ├── web/          → SvelteKit (Svelte 5) — frontend
│   └── api/          → Node.js + Express    — backend
├── supabase/
│   └── schema.sql    → esquema de base de datos
└── .env.example      → variables de entorno
```

## 1. Base de datos (Supabase)

1. Cree un proyecto en https://supabase.com.
2. En **SQL Editor**, ejecute `supabase/schema.sql`.
3. Copie `Project URL` y `service_role` key (Settings → API).

## 2. Backend (`apps/api`)

1. En Vercel: **Add New → Project → Import** este repositorio.
2. **Root Directory**: `apps/api`.
3. Framework preset: Other. Build command: `npm run build -w api` (o déjelo vacío).
   - Alternativa desde la raíz del monorepo: `npm install && npm run build -w api`.
4. Variables de entorno (Settings → Environment Variables):

   | Variable | Valor |
   |---|---|
   | `SUPABASE_URL` | URL del proyecto Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `JWT_SECRET` | secreto largo aleatorio |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CORS_ORIGIN` | URL del frontend en Vercel (https://…) |
   | `ANALYZER_WORKERS` | `3` |
   | `ANALYZER_QUEUE_LIMIT` | `50` |

   > Nota: `api/vercel.json` reescribe todas las rutas a `api/index.js`,
   > que envuelve la app Express con `serverless-http`.

## 3. Frontend (`apps/web`)

1. Otro proyecto de Vercel con **Root Directory**: `apps/web`.
2. Framework: **SvelteKit** (se autodetecta).
3. Variables de entorno:

   | Variable | Valor |
   |---|---|
   | `PUBLIC_API_URL` | URL del backend desplegado (`https://api-xxx.vercel.app`) |

4. Vuelva al proyecto del backend y actualice `CORS_ORIGIN` con la URL del
   frontend; redespliegue.

## Desarrollo local

```bash
npm install                 # instala ambos workspaces
cp .env.example .env        # rellenar credenciales
npm run dev:api             # backend en http://localhost:3001
npm run dev:web             # frontend en http://localhost:5173
```

## Seguridad

- Contraseñas hasheadas con **bcrypt** (12 rondas) — nunca se guardan en claro.
- Autenticación con **JWT** firmado (`JWT_SECRET`).
- Todas las claves sensibles viven en `.env` (ignorado por git).
- El backend usa `service_role` de Supabase solo en servidor; el frontend
  nunca ve credenciales de Supabase.
- RLS habilitado en las tres tablas como defensa en profundidad.

## Balanceador de cargas

`apps/api/src/lib/loadBalancer.js` implementa un pool de workers
(`ANALYZER_WORKERS`, por defecto 3) que distribuye las tareas de análisis
de documentos de forma *least-busy*, con cola acotada y métricas.

- `GET /metrics` (solo admin): estado de workers, cola y latencias.
- `GET /health`: healthcheck.
