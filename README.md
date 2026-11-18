# Planora — Plataforma de Gestión Profesional de Eventos

![Estado](https://img.shields.io/badge/Estado-MVP%20en%20Desarrollo-green)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue?logo=github-actions)
[![Cloudflare Edge](https://img.shields.io/badge/Deploy-Cloudflare%20Pages%20%26%20Workers-orange?logo=cloudflare)](https://cloudflare.com)
[![Database](https://img.shields.io/badge/Database-Cloudflare%20D1%20(SQLite)-yellow?logo=sqlite)](https://developers.cloudflare.com/d1/)
![Docker Hub](https://img.shields.io/badge/Docker%20Hub-planora--api-2496ED?logo=docker)
[![Testing](https://img.shields.io/badge/Testing-Vitest%20(%E2%89%A585%25%20Domain)-green?logo=vitest)](https://vitest.dev)
[![APM](https://img.shields.io/badge/APM-Sentry%20Tracing%20%26%20Errors-362D59?logo=sentry)](https://sentry.io)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

> **Plataforma SaaS B2B para Gestión de Eventos Profesionales**  
> **Arquitectura:** Serverless Edge Computing, Clean Architecture, CI/CD Automatizado (GitHub Actions) y APM con Sentry.

> **Estado actual:** el monorepo (`packages/api` y `packages/frontend`) cuenta con lógica de dominio, API REST Hono, SPA React 18, monitoreo APM con Sentry (**Trazas, Errores y Mensajes**), configuración `packages/api/wrangler.toml`, plantilla `.env.example` y pipelines de GitHub Actions ([`.github/workflows/backend.yml`](.github/workflows/backend.yml) y [`.github/workflows/frontend.yml`](.github/workflows/frontend.yml)) para **Build**, **Pruebas Unitarias** y despliegue a ambientes **Dev** (`develop`) y **Prod** (`main`). El aprovisionamiento manual de recursos en la nube (D1/R2/KV, cuentas Cloudflare, proyecto Sentry y Docker) se configura mediante Secrets y Variables de GitHub Environments.

---

## 📌 Descripción del Proyecto

**Planora** es una solución web integral diseñada específicamente para organizadores profesionales de eventos (*wedding planners*, coordinadores corporativos, organizadores de graduaciones y XV años).

A diferencia de los portales de descubrimiento masivo de boletos, **Planora** funciona como el **centro de control operativo y financiero B2B** del organizador, permitiendo centralizar en un solo lugar:
- Clientes y cotizaciones.
- Eventos y su ciclo de vida (`draft` $\rightarrow$ `confirmed` $\rightarrow$ `completed`).
- Lista de invitados, confirmaciones de asistencia (RSVP) y aforo de mesas.
- Menús por comensal, alergias críticas y Reporte Oficial para Catering.
- Catálogo de proveedores y servicios contratados con contratos firmados en Cloudflare R2.
- Conciliación de presupuestos en tiempo real, registro de gastos y alertas de sobrecosto por semáforo.
- Tablero de tareas operativas con seguimiento de fechas límite.
- Cronograma minuto a minuto del día del evento con detección automática de solapamientos horarios.

---

## 🚀 Arquitectura Tecnológica y Lógica (Clean Architecture en el Edge)

La plataforma implementa una **Arquitectura Limpia (Clean Architecture / Puertos y Adaptadores)** desacoplada y diseñada para operar nativamente en la red global Anycast de **Cloudflare**:

```text
Usuario → Frontend (React SPA) → Cloudflare Edge (WAF/DNS) → API Gateway (Hono) → Servicios de Dominio → Persistencia (D1/R2/KV)
```

- **Frontend (Capa de Presentación):** Single Page Application en **React 18 + TypeScript + Vite + Tailwind CSS**, servida desde **Cloudflare Pages**.
- **Edge Routing & Seguridad:** Cloudflare Anycast DNS, protección DDoS con TLS 1.3, *rate limiting* de Workers en `/api/v1/auth/*` (10 peticiones / 10 s por IP, responde 429) y enrutamiento inteligente de tráfico estático y API.
- **Backend API (API Gateway & Controladores):** Microframework **Hono** sobre **Cloudflare Workers** (tiempo de arranque en frío de 0 ms mediante V8 Isolates) con validación estricta de esquemas Zod.
- **Capa de Servicios y Dominio:** Lógica de negocio pura (presupuestos, RSVP, itinerarios) desacoplada de la infraestructura mediante Puertos e Inversión de Dependencias (DIP).
- **Persistencia Transaccional:** **Cloudflare D1** (SQLite relacional distribuido) operado mediante **Drizzle ORM** (cero sobrecarga en tiempo de ejecución).
- **Almacenamiento de Objetos:** **Cloudflare R2** para contratos PDF y comprobantes digitales sin costos de transferencia saliente (*zero egress fees*).
- **Caché y Sesiones:** **Cloudflare KV** para revocación de tokens JWT (logout seguro).
- **Calidad y Testing:** **Vitest** con cobertura superior al 85% en la capa de servicios de dominio.
- **Contenedores y DevOps:** **Docker** (multi-stage builds) para compilación y pruebas herméticas reproducibles, publicación en **Docker Hub** y pipeline CI/CD en **GitHub Actions**.

---

## 📚 Índice de Documentación Técnica

Toda la especificación técnica, modelos y diseño se encuentra detallada en la carpeta [`/docs`](docs/):

| Documento | Descripción |
|-----------|-------------|
| 📘 [`docs/documento-final-word.md`](docs/documento-final-word.md) | **Documento Maestro Completo (Especificación del Sistema):** Especificación técnica oficial en 11 secciones detalladas. |
| 📄 [`docs/project-proposal.md`](docs/project-proposal.md) | Propuesta general, nombres evaluados, problemática, objetivos, alcance y especificación de los 10 componentes del MVP. |
| 🗄️ [`docs/database-model.md`](docs/database-model.md) | Diagrama Entidad-Relación (Mermaid) de 11 tablas, cardinalidades (1:1, 1:N, N:M), normalización y DDL SQL completo para Cloudflare D1. |
| 🧩 [`docs/class-diagram.md`](docs/class-diagram.md) | Diagrama de clases UML completo en Mermaid, incluyendo atributos, métodos CRUD y lógica de negocio avanzada. |
| 🏛️ [`docs/architecture.md`](docs/architecture.md) | Arquitectura lógica del software (Clean Architecture en 6 capas), homologación con los íconos oficiales de Azure, y comparativa del stack. |
| ☁️ [`docs/infrastructure.md`](docs/infrastructure.md) | Diagrama de infraestructura Cloudflare, inventario de recursos y archivo declarativo `wrangler.toml`. |
| 🚀 [`docs/deployment.md`](docs/deployment.md) | Flujo completo de CI/CD en GitHub Actions, publicación en Docker Hub y despliegue continuo con Wrangler. |
| 🐳 [`docs/docker-strategy.md`](docs/docker-strategy.md) | Dockerfiles multi-stage para backend y frontend, ejecución local con adaptadores Node, `docker-compose.yml` y comandos de Docker Hub. |
| 🧪 [`docs/testing-strategy.md`](docs/testing-strategy.md) | Estrategia de pruebas con Vitest y ejemplos para los 5 casos de prueba (presupuesto, mesas, catering, agenda y seguridad). |
| 🌿 [`docs/branching-strategy.md`](docs/branching-strategy.md) | Modelo de ramas Git Flow adaptado, flujo de Pull Requests y convención de Conventional Commits. |
| 📅 [`docs/project-plan.md`](docs/project-plan.md) | Plan de trabajo en 8 fases de ingeniería, 10 milestones y estructura de 6 columnas del GitHub Project Board. |
| 📋 [`docs/issues-backlog.md`](docs/issues-backlog.md) | Backlog de 23 GitHub Issues accionables con prioridades, dependencias y criterios de aceptación verificables. |
| 📊 [`docs/presentation-structure.md`](docs/presentation-structure.md) | Estructura detallada de las 18 diapositivas con puntos clave y guion ejecutivo de presentación de producto. |

---

## 💻 Guía Rápida de Ejecución Local

### Prerrequisitos
- Node.js v20 LTS o superior
- Docker y Docker Compose v2 (opcional para ejecución en contenedores)
- Cuenta en Cloudflare y Wrangler CLI instalado (`npm i -g wrangler`)

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone https://github.com/Federico2003/GestionEventos.git
cd GestionEventos
npm install
```

### 2. Verificar calidad, tipos y pruebas con Vitest
```bash
npm run typecheck
npm run lint
npm run test
# Para ejecutar pruebas por paquete o generar reporte de cobertura:
npm run test --workspace=packages/api
npm run test --workspace=packages/frontend
npm run test:coverage
```

### 3. Ejecución local en desarrollo (Node + Vite)
```bash
# Terminal 1: Backend API en http://localhost:8787
npm run dev:api

# Terminal 2: Frontend SPA en http://localhost:3000
npm run dev:frontend
```

### 4. Docker (API + Frontend)
Imágenes multi-stage en [`docker/`](docker): [`Dockerfile.api`](docker/Dockerfile.api) (Node 20 Alpine, usuario `planora`, healthcheck) y [`Dockerfile.frontend`](docker/Dockerfile.frontend) (Vite + Nginx Alpine). Los pipelines las publican en Docker Hub como `<usuario>/planora-api` y `<usuario>/planora-web`.
```bash
# Solución completa: Frontend en http://localhost:3000 y API en http://localhost:8787
docker compose up -d --build

# Solo la API
docker build -f docker/Dockerfile.api -t planora-api .
docker run -p 8787:8787 -e JWT_SECRET=una-clave-de-al-menos-16-caracteres planora-api
```
- **Healthcheck:** `http://localhost:8787/api/v1/health`

### 5. Base de datos D1 (Drizzle ORM)
El esquema de las 11 tablas está en [`packages/api/src/infrastructure/db/schema.ts`](packages/api/src/infrastructure/db/schema.ts) y las migraciones SQL en [`packages/api/migrations`](packages/api/migrations).
```bash
npm run db:generate -w @planora/api        # drizzle-kit generate (nuevas migraciones)
npm run db:migrate:local -w @planora/api   # wrangler d1 migrations apply --local (crea las 11 tablas)
npm run db:seed:local -w @planora/api      # carga los datos de ejemplo (seed/seed.sql)
```
En la nube, el pipeline aplica las migraciones a `planora-d1-dev` / `planora-d1-prod` antes de cada deploy, y `GET /api/v1/health` reporta el estado de D1.

### 6. Despliegue manual a Cloudflare y Monitoreo APM (Sentry)
```bash
# Desde la carpeta del Worker (contiene wrangler.toml con [env.dev] y [env.production])
cd packages/api

# Desplegar API en Ambiente Dev o Prod
npx wrangler deploy --env dev
npx wrangler deploy --env production
cd ../..

# Desplegar Frontend en Cloudflare Pages
npx wrangler pages deploy packages/frontend/dist --project-name=planora-web-dev --branch=develop
npx wrangler pages deploy packages/frontend/dist --project-name=planora-web --branch=main
```

- **Pipelines CI/CD:** [`.github/workflows/backend.yml`](.github/workflows/backend.yml) y [`.github/workflows/frontend.yml`](.github/workflows/frontend.yml).
  - **BackEnd:** Build → Pruebas Unitarias + **UAT Report** (JUnit) + Cobertura → **Docker Hub** (`planora-api`) → **Ambiente Dev** (migraciones D1 + Worker) → ⏸ aprobación → **Ambiente Prod**.
  - **Frontend:** Build → Pruebas Unitarias + reporte → **Docker Hub** (`planora-web`) → **Ambiente Dev** → ⏸ aprobación → **Ambiente Prod**.
  - Un push a `develop` despliega solo a Dev. Un merge a `main` despliega a Dev y, tras la aprobación del Environment `production` (Required reviewers), promueve a Prod.
- **APM con Sentry:** Configura `SENTRY_DSN` (Backend) y `VITE_SENTRY_DSN` (Frontend) según [`.env.example`](.env.example) y valida trazas, mensajes, errores y logs mediante `GET /api/v1/apm/test?mode=message|error|log` o desde el panel **Observabilidad APM • Sentry** del Dashboard Administrador.
- **Métricas:** CPU, memoria y requests del Worker en Cloudflare → *Workers & Pages* → `planora-api-dev` / `planora-api-prod` → *Metrics*.

---

## 👥 Roles del Sistema y Permisos

| Rol | Descripción | Acceso Principal |
|-----|-------------|------------------|
| **Administrador (`admin`)** | Administrador de la infraestructura técnica y auditoría. | Panel de métricas globales y administración de usuarios. |
| **Organizador (`organizer`)** | Usuario profesional central de la plataforma. | Gestión completa de clientes, eventos, finanzas, tareas, proveedores e invitados. |
| **Cliente (`client`)** | Anfitrión del evento (novios, festejado, comité). | Portal de consulta (avance, resumen de presupuesto y cronograma) y confirmación de su lista de invitados. |
