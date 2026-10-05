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
  - Emulador local de Cloudflare Workers (Wrangler/Miniflare) para pruebas herméticas sin requerir conexión a Internet.
  - Scripts de `HEALTHCHECK` para validar la disponibilidad del servicio.
- **Lo que NO contiene Docker:**
  - Archivos `.git`, cachés de editores o código temporal.
  - Credenciales secretas de producción (tokens de Cloudflare, llaves JWT privadas). Estas se inyectan en tiempo de ejecución o en GitHub Actions.
  - Bases de datos pesadas innecesarias (se aprovecha SQLite / D1 local emulado en memoria).

---

## 2. Nombres de Imágenes Propuestos para Docker Hub

Siguiendo el estándar de nomenclatura OCI y Docker Hub:

```text
# Repositorio de Backend (API)
[organization_or_user]/planora-api:latest
[organization_or_user]/planora-api:v1.0.0
[organization_or_user]/planora-api:[git-commit-sha]

# Repositorio de Frontend (Web UI)
[organization_or_user]/planora-frontend:latest
[organization_or_user]/planora-frontend:v1.0.0
[organization_or_user]/planora-frontend:[git-commit-sha]
```

---

## 3. Especificación de Dockerfiles

### 3.1 Dockerfile para Backend API (`docker/Dockerfile.api`)

Utiliza construcción en múltiples etapas (*multi-stage build*) para reducir el tamaño final de la imagen a menos de 95 MB:

```dockerfile
# -------------------------------------------------------------
# ETAPA 1: Dependencias y Compilación
# -------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias necesarias para compilación nativa en Alpine
RUN apk add --no-cache libc6-compat

# Copiar manifiestos de paquetes
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/

# Instalar dependencias completas (incluidas devDependencies para tests y build)
RUN npm ci

# Copiar código fuente
COPY tsconfig*.json ./
COPY packages/api ./packages/api

# Ejecutar verificación de tipos y compilación de TypeScript
RUN npm run build --workspace=packages/api

# -------------------------------------------------------------
# ETAPA 2: Imagen Ligera de Ejecución / Pruebas
# -------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

# Crear usuario sin privilegios por seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 planora

# Copiar únicamente artefactos compilados y dependencias de producción
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/package*.json ./packages/api/

# Instalar solo dependencias de producción
RUN npm ci --omit=dev --workspace=packages/api

# Asignar permisos al usuario no-root
USER planora

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8787/api/v1/health || exit 1

CMD ["node", "packages/api/dist/index.js"]
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

COPY packages/frontend ./packages/frontend

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

---

## 4. Orquestación Local con `docker-compose.yml`

Para permitir a cualquier docente o evaluador levantar la solución localmente con un solo comando:

```yaml
version: '3.8'

services:
  planora-api:
    build:
      context: .
      dockerfile: docker/Dockerfile.api
    container_name: planora-api-local
    ports:
      - "8787:8787"
    environment:
      - ENVIRONMENT=development
      - PORT=8787
      - JWT_SECRET=dev-local-jwt-secret-key-32chars
    networks:
      - planora-network
    restart: unless-stopped

  planora-frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend
    container_name: planora-frontend-local
    ports:
      - "3000:80"
    depends_on:
      - planora-api
    networks:
      - planora-network
    restart: unless-stopped

networks:
  planora-network:
    driver: bridge
```

---

## 5. Guía de Comandos Operativos de Docker

### Compilar las imágenes localmente:
```bash
# Compilar backend
docker build -t planora-api:latest -f docker/Dockerfile.api .

# Compilar frontend
docker build -t planora-frontend:latest -f docker/Dockerfile.frontend .
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
docker tag planora-frontend:latest tu_usuario_dockerhub/planora-frontend:v1.0.0
```

### Publicar en Docker Hub:
```bash
docker login
docker push tu_usuario_dockerhub/planora-api:v1.0.0
docker push tu_usuario_dockerhub/planora-frontend:v1.0.0
```
