# Estrategia y Flujo de Despliegue Continuo (CI/CD) — Planora

**Herramienta de Orquestación:** GitHub Actions  
**Registro de Contenedores:** Docker Hub  
**Plataforma de Despliegue:** Cloudflare (Workers & Pages)  
**Herramienta de Despliegue en el Borde:** Cloudflare Wrangler CLI  

---

## 1. Aclaración Fundamental sobre la Arquitectura de Despliegue

> [!IMPORTANT]
> **Diferenciación Técnica Clave:**  
> **Cloudflare Workers NO ejecuta contenedores Docker en tiempo de ejecución.**  
> Cloudflare Workers opera sobre **V8 Isolates** nativos distribuidos en el Edge, lo que le permite iniciar en 0 milisegundos sin la sobrecarga de un sistema operativo contenedorizado.
> 
> **¿Por qué se utiliza Docker y Docker Hub en este proyecto?**
> 1. **Entorno de Compilación y Pruebas 100% Reproducible:** Docker aísla las dependencias del sistema operativo, garantizando que los tests de Vitest y las compilaciones de TypeScript se ejecuten exactamente igual en la máquina del desarrollador y en los agentes de GitHub Actions.
> 2. **Cumplimiento de Estándares de Infraestructura de la Asignatura:** Satisface los requisitos de entrega de la materia *Infraestructura para el Desarrollo Continuo*, empaquetando los artefactos del backend y frontend como imágenes OCI versionadas y publicadas en Docker Hub.
> 3. **Portabilidad y Despliegues Alternativos:** Facilita la ejecución de la plataforma en entornos on-premise, servidores locales de evaluación docente o nubes alternativas en caso de requerirse.

---

## 2. Diagrama de Pipeline de Deployment (Mermaid)

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#ffffff',
    'primaryBorderColor': '#1e293b',
    'primaryTextColor': '#0f172a',
    'lineColor': '#334155',
    'secondaryColor': '#ffffff',
    'tertiaryColor': '#ffffff',
    'mainBkg': '#ffffff',
    'nodeBorder': '#1e293b',
    'nodeTextColor': '#0f172a',
    'clusterBkg': '#ffffff',
    'clusterBorder': '#64748b',
    'clusterTextColor': '#0f172a',
    'titleColor': '#0f172a',
    'edgeLabelBackground': '#ffffff'
  }
}}%%
flowchart TD
    subgraph DevStation["Estación de Trabajo del Desarrollador"]
        Dev["Ingeniero de Software"]
        GitCommit["Git Commit (Conventional Commits)"]
        GitPush["Git Push a GitHub"]
    end

    subgraph GitHubPlatform["GitHub Repository & Actions CI/CD"]
        PRCheck["Pull Request / Push a 'main' o 'develop'"]
        
        subgraph Stage1["1. Pipeline de Calidad y Pruebas"]
            LintJob["Linting & Type Check\n(ESLint + tsc --noEmit)"]
            TestJob["Pruebas Unitarias\n(Vitest: Cobertura ≥ 85% Dominio)"]
        end

        subgraph Stage2["2. Pipeline Docker (Build & Registry)"]
            DockerBuild["Docker Build Multi-stage\n(API & Frontend)"]
            DockerHubAuth["Autenticación con Docker Hub\n(Secrets: DOCKER_USERNAME / DOCKER_TOKEN)"]
            DockerPush["Docker Push a Docker Hub\n(Tags: latest, sha-corto, SemVer)"]
        end

        subgraph Stage3["3. Pipeline de Despliegue Cloudflare"]
            WranglerWorker["Wrangler Deploy\n(Cloudflare Worker: planora-api)"]
            WranglerPages["Wrangler Pages Deploy\n(Cloudflare Pages: planora-web)"]
            D1Migrate["D1 Database Migrations\n(wrangler d1 migrations apply)"]
        end
    end

    subgraph Registries["Registro Público"]
        DockerHubRegistry[("Docker Hub Registry\nfrederickz/planora-api\nfrederickz/planora-web")]
    end

    subgraph CloudflareProduction["Entorno de Producción Cloudflare"]
        CFPagesLive["Cloudflare Pages\n(planora-web-dev / planora-web)"]
        CFWorkersLive["Cloudflare Workers\n(planora-api-dev / planora-api-prod)"]
        CFD1Live[("Cloudflare D1 Database\n(Producción Migrada)")]
    end

    %% Conexiones
    Dev --> GitCommit --> GitPush --> PRCheck
    PRCheck --> LintJob --> TestJob
    TestJob --> DockerBuild --> DockerHubAuth --> DockerPush
    DockerPush --> DockerHubRegistry

    DockerPush --> D1Migrate
    D1Migrate --> WranglerWorker
    D1Migrate --> WranglerPages

    WranglerWorker --> CFWorkersLive
    WranglerPages --> CFPagesLive
    D1Migrate --> CFD1Live
```

---

## 3. Especificación de los Pipelines de GitHub Actions

El CI/CD está dividido en **cuatro workflows**, uno por componente y ambiente. Dev se despliega desde `develop` y Prod desde `main`, con aprobación manual:

| Workflow | Se dispara con | Jobs |
|---|---|---|
| [`backend-dev.yml`](../.github/workflows/backend-dev.yml) — **BackEnd Dev** | `pull_request` a `develop`/`main` (solo Build y Pruebas) y `push` a `develop` | Build y Pruebas (UAT) → Docker Hub `planora-api:dev` → Ambiente Dev |
| [`backend-prod.yml`](../.github/workflows/backend-prod.yml) — **BackEnd Prod** | `push` a `main` (o manual) | Build y Pruebas (UAT) → Docker Hub `planora-api:latest` → ⏸ aprobación → Ambiente Prod |
| [`frontend-dev.yml`](../.github/workflows/frontend-dev.yml) — **Frontend Dev** | `pull_request` a `develop`/`main` y `push` a `develop` | Build y Pruebas → Docker Hub `planora-web:dev` → Ambiente Dev |
| [`frontend-prod.yml`](../.github/workflows/frontend-prod.yml) — **Frontend Prod** | `push` a `main` (o manual) | Build y Pruebas → Docker Hub `planora-web:latest` → ⏸ aprobación → Ambiente Prod |

### Detalle de los jobs
| Job | Qué hace |
|---|---|
| **Build y Pruebas** | `npm ci`, lint, typecheck (src, tests y scripts), build y Vitest con reporte JUnit publicado como **UAT Report**; en backend, además, cobertura con umbrales (dominio ≥ 85%). |
| **Docker Hub** | Construye `docker/Dockerfile.api` o `docker/Dockerfile.frontend` y publica el tag del ambiente (`dev` o `latest`) y `sha-<commit>`. |
| **BackEnd - Ambiente Dev / Prod** | Sustituye `D1_DATABASE_ID`, aplica `wrangler d1 migrations apply DB --remote`, despliega el Worker (`planora-api-dev` / `planora-api-prod`) y sube los secretos (`JWT_SECRET`, `SENTRY_DSN`, `ALLOWED_ORIGINS`). |
| **Frontend - Ambiente Dev / Prod** | Compila con `VITE_API_URL`, `VITE_APP_ENV` y `VITE_SENTRY_DSN` del Environment y ejecuta `wrangler pages deploy` al proyecto `planora-web-dev` / `planora-web` (`--branch=main`, para que quede como despliegue productivo del proyecto y no como preview). |
| **Aprobación manual** | Los jobs de Prod usan el Environment `production` con *Required reviewers*: el despliegue espera a que el responsable lo apruebe. |

Todos los pasos de Cloudflare usan Node 22 (requisito de Wrangler 4).

### 3.1 Secretos Requeridos en GitHub (`Settings → Secrets and variables → Actions`)

| Secreto | Uso |
|---|---|
| `DOCKER_USERNAME` | Usuario de Docker Hub (también forma el nombre de las imágenes). |
| `DOCKER_TOKEN` | Access Token de Docker Hub con permiso de escritura. |
| `CLOUDFLARE_API_TOKEN` | Token con permisos de Workers, Pages y D1. |
| `CLOUDFLARE_ACCOUNT_ID` | Identificador de la cuenta de Cloudflare. |

**Variables por Environment (`dev` y `production`):** `CF_PAGES_PROJECT`, `FRONTEND_URL`, `VITE_API_URL` y `D1_DATABASE_ID` (ID de `planora-d1-dev` / `planora-d1-prod`, salida `d1_databases` de Terraform). El pipeline sustituye `__D1_DATABASE_ID__` en `wrangler.toml` y ejecuta `wrangler d1 migrations apply DB --remote` antes de desplegar el Worker.

### 3.2 Protección de Ramas

Los jobs **BackEnd - Build y Pruebas (UAT)** y **Frontend - Build y Pruebas** son los status checks que deben pasar antes de integrar un Pull Request a `develop` o `main` (ver `branching-strategy.md`).

