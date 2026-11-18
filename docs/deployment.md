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
        DockerHubRegistry[("Docker Hub Registry\nusername/planora-api\nusername/planora-frontend")]
    end

    subgraph CloudflareProduction["Entorno de Producción Cloudflare"]
        CFPagesLive["Cloudflare Pages Live\n(https://planora.app)"]
        CFWorkersLive["Cloudflare Workers Live\n(https://planora.app/api/v1/*)"]
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

## 3. Especificación del Pipeline de GitHub Actions

El archivo `.github/workflows/ci-cd.yml` implementa el flujo automatizado:

```yaml
name: Planora CI/CD Pipeline

on:
  push:
    branches: [main, develop]
    tags: ['v*.*.*']
  pull_request:
    branches: [main, develop]

env:
  API_IMAGE: planora-api
  FRONTEND_IMAGE: planora-frontend

jobs:
  # ========================================================
  # ETAPA 1: LINTING, TYPE CHECK Y PRUEBAS UNITARIAS
  # ========================================================
  quality-and-tests:
    name: Code Quality & Unit Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout del Repositorio
        uses: actions/checkout@v4

      - name: Configurar Node.js LTS (v20)
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Instalar Dependencias del Monorepo
        run: npm ci

      - name: Verificación Estática de Tipos (TypeScript)
        run: npm run typecheck

      - name: Análisis de Código Estático (ESLint)
        run: npm run lint

      - name: Ejecución de Pruebas Unitarias (Vitest con umbrales de cobertura)
        # Falla si la cobertura del dominio es < 85% (ver vitest.config.ts)
        run: npm run test:coverage

      - name: Publicar Reporte de Cobertura
        uses: actions/upload-artifact@v4
        with:
          name: test-coverage-report
          path: coverage/

  # ========================================================
  # ETAPA 2: DOCKER BUILD & PUBLICACIÓN EN DOCKER HUB
  # ========================================================
  docker-hub-publish:
    name: Docker Build & Push to Docker Hub
    needs: quality-and-tests
    runs-on: ubuntu-latest
    # Publica en cada push a main y en cada tag de versión (v1.0.0, v1.0.1, ...)
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))
    steps:
      - name: Checkout del Repositorio
        uses: actions/checkout@v4

      - name: Configurar Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login en Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}

      # Genera las etiquetas: latest (solo main), sha-<corto> y SemVer (en tags v*.*.*)
      - name: Metadata de Tags (API)
        id: meta-api
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.DOCKER_USERNAME }}/${{ env.API_IMAGE }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix=sha-
            type=semver,pattern=v{{version}}

      - name: Metadata de Tags (Frontend)
        id: meta-web
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.DOCKER_USERNAME }}/${{ env.FRONTEND_IMAGE }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix=sha-
            type=semver,pattern=v{{version}}

      - name: Construir y Publicar Imagen Docker del Backend (API)
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/Dockerfile.api
          push: true
          tags: ${{ steps.meta-api.outputs.tags }}
          labels: ${{ steps.meta-api.outputs.labels }}

      - name: Construir y Publicar Imagen Docker del Frontend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/Dockerfile.frontend
          push: true
          tags: ${{ steps.meta-web.outputs.tags }}
          labels: ${{ steps.meta-web.outputs.labels }}

  # ========================================================
  # ETAPA 3: DESPLIEGUE CONTINUO EN CLOUDFLARE
  # ========================================================
  cloudflare-deploy:
    name: Cloudflare Production Deployment
    needs: docker-hub-publish
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - name: Checkout del Repositorio
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Instalar Dependencias
        run: npm ci

      - name: Aplicar Migraciones D1 a Producción
        working-directory: packages/api
        run: npx wrangler d1 migrations apply planora-d1-prod --remote
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Desplegar Cloudflare Worker (API)
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: packages/api
          command: deploy

      - name: Compilar Frontend React para Producción
        run: npm run build --workspace=packages/frontend
        env:
          VITE_API_URL: https://planora.app/api/v1

      - name: Desplegar Cloudflare Pages (Frontend)
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy packages/frontend/dist --project-name=planora-web
```

### 3.1 Secretos Requeridos en GitHub (`Settings → Secrets and variables → Actions`)

| Secreto | Uso |
|---|---|
| `DOCKER_USERNAME` | Usuario de Docker Hub (también forma el nombre de las imágenes). |
| `DOCKER_TOKEN` | Access Token de Docker Hub con permiso de escritura. |
| `CLOUDFLARE_API_TOKEN` | Token con permisos de Workers, Pages y D1. |
| `CLOUDFLARE_ACCOUNT_ID` | Identificador de la cuenta de Cloudflare. |

**Variables por Environment (`dev` y `production`):** `CF_PAGES_PROJECT`, `FRONTEND_URL`, `VITE_API_URL` y `D1_DATABASE_ID` (ID de `planora-d1-dev` / `planora-d1-prod`, salida `d1_databases` de Terraform). El pipeline sustituye `__D1_DATABASE_ID__` en `wrangler.toml` y ejecuta `wrangler d1 migrations apply DB --remote` antes de desplegar el Worker.

### 3.2 Integración Continua desde el Inicio del Proyecto

Para que las reglas de protección de ramas (ver `branching-strategy.md`) tengan efecto desde el primer Pull Request, el job `quality-and-tests` se habilita desde el Milestone **M1** con los scripts básicos de lint, typecheck y pruebas. En el Milestone **M8** se completa el pipeline con los jobs de Docker Hub y en **M9** con el despliegue a Cloudflare.
