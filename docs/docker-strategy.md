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

## 2. Nombres de Imágenes Propuestos para Docker Hub

Siguiendo el estándar de nomenclatura OCI y Docker Hub:

```text
# Repositorio de Backend (API)
[organization_or_user]/planora-api:latest
[organization_or_user]/planora-api:v1.0.0
[organization_or_user]/planora-api:sha-[commit-sha-corto]

# Repositorio de Frontend (Web UI)
[organization_or_user]/planora-web:latest
[organization_or_user]/planora-frontend:v1.0.0
[organization_or_user]/planora-frontend:sha-[commit-sha-corto]
```

---

## 3. Especificación de Dockerfiles

### 3.1 Dockerfile para Backend API (`docker/Dockerfile.api`)

Utiliza construcción en múltiples etapas (*multi-stage build*) para reducir el tamaño final de la imagen a menos de 80 MB:

```dockerfile
# -------------------------------------------------------------
# ETAPA 1: Dependencias y Compilación
# -------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Herramientas para compilar el módulo nativo better-sqlite3 en Alpine (solo en esta etapa)
RUN apk add --no-cache libc6-compat python3 make g++

# Copiar manifiestos de paquetes
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/

# Instalar dependencias completas (incluidas devDependencies para tests y build)
RUN npm ci

# Copiar código fuente
COPY tsconfig*.json ./
COPY packages/api ./packages/api

# Ejecutar pruebas unitarias; si fallan, la imagen no se construye
RUN npm run test --workspace=packages/api

# Ejecutar verificación de tipos y compilación de TypeScript (genera dist/server.node.js)
RUN npm run build --workspace=packages/api

# Eliminar devDependencies conservando los módulos nativos ya compilados
RUN npm prune --omit=dev

# -------------------------------------------------------------
# ETAPA 2: Imagen Ligera de Ejecución / Pruebas
# -------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV DB_PATH=/app/data/planora.db
ENV STORAGE_DIR=/app/data/storage

# Crear usuario sin privilegios por seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 planora

# Copiar únicamente artefactos compilados, migraciones y dependencias de producción
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/package*.json ./packages/api/
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/migrations ./packages/api/migrations

# Carpeta de datos persistentes (SQLite y archivos) propiedad del usuario no-root
RUN mkdir -p /app/data/storage && chown -R planora:nodejs /app/data
USER planora

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8787/api/v1/health || exit 1

# Aplica las migraciones al archivo SQLite local y levanta la API con @hono/node-server
CMD ["node", "packages/api/dist/server.node.js"]
```

### 3.2 Dockerfile para Frontend (`docker/Dockerfile.frontend`)

Compila el bundle de React con Vite y lo empaqueta dentro de un contenedor Nginx Alpine de menos de 25 MB:

```dockerfile
# -------------------------------------------------------------
# ETAPA 1: Construcción del Bundle Estático
# -------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/

RUN npm ci

COPY tsconfig*.json ./
COPY packages/frontend ./packages/frontend

# URL de la API que consumirá el navegador (se inyecta en tiempo de build)
ARG VITE_API_URL=http://localhost:8787/api/v1
ENV VITE_API_URL=$VITE_API_URL

# Compilación de Vite
RUN npm run build --workspace=packages/frontend

# -------------------------------------------------------------
# ETAPA 2: Servidor Web Estático Nginx
# -------------------------------------------------------------
FROM nginx:1.25-alpine AS runner

# Copiar configuración personalizada para SPA (soporte HTML5 History API)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar archivos compilados
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 3.3 Configuración de Nginx para la SPA (`docker/nginx.conf`)

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Rutas de React Router: cualquier ruta desconocida regresa index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Caché larga para assets con hash generados por Vite
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
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
docker tag planora-api:latest tu_usuario_dockerhub/planora-api:v1.0.0
docker tag planora-web:latest tu_usuario_dockerhub/planora-web:v1.0.0
```

### Publicar en Docker Hub:
```bash
docker login
docker push tu_usuario_dockerhub/planora-api:v1.0.0
docker push tu_usuario_dockerhub/planora-web:v1.0.0
```
