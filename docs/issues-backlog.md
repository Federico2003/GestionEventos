# Backlog Detallado de Tareas (GitHub Issues) — Planora

Cada uno de los siguientes Issues representa una unidad de trabajo atómica y accionable. No contienen descripciones ambiguas ni genéricas; especifican el objetivo técnico, las dependencias y los criterios de aceptación verificables.

---

### Issue #01: Setup del Monorepo, TypeScript, ESLint y Wrangler
- **Objetivo:** Establecer la base del repositorio con soporte para TypeScript, ESLint, Prettier y la configuración inicial de Wrangler para Cloudflare Workers.
- **Prioridad:** Crítica
- **Labels:** `setup`, `infrastructure`, `typescript`
- **Milestone:** M1 — Setup del Monorepo y Herramientas Base
- **Dependencias:** Ninguna
- **Descripción:** Configurar un entorno monorepo estándar de Node.js v20 conteniendo las carpetas `packages/api` y `packages/frontend`, con scripts raíz para ejecutar linter, compilación y pruebas unificadas.
- **Criterios de Aceptación:**
  - [ ] El comando `npm run lint` se ejecuta sin errores en todo el proyecto.
  - [ ] El comando `npm run typecheck` valida los tipos de TypeScript sin fallas.
  - [ ] El archivo `packages/api/wrangler.toml` base está configurado con `nodejs_compat` y nombres de bindings.
  - [ ] Existe `.github/workflows/ci-cd.yml` con el job `quality-and-tests` (lint, typecheck y Vitest) ejecutándose en cada PR hacia `develop` y `main`, y las reglas de protección de ramas lo exigen.

---

### Issue #02: Esquema Relacional D1 y Migraciones con Drizzle ORM
- **Objetivo:** Definir el esquema de datos tipado para SQLite y generar los archivos de migración SQL para Cloudflare D1.
- **Prioridad:** Crítica
- **Labels:** `database`, `d1`, `drizzle`
- **Milestone:** M2 — Base de Datos D1 y Esquemas Drizzle
- **Dependencias:** #01
- **Descripción:** Codificar con Drizzle ORM las 11 tablas del sistema (`users`, `clients`, `events`, `event_tables`, `guests`, `vendors`, `services`, `event_services`, `expenses`, `tasks`, `agenda_items`) con sus restricciones de llaves foráneas, índices e integridad referencial.
- **Criterios de Aceptación:**
  - [ ] `drizzle-kit generate` produce los archivos `.sql` de migración correctamente.
  - [ ] El comando `npx wrangler d1 migrations apply planora-d1-prod --local` se ejecuta limpiamente en el entorno de desarrollo local.
  - [ ] Se aplican índices sobre campos de búsqueda frecuente (`organizer_id`, `event_id`, `email`).

---

### Issue #03: Módulo de Autenticación JWT y Roles RBAC (admin, organizer, client)
- **Objetivo:** Desarrollar el sistema seguro de registro, inicio de sesión y middlewares de autorización basados en roles (`admin`, `organizer`, `client`).
- **Prioridad:** Alta
- **Labels:** `backend`, `security`, `auth`
- **Milestone:** M3 — Autenticación JWT y Roles RBAC
- **Dependencias:** #02
- **Descripción:** Implementar el endpoint `POST /api/v1/auth/login` con verificación de hash seguro de contraseña (usando Web Crypto API compatible con Cloudflare Workers) y generación de token JWT firmado. Construir el middleware `requireRole(['admin', 'organizer'])`.
- **Criterios de Aceptación:**
  - [ ] Peticiones con credenciales inválidas retornan código HTTP 401 Unauthorized con mensaje descriptivo.
  - [ ] El token JWT emitido (HMAC-SHA256) incluye payload con `userId`, `role`, `jti` y expiración a 8 horas.
  - [ ] Un usuario con `is_active = 0` no puede iniciar sesión.
  - [ ] `CP-SEC-05` escenarios 5.1 y 5.2 en verde.
  - [ ] El middleware bloquea el acceso a rutas protegidas con código HTTP 403 si el rol del usuario no tiene permisos suficientes.

---

### Issue #04: Revocación de Tokens (Logout) con Cloudflare KV y Rate Limiting en WAF
- **Objetivo:** Integrar Cloudflare KV para permitir cierre de sesión con revocación de tokens, y configurar la regla de rate limiting del WAF como protección anti-abuso por IP.
- **Prioridad:** Media
- **Labels:** `backend`, `security`, `kv`, `waf`
- **Milestone:** M3 — Autenticación JWT y Roles RBAC
- **Dependencias:** #03
- **Descripción:** Al invocar `POST /api/v1/auth/logout`, almacenar el identificador del token (`jti`) en Cloudflare KV con un tiempo de vida (TTL) igual al tiempo remanente del JWT. Implementar un middleware que consulte KV para denegar peticiones de tokens revocados. Configurar en el WAF de Cloudflare la regla `planora-auth-ratelimit` sobre `/api/v1/auth/*`.
- **Criterios de Aceptación:**
  - [ ] Un token invalidado en el logout no puede reutilizarse en ninguna ruta de la API.
  - [ ] Las lecturas a KV en el Worker se completan en menos de 20 ms.
  - [ ] La regla del WAF bloquea (HTTP 429) durante 10 s a una IP que supere 10 peticiones en 10 s hacia `/api/v1/auth/*` (límites del plan Free).
  - [ ] `CP-SEC-05` escenario 5.4 en verde.

---

### Issue #05: CRUD de Clientes y Aislamiento Multitenant por Organizador
- **Objetivo:** Proporcionar la gestión completa de clientes asociados al organizador autenticado.
- **Prioridad:** Alta
- **Labels:** `backend`, `api`, `clients`
- **Milestone:** M4 — Módulo Core (Eventos, Clientes, Invitados y Mesas)
- **Dependencias:** #03
- **Descripción:** Implementar los endpoints REST para crear, listar, consultar, actualizar y desasociar clientes. Incluir el método de negocio `getClientHistorySummary()` que consolida el historial de eventos del cliente.
- **Criterios de Aceptación:**
  - [ ] Un organizador únicamente puede consultar y editar sus propios clientes (aislamiento por `organizer_id`); los de otro organizador responden 404.
  - [ ] `CP-SEC-05` escenario 5.3 en verde.
  - [ ] No se permite eliminar clientes que tengan eventos activos o en planeación.
  - [ ] Validación estricta de correo y teléfono mediante esquemas Zod.

---

### Issue #06: Módulo de Eventos y Máquina de Estados del Ciclo de Vida
- **Objetivo:** Implementar la gestión de eventos y sus transiciones de estado (`draft`, `planning`, `confirmed`, `in_progress`, `completed`, `cancelled`).
- **Prioridad:** Crítica
- **Labels:** `backend`, `business-logic`, `events`
- **Milestone:** M4 — Módulo Core (Eventos, Clientes, Invitados y Mesas)
- **Dependencias:** #05
- **Descripción:** Desarrollar los métodos de negocio `confirmEvent()` (valida fecha futura y cliente asociado) y `cancelEvent()` (pasa a `cancelled` las tareas no completadas y las contrataciones pendientes). Implementar la clonación de eventos mediante `cloneStructure()`.
- **Criterios de Aceptación:**
  - [ ] No se permite avanzar a `confirmed` un evento con fecha en el pasado o sin cliente asignado.
  - [ ] La clonación genera un nuevo evento duplicando las tareas base e itinerario sin duplicar invitados ni gastos.
  - [ ] El endpoint `GET /api/v1/events/:id/summary` retorna el estado consolidado del evento en una sola llamada.

---

### Issue #07: Módulo de Invitados, RSVP, Aforo de Mesas y Reporte de Catering
- **Objetivo:** Controlar la lista de asistentes a cada evento, procesar confirmaciones, evitar sobrecupo en las mesas y emitir el Reporte Oficial para Catering.
- **Prioridad:** Alta
- **Labels:** `backend`, `business-logic`, `guests`
- **Milestone:** M4 — Módulo Core (Eventos, Clientes, Invitados y Mesas)
- **Dependencias:** #06
- **Descripción:** Crear endpoints para dar de alta las mesas del evento con su capacidad (`event_tables`), registrar invitados, actualizar estado de confirmación (`registerRsvp`), asignar mesas (`assignTable`) validando que titular + acompañantes no superen la capacidad de la mesa, registrar el perfil gastronómico (`registerDietaryProfile`) y generar el reporte `GET /api/v1/events/:id/catering-report`.
- **Criterios de Aceptación:**
  - [ ] El método `assignTable` rechaza la asignación y lanza `TableCapacityExceededError` si los asistentes superan el aforo de la mesa.
  - [ ] Llenar la mesa exactamente a su capacidad está permitido.
  - [ ] No es posible asignar un invitado a una mesa que no exista en el mismo evento.
  - [ ] `CP-MES-02` y `CP-CAT-03` en verde.
  - [ ] El reporte de catering incluye: total de platillos por menú, platillos por mesa y alertas de alergias críticas (invitado, mesa y alérgeno), considerando solo invitados confirmados.
  - [ ] El endpoint de métricas calcula con exactitud: total de invitados, confirmados, declinados y restricciones dietéticas especiales.

---

### Issue #08: Directorio de Proveedores y Catálogo de Servicios Base
- **Objetivo:** Crear el módulo de administración de proveedores clasificados por categoría comercial y sus servicios asociados.
- **Prioridad:** Media
- **Labels:** `backend`, `vendors`, `services`
- **Milestone:** M5 — Motor Financiero, Gastronómico y Operativo
- **Dependencias:** #03
- **Descripción:** Implementar el CRUD de proveedores, registro de servicios con precio base y el método de negocio para actualizar la calificación de desempeño (`updateRating`).
- **Criterios de Aceptación:**
  - [ ] La categoría del proveedor se restringe a valores válidos (`catering`, `music_dj`, `photography`, etc.).
  - [ ] La calificación de proveedor solo acepta valores flotantes en el rango $[1.0, 5.0]$.

---

### Issue #09: Contratación de Servicios (`event_services`) y Almacenamiento en Cloudflare R2
- **Objetivo:** Relacionar servicios de proveedores con eventos específicos y permitir la carga y lectura de contratos PDF en Cloudflare R2.
- **Prioridad:** Alta
- **Labels:** `backend`, `r2`, `contracts`
- **Milestone:** M5 — Motor Financiero, Gastronómico y Operativo
- **Dependencias:** #06, #08
- **Descripción:** Implementar la contratación formal de servicios registrando el precio pactado (`agreed_price`). Habilitar endpoints para subir contratos firmados a Cloudflare R2 y generar URLs de descarga seguras.
- **Criterios de Aceptación:**
  - [ ] La subida de archivos valida que el tipo MIME sea `application/pdf` o imagen y que no sobrepase 10 MB.
  - [ ] El archivo se almacena en el bucket `planora-assets-prod` de R2 usando la llave estructurada `events/{eventId}/contracts/{contractId}.pdf`.
  - [ ] Al contratar un servicio, se genera automáticamente el gasto presupuestario asociado en estado `pending`.

---

### Issue #10: Motor de Presupuesto, Gastos y Semáforo de Sobrecosto
- **Objetivo:** Desarrollar el algoritmo financiero de conciliación de presupuesto, registro de desembolsos y cálculo de alertas de sobrecosto.
- **Prioridad:** Crítica
- **Labels:** `backend`, `finance`, `business-logic`
- **Milestone:** M5 — Motor Financiero, Gastronómico y Operativo
- **Dependencias:** #06, #09
- **Descripción:** Implementar la lógica del método `calculateBudgetStatus()` y `checkBudgetOverrunAlert()`. Administrar el ciclo de pagos de gastos (`pending` $\rightarrow$ `paid`) registrando el comprobante en Cloudflare R2 y la fecha de liquidación.
- **Criterios de Aceptación:**
  - [ ] El sistema calcula con precisión matemática: presupuesto inicial, total gastado, saldo restante y porcentaje de ejecución.
  - [ ] Retorna nivel de semáforo verde ($<90\%$), amarillo ($90\% - 99\%$) o rojo ($\ge 100\%$).
  - [ ] Al liquidar un gasto, se exige la referencia del comprobante y se actualiza `paid_at`.

---

### Issue #11: Tablero de Tareas y Cálculo Dinámico de Progreso Porcentual
- **Objetivo:** Permitir el seguimiento de actividades logísticas con plazos de vencimiento y cálculo dinámico de avance del evento.
- **Prioridad:** Alta
- **Labels:** `backend`, `tasks`, `business-logic`
- **Milestone:** M5 — Motor Financiero, Gastronómico y Operativo
- **Dependencias:** #06
- **Descripción:** Implementar endpoints de tareas con prioridades (`low`, `medium`, `high`, `urgent`), asignación a usuarios y el método `completeTask()` que recalcula en tiempo real el porcentaje de avance del evento.
- **Criterios de Aceptación:**
  - [ ] Finalizar una tarea sella automáticamente el campo `completed_at` con la marca de tiempo actual.
  - [ ] El método `getOverdueTasks()` detecta correctamente tareas no concluidas cuya fecha límite sea anterior a hoy.

---

### Issue #12: Cronograma Minuto a Minuto con Detección de Conflictos Horarios
- **Objetivo:** Orquestar el itinerario del día del evento y alertar automáticamente sobre empalmes de horarios o locaciones.
- **Prioridad:** Alta
- **Labels:** `backend`, `agenda`, `algorithm`
- **Milestone:** M5 — Motor Financiero, Gastronómico y Operativo
- **Dependencias:** #06
- **Descripción:** Desarrollar el CRUD de bloques horarios (`agenda_items`), el reordenamiento secuencial (`order_index`) y el método `detectTimelineConflicts()` que compara intervalos horarios en el mismo escenario físico.
- **Criterios de Aceptación:**
  - [ ] La API rechaza registros donde `start_time` sea mayor que `end_time`.
  - [ ] El algoritmo de detección identifica correctamente intervalos solapados en la misma locación o con la misma persona responsable.

---

### Issue #13: Endpoints del Dashboard Ejecutivo de Métricas y KPIs
- **Objetivo:** Proveer consultas optimizadas que agreguen el estado general de las operaciones del organizador.
- **Prioridad:** Media
- **Labels:** `backend`, `dashboard`, `analytics`
- **Milestone:** M5 — Motor Financiero, Gastronómico y Operativo
- **Dependencias:** #10, #11, #12
- **Descripción:** Crear `GET /api/v1/dashboard` para retornar en una sola llamada el número de eventos en curso, monto total presupuestado, total de tareas atrasadas y próximos eventos en la agenda.
- **Criterios de Aceptación:**
  - [ ] La consulta se ejecuta en menos de 50 ms mediante índices SQL en D1.
  - [ ] Los datos retornados reflejan en tiempo real cualquier cambio en gastos o tareas.

---

### Issue #14: Frontend: Setup de React 18, Vite, Tailwind CSS y Enrutamiento Protegido
- **Objetivo:** Construir la base de la interfaz de usuario web con soporte tipado, estilos utilitarios y guardias de autenticación.
- **Prioridad:** Alta
- **Labels:** `frontend`, `react`, `vite`, `tailwind`
- **Milestone:** M4 — Módulo Core (Eventos, Clientes, Invitados y Mesas)
- **Dependencias:** #03
- **Descripción:** Inicializar la SPA en `packages/frontend`, configurar Tailwind CSS y diseñar el sistema de rutas protegidas con React Router que impida el acceso a vistas privadas a usuarios no autenticados.
- **Criterios de Aceptación:**
  - [ ] Redirección automática a `/login` si no existe token JWT válido.
  - [ ] Navbar y Sidebar responsivos con soporte para modo móvil y escritorio.

---

### Issue #15: Frontend: Vistas de Dashboard, Evento, Invitados y Presupuesto
- **Objetivo:** Desarrollar las interfaces interactivas para gestión de eventos, desglose financiero con semáforo y lista de verificación de tareas.
- **Prioridad:** Alta
- **Labels:** `frontend`, `ui`, `components`
- **Milestone:** M5 — Motor Financiero, Gastronómico y Operativo
- **Dependencias:** #13, #14
- **Descripción:** Crear componentes para:
  - Panel general con tarjetas de KPIs (eventos, balance total, tareas críticas).
  - Vista de detalle de evento con pestañas: Presupuesto (gráfica de barras/progreso), Invitados (tabla con filtro RSVP), Tareas (checklist con badges de urgencia) y Agenda (línea de tiempo).
- **Criterios de Aceptación:**
  - [ ] Las acciones asíncronas muestran estados de carga (*spinners/skeletons*) y notificaciones de éxito/error.
  - [ ] La gráfica de presupuesto cambia dinámicamente de color a verde, amarillo o rojo según el estado devuelto por la API.

---

### Issue #16: Suite Integral de Pruebas Unitarias con Vitest (≥ 85% Dominio)
- **Objetivo:** Garantizar la fiabilidad y robustez de toda la lógica de dominio mediante tests automáticos.
- **Prioridad:** Crítica
- **Labels:** `testing`, `vitest`, `qa`
- **Milestone:** M6 — Pruebas Unitarias Automatizadas en Vitest
- **Dependencias:** #10, #11, #12
- **Descripción:** Implementar las suites de los 5 casos de prueba formales (`CP-FIN-01` a `CP-SEC-05`): `BudgetCalculator`, `GuestEntity`, `CateringReportService`, `AgendaService` y Auth/RBAC, además de `EventEntity`, cubriendo casos normales, valores límite y escenarios de error.
- **Criterios de Aceptación:**
  - [ ] 100% de los tests pasan exitosamente (`npm run test`).
  - [ ] Cobertura de código superior al 85% en las clases y servicios de dominio.
  - [ ] Generación de reporte de cobertura en formato HTML y LCOV.

---

### Issue #17: Dockerización del Backend con Dockerfile Multi-Stage y Healthcheck
- **Objetivo:** Crear una imagen Docker ultra ligera y segura para el backend de la API.
- **Prioridad:** Alta
- **Labels:** `docker`, `devops`, `containers`
- **Milestone:** M7 — Containerización con Docker Multi-stage
- **Dependencias:** #01, #16
- **Descripción:** Diseñar el archivo `docker/Dockerfile.api` utilizando `node:20-alpine`, construcción por etapas (*builder* y *runner*), ejecución bajo usuario no-root (`planora`) y script de `HEALTHCHECK`.
- **Criterios de Aceptación:**
  - [ ] La imagen compila sin advertencias con `docker build`.
  - [ ] El tamaño de la imagen final es menor a 80 MB.
  - [ ] El contenedor arranca la API con `@hono/node-server` y adaptadores locales (SQLite, sistema de archivos y caché en memoria).
  - [ ] El comando de healthcheck responde exitosamente en `/api/v1/health`.

---

### Issue #18: Dockerización del Frontend con Nginx Alpine y Docker Compose Local
- **Objetivo:** Empaquetar el frontend con Nginx Alpine y proporcionar un archivo `docker-compose.yml` para levantar la solución completa localmente.
- **Prioridad:** Alta
- **Labels:** `docker`, `docker-compose`, `frontend`
- **Milestone:** M7 — Containerización con Docker Multi-stage
- **Dependencias:** #15, #17
- **Descripción:** Crear `docker/Dockerfile.frontend` con Nginx configurado para SPA y redactar el archivo `docker-compose.yml` que conecte API y Frontend bajo la misma red virtual bridge.
- **Criterios de Aceptación:**
  - [ ] `docker compose up -d` levanta ambos contenedores sin intervención manual.
  - [ ] La interfaz web es accesible en `http://localhost:3000` y consume el backend en el puerto 8787.

---

### Issue #19: Configuración de Pipeline CI en GitHub Actions (Lint, Types, Tests)
- **Objetivo:** Automatizar la verificación estática de código y la ejecución de pruebas unitarias en cada Pull Request y Push.
- **Prioridad:** Crítica
- **Labels:** `ci`, `github-actions`, `devops`
- **Milestone:** M8 — Pipeline CI/CD en GitHub Actions y Docker Hub
- **Dependencias:** #16
- **Descripción:** Consolidar el job `quality-and-tests` creado en el Issue #01 dentro de `ci-cd.yml`: checkout, setup de Node.js v20 con caché, verificación de tipos con `tsc`, análisis estático con ESLint, pruebas con umbrales de cobertura y publicación del reporte como artefacto.
- **Criterios de Aceptación:**
  - [ ] Los PRs no pueden ser integrados si alguna prueba unitaria o verificación de tipo falla.
  - [ ] El pipeline se completa en menos de 3 minutos en GitHub Actions.

---

### Issue #20: Automatización de Construcción y Push a Docker Hub
- **Objetivo:** Publicar las imágenes Docker compiladas en el registro oficial de Docker Hub mediante GitHub Actions.
- **Prioridad:** Crítica
- **Labels:** `cd`, `dockerhub`, `devops`
- **Milestone:** M8 — Pipeline CI/CD en GitHub Actions y Docker Hub
- **Dependencias:** #17, #18, #19
- **Descripción:** Agregar el job `docker-hub-publish` al workflow de GitHub Actions. Utilizar los secretos `DOCKER_USERNAME` y `DOCKER_TOKEN` para autenticar y empujar las imágenes con etiquetas `latest`, `sha-<commit corto>` y SemVer (`v1.0.0`) generadas con `docker/metadata-action`.
- **Criterios de Aceptación:**
  - [ ] Las imágenes quedan visibles y descargables en los repositorios públicos de Docker Hub del estudiante.
  - [ ] Solo se publican imágenes en pushes a `main` o en tags de versión `v*.*.*`.

---

### Issue #21: Automatización de Despliegue a Cloudflare Workers y Pages con Wrangler
- **Objetivo:** Desplegar de forma automática la versión productiva a la infraestructura global de Cloudflare.
- **Prioridad:** Crítica
- **Labels:** `cd`, `cloudflare`, `deployment`
- **Milestone:** M9 — Despliegue en Producción a Cloudflare Workers y Pages
- **Dependencias:** #20
- **Descripción:** Configurar los pasos de despliegue en GitHub Actions: aplicar migraciones a Cloudflare D1 remoto con Wrangler, desplegar el Worker `planora-api` y desplegar el bundle compilado de React a Cloudflare Pages `planora-web`.
- **Criterios de Aceptación:**
  - [ ] El backend queda disponible y funcional en la URL de producción de Cloudflare Workers.
  - [ ] El frontend se sirve desde Cloudflare Pages con certificados SSL automáticos.
  - [ ] La base de datos D1 en producción contiene las tablas migradas sin pérdida de información.

---

### Issue #22: Documentación Técnica de Arquitectura y Especificación en Wiki
- **Objetivo:** Consolidar toda la documentación técnica de arquitectura, diagramas e infraestructura en formato Markdown para la entrega de la asignatura.
- **Prioridad:** Alta
- **Labels:** `documentation`, `wiki`
- **Milestone:** M10 — Documentación Final y Preparación de la Defensa
- **Dependencias:** Todas las anteriores
- **Descripción:** Elaborar los documentos técnicos en la carpeta `/docs` incluyendo diagramas Mermaid (ERD, Clases, Arquitectura, Infraestructura, Despliegue) y el README principal.
- **Criterios de Aceptación:**
  - [ ] Todos los diagramas Mermaid renderizan limpiamente sin errores sintácticos.
  - [ ] La documentación cubre el 100% de los puntos solicitados por la rúbrica de evaluación.

---

### Issue #23: Elaboración de Guion y Estructura de Diapositivas de Presentación
- **Objetivo:** Diseñar la estructura formal de 18 diapositivas para la defensa oral del proyecto final.
- **Prioridad:** Alta
- **Labels:** `presentation`, `slides`, `academic`
- **Milestone:** M10 — Documentación Final y Preparación de la Defensa
- **Dependencias:** #22
- **Descripción:** Crear el archivo `docs/presentation-structure.md` detallando el contenido exacto de cada diapositiva, notas para el orador y puntos clave de justificación técnica.
- **Criterios de Aceptación:**
  - [ ] Contiene exactamente las 18 diapositivas acordadas con títulos y bullets claros.
  - [ ] Articula coherentemente la relación entre el problema de negocio, la arquitectura Cloudflare, Docker Hub y el pipeline CI/CD.
