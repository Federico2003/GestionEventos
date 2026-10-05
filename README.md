# Planora — Plataforma de Gestión Profesional de Eventos

[![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue?logo=github-actions)](https://github.com)
[![Cloudflare Edge](https://img.shields.io/badge/Deploy-Cloudflare%20Pages%20%26%20Workers-orange?logo=cloudflare)](https://cloudflare.com)
[![Database](https://img.shields.io/badge/Database-Cloudflare%20D1%20(SQLite)-yellow?logo=sqlite)](https://developers.cloudflare.com/d1/)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-Images%20Published-2496ED?logo=docker)](https://hub.docker.com)
[![Testing](https://img.shields.io/badge/Testing-Vitest%20(%E2%89%A585%25%20Domain)-green?logo=vitest)](https://vitest.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

> **Proyecto Final de Grado**  
> **Asignatura:** Infraestructura para el Desarrollo Continuo (9º Semestre)  
> **Enfoque:** Arquitectura Serverless Edge, Integración Continua, Containerización Docker y Despliegue Automatizado en la Nube de Cloudflare.

---

## 📌 Descripción del Proyecto

**Planora** es una solución web integral diseñada específicamente para organizadores profesionales de eventos (*wedding planners*, coordinadores corporativos, organizadores de graduaciones y XV años).

A diferencia de los portales de descubrimiento masivo de boletos, **Planora** funciona como el **centro de control operativo y financiero B2B** del organizador, permitiendo centralizar en un solo lugar:
- Clientes y cotizaciones.
- Eventos y su ciclo de vida (`draft` $\rightarrow$ `confirmed` $\rightarrow$ `completed`).
- Lista de invitados, confirmaciones de asistencia (RSVP) y aforo de mesas.
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
- **Edge Routing & Seguridad:** Cloudflare Anycast DNS, WAF con terminación TLS 1.3 y enrutamiento inteligente de tráfico estático y API.
- **Backend API (API Gateway & Controladores):** Microframework **Hono** sobre **Cloudflare Workers** (tiempo de arranque en frío de 0 ms mediante V8 Isolates) con validación estricta de esquemas Zod.
- **Capa de Servicios y Dominio:** Lógica de negocio pura (presupuestos, RSVP, itinerarios) desacoplada de la infraestructura mediante Puertos e Inversión de Dependencias (DIP).
- **Persistencia Transaccional:** **Cloudflare D1** (SQLite relacional distribuido) operado mediante **Drizzle ORM** (cero sobrecarga en tiempo de ejecución).
- **Almacenamiento de Objetos:** **Cloudflare R2** para contratos PDF y comprobantes digitales sin costos de transferencia saliente (*zero egress fees*).
- **Caché y Sesiones:** **Cloudflare KV** para revocación de tokens JWT (logout seguro) y limitación de tasa de peticiones (*rate limiting*).
- **Calidad y Testing:** **Vitest** con cobertura superior al 85% en la capa de servicios de dominio.
- **Contenedores y DevOps:** **Docker** (multi-stage builds) para compilación y pruebas herméticas reproducibles, publicación en **Docker Hub** y pipeline CI/CD en **GitHub Actions**.

---

## 📚 Índice de Documentación Técnica

Toda la especificación técnica, modelos y diseño se encuentra detallada en la carpeta [`/docs`](file:///docs):

| Documento | Descripción |
|-----------|-------------|
| 📘 [`docs/documento-final-word.md`](file:///docs/documento-final-word.md) | **Documento Maestro Completo (Entregable Final Word):** Acomodo oficial en 11 secciones listo para entrega académica. |
| 📄 [`docs/project-proposal.md`](file:///docs/project-proposal.md) | Propuesta general, nombres evaluados, problemática, objetivos, alcance y especificación de los 10 componentes del MVP. |
| 🗄️ [`docs/database-model.md`](file:///docs/database-model.md) | Diagrama Entidad-Relación (Mermaid), cardinalidades (1:1, 1:N, N:M), normalización y DDL SQL completo para Cloudflare D1. |
| 🧩 [`docs/class-diagram.md`](file:///docs/class-diagram.md) | Diagrama de clases UML completo en Mermaid, incluyendo atributos, métodos CRUD y lógica de negocio avanzada. |
| 🏛️ [`docs/architecture.md`](file:///docs/architecture.md) | Arquitectura lógica del software (Clean Architecture en 6 capas), homologación con íconos oficiales de AWS y Azure, y comparativa del stack. |
| ☁️ [`docs/infrastructure.md`](file:///docs/infrastructure.md) | Diagrama de infraestructura Cloudflare, inventario de recursos y archivo declarativo `wrangler.toml`. |
| 🚀 [`docs/deployment.md`](file:///docs/deployment.md) | Flujo completo de CI/CD en GitHub Actions, publicación en Docker Hub y despliegue continuo con Wrangler. |
| 🐳 [`docs/docker-strategy.md`](file:///docs/docker-strategy.md) | Dockerfiles multi-stage para backend y frontend, configuración de `docker-compose.yml` y comandos de Docker Hub. |
| 🧪 [`docs/testing-strategy.md`](file:///docs/testing-strategy.md) | Estrategia de pruebas unitarias con Vitest, ejemplos ejecutables para presupuestos, eventos, RSVP y detección de conflictos. |
| 🌿 [`docs/branching-strategy.md`](file:///docs/branching-strategy.md) | Modelo de ramas Git Flow adaptado, flujo de Pull Requests y convención de Conventional Commits. |
| 📅 [`docs/project-plan.md`](file:///docs/project-plan.md) | Plan de trabajo en 9 fases de ingeniería, 10 milestones y estructura de 6 columnas del GitHub Project Board. |
| 📋 [`docs/issues-backlog.md`](file:///docs/issues-backlog.md) | Backlog de 23 GitHub Issues accionables con prioridades, dependencias y criterios de aceptación verificables. |
| 🎓 [`docs/presentation-structure.md`](file:///docs/presentation-structure.md) | Estructura detallada de las 18 diapositivas con puntos clave y guion de exposición para la defensa universitaria. |

---

## 💻 Guía Rápida de Ejecución Local

### Prerrequisitos
- Node.js v20 LTS o superior
- Docker y Docker Compose v2 (opcional para ejecución en contenedores)
- Cuenta en Cloudflare y Wrangler CLI instalado (`npm i -g wrangler`)

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone https://github.com/tu-usuario/planora.git
cd planora
npm install
```

### 2. Ejecutar pruebas unitarias con Vitest
```bash
npm run test
# Para generar reporte de cobertura:
npm run test:coverage
```

### 3. Levantar la aplicación con Docker Compose
```bash
docker compose up -d --build
```
- **Frontend Web UI:** `http://localhost:3000`
- **Backend REST API:** `http://localhost:8787/api/v1/health`

### 4. Despliegue manual a Cloudflare (mediante Wrangler)
```bash
# Aplicar migraciones a la base de datos D1
npx wrangler d1 migrations apply planora-d1-prod --remote

# Desplegar API en Cloudflare Workers
npx wrangler deploy

# Desplegar Frontend en Cloudflare Pages
npx wrangler pages deploy packages/frontend/dist --project-name=planora-web
```

---

## 👥 Roles del Sistema y Permisos

| Rol | Descripción | Acceso Principal |
|-----|-------------|------------------|
| **Administrador (`admin`)** | Administrador de la infraestructura técnica y auditoría. | Panel de métricas globales y administración de usuarios. |
| **Organizador (`organizer`)** | Usuario profesional central de la plataforma. | Gestión completa de clientes, eventos, finanzas, tareas, proveedores e invitados. |
| **Cliente (`client`)** | Anfitrión del evento (novios, festejado, comité). | Portal de solo lectura y confirmación de lista de invitados y timeline. |
