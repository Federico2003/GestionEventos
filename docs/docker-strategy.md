# Estrategia de Contenedores y Docker Hub — Planora

**Tecnología de Contenedores:** Docker (Multi-stage Builds, base Alpine Linux)  
**Registro Público:** Docker Hub  
**Orquestación Local:** Docker Compose v2  
**Finalidad en el Proyecto:** Entorno reproducible de compilación, ejecución de suites de pruebas herméticas y publicación de artefactos OCI para evaluación académica.

---

## 1. Filosofía y Alcance de Docker en Planora

Para mantener una arquitectura limpia y sin sobreingeniería:
- **Lo que SÍ contiene Docker:**
  - Código fuente compilado y dependencias estrictamente necesarias de producción.
  - Entorno de ejecución Node.js LTS sobre Alpine Linux para minimizar superficie de vulnerabilidades.
  - Servidor web ligero (Nginx Alpine) para servir la compilación estática del frontend cuando se ejecute de forma autónoma.
  - La misma aplicación Hono de producción, montada sobre Node.js con el adaptador oficial `@hono/node-server`.
  - Adaptadores locales que implementan los mismos puertos del dominio: almacén en memoria con datos de ejemplo en lugar de D1, almacenamiento de objetos en memoria en lugar de R2 y un KV en memoria para la revocación de tokens.
  - Scripts de `HEALTHCHECK` para validar la disponibilidad del servicio.
- **Lo que NO contiene Docker:**
  - Archivos `.git`, cachés de editores o código temporal.
  - Credenciales secretas de producción (tokens de Cloudflare, llaves JWT privadas). Estas se inyectan en tiempo de ejecución o en GitHub Actions.
  - Bases de datos pesadas innecesarias (el contenedor arranca con el mismo seed de ejemplo que se carga en D1).

### 1.1 ¿Cómo corre en Docker una API pensada para Cloudflare Workers?

Los bindings `env.DB`, `env.STORAGE` y `env.KV_CACHE` solo existen dentro del runtime de Cloudflare, por lo que no basta con ejecutar `node` sobre el bundle del Worker. Gracias a la arquitectura de Puertos y Adaptadores, la API tiene **dos puntos de entrada** que comparten el 100% de la lógica de negocio:

| Entrada | Archivo | Se usa en | Adaptadores inyectados |
|---|---|---|---|
| Worker | `packages/api/src/index.ts` | Cloudflare Workers (producción) | D1, R2 y KV mediante bindings |
| Node | `packages/api/src/server.node.ts` | Contenedor Docker / evaluación local | SQLite en archivo, sistema de archivos y caché en memoria |

Así, el contenedor ejecuta exactamente los mismos controladores, servicios y reglas de dominio que producción; solo cambia la implementación de los puertos de infraestructura.

---

## 2. Imágenes Publicadas en Docker Hub

Los jobs `BackEnd - Docker Hub` y `Frontend - Docker Hub` publican en cada push a `develop` o `main`:

```text
# Repositorio de Backend (API)
frederickz/planora-api:latest        # rama main
frederickz/planora-api:dev           # rama develop
frederickz/planora-api:sha-<commit>  # inmutable por commit

# Repositorio de Frontend (Web UI)
frederickz/planora-web:latest
frederickz/planora-web:dev
frederickz/planora-web:sha-<commit>
```

> La versión semántica de la entrega se marca con el tag de Git `v1.0.0`. La imagen `planora-web` se construye con `VITE_API_URL=http://localhost:8787/api/v1` porque está pensada para ejecutarse junto a la API con `docker compose`; los ambientes en la nube usan Cloudflare Pages.

---

## 3. Especificación de Dockerfiles

### 3.1 Dockerfile para Backend API (`docker/Dockerfile.api`)

Las pruebas y el typecheck corren en el pipeline de CI antes de construir la imagen, por lo que el Dockerfile solo compila y empaqueta. La API corre con `@hono/node-server` y adaptadores en memoria (mismo dominio que en Workers).

```dockerfile
# ==============================================================================
# Planora API — Imagen Docker multi-stage (Node.js 20 Alpine)
# Ejecuta la misma app Hono de Cloudflare Workers sobre Node (@hono/node-server).
# Construir desde la raíz del monorepo:  docker build -f docker/Dockerfile.api -t planora-api .
# ==============================================================================

# ---------- Etapa 1: compilación ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Manifiestos del monorepo (npm workspaces necesita ambos package.json)
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/api/package.json packages/api/
COPY packages/frontend/package.json packages/frontend/

# --ignore-scripts: la compilación con tsc no necesita binarios nativos (p. ej. better-sqlite3 de las pruebas)
RUN npm ci --workspace=packages/api --include-workspace-root --ignore-scripts --no-audit --no-fund

COPY packages/api packages/api
RUN npm run build --workspace=packages/api

# ---------- Etapa 2: dependencias de producción ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/
COPY packages/frontend/package.json packages/frontend/
RUN npm ci --omit=dev --workspace=packages/api --no-audit --no-fund \
    && npm cache clean --force

# ---------- Etapa 3: imagen final ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787

# Usuario sin privilegios dedicado para la API
RUN addgroup -S planora && adduser -S -G planora planora

COPY --from=deps --chown=planora:planora /app/node_modules ./node_modules
COPY --from=deps --chown=planora:planora /app/package.json ./package.json
COPY --from=builder --chown=planora:planora /app/packages/api/package.json ./packages/api/package.json
COPY --from=builder --chown=planora:planora /app/packages/api/dist ./packages/api/dist

USER planora

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" > /dev/null || exit 1

CMD ["node", "packages/api/dist/server.node.js"]
```

### 3.2 Dockerfile para Frontend (`docker/Dockerfile.frontend`)

```dockerfile
# ==============================================================================
# Planora Frontend — Imagen Docker multi-stage (Vite build + Nginx Alpine)
# Construir desde la raíz del monorepo:
#   docker build -f docker/Dockerfile.frontend -t planora-web .
# ==============================================================================

# ---------- Etapa 1: compilación de la SPA ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/api/package.json packages/api/
COPY packages/frontend/package.json packages/frontend/

RUN npm ci --workspace=packages/frontend --include-workspace-root --no-audit --no-fund

COPY packages/frontend packages/frontend

# La URL de la API se incrusta en el bundle en tiempo de compilación
ARG VITE_API_URL=http://localhost:8787/api/v1
ARG VITE_APP_ENV=docker
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_APP_ENV=${VITE_APP_ENV}

RUN npm run build --workspace=packages/frontend

# ---------- Etapa 2: servidor estático ----------
FROM nginx:1.27-alpine AS runner

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 3.3 Configuración de Nginx para la SPA (`docker/nginx.conf`)

```nginx
# Nginx para la SPA de Planora (React Router): toda ruta desconocida sirve index.html
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    # Archivos con hash de Vite: caché larga
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

---

## 4. Orquestación Local con `docker-compose.yml`

Para permitir a cualquier docente o evaluador levantar la solución localmente con un solo comando:

El archivo [`docker-compose.yml`](../docker-compose.yml) de la raíz levanta ambos contenedores en la red `planora-net` (bridge). El frontend espera a que el healthcheck de la API esté en verde (`depends_on: condition: service_healthy`).

```yaml
# Planora — Solución completa en local (API + Frontend)
#   docker compose up -d --build
#   Frontend: http://localhost:3000   API: http://localhost:8787/api/v1/health
services:
  api:
    build:
      context: .
      dockerfile: docker/Dockerfile.api
    image: planora-api:local
    container_name: planora-api
    ports:
      - '8787:8787'
    environment:
      NODE_ENV: production
      PORT: '8787'
      SENTRY_ENVIRONMENT: docker
      JWT_SECRET: ${JWT_SECRET:-planora-docker-local-secret-2026}
      ALLOWED_ORIGINS: http://localhost:3000
      SENTRY_DSN: ${SENTRY_DSN:-}
    networks:
      - planora-net
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend
      args:
        VITE_API_URL: http://localhost:8787/api/v1
        VITE_APP_ENV: docker
    image: planora-web:local
    container_name: planora-web
    ports:
      - '3000:80'
    depends_on:
      api:
        condition: service_healthy
    networks:
      - planora-net
    restart: unless-stopped

networks:
  planora-net:
    driver: bridge
```

> Los datos del contenedor viven en memoria (seed de ejemplo) y se reinician con el contenedor. En la nube, el esquema y el seed viven en Cloudflare D1.

---

## 5. Guía de Comandos Operativos de Docker

### Compilar las imágenes localmente:
```bash
# Compilar backend
docker build -t planora-api:latest -f docker/Dockerfile.api .

# Compilar frontend
docker build -t planora-web:latest -f docker/Dockerfile.frontend .
```

### Ejecutar la suite completa con Docker Compose:
```bash
docker compose up -d --build
# Acceso UI: http://localhost:3000
# Acceso API: http://localhost:8787/api/v1/health
```

### Probar y Etiquetar para Docker Hub:
```bash
docker tag planora-api:latest frederickz/planora-api:v1.0.0
docker tag planora-web:latest frederickz/planora-web:v1.0.0
```

### Publicar en Docker Hub:
```bash
docker login
docker push frederickz/planora-api:v1.0.0
docker push frederickz/planora-web:v1.0.0
```
