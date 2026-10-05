# Estructura y Guion de Presentación Universitaria (18 Diapositivas) — Planora

**Asignatura:** Infraestructura para el Desarrollo Continuo (9º Semestre)  
**Proyecto:** Planora — Plataforma Integral de Gestión y Control Operativo para Organizadores de Eventos  
**Formato de Entrega:** Diapositivas para Exposición / Defensa de Proyecto Final  

---

### Diapositiva 1: Título y Portada
- **Título de la Diapositiva:** Planora: Plataforma Integral de Gestión y Control Operativo para Organizadores Profesionales de Eventos
- **Subtítulo:** Proyecto Final de Ingeniería de Software — Infraestructura para el Desarrollo Continuo
- **Elementos Visuales:** Logo conceptual de Planora, nombre del estudiante, carrera, fecha y escudo universitario.
- **Puntos Clave:**
  - Presentación del proyecto y justificación del nombre (fusión de *Planning* + *Aura*).
  - Enfoque: Arquitectura Serverless en Cloudflare, CI/CD con GitHub Actions y Docker Hub.
- **Notas para el Expositor:** "Buenos días profesores y evaluadores. Hoy presento Planora, una plataforma SaaS diseñada para resolver los desafíos operativos y financieros que enfrentan los coordinadores de eventos profesionales, respaldada por una infraestructura continua moderna en la nube de Cloudflare."

---

### Diapositiva 2: Problemática de la Industria
- **Título:** El Desafío Logístico y Financiero en la Coordinación de Eventos
- **Elementos Visuales:** Gráfico comparativo de "Herramientas Fragmentadas vs. Estrés Operativo".
- **Puntos Clave:**
  - **Dispersión:** Hojas de cálculo aisladas, chats de WhatsApp, contratos perdidos en carpetas personales.
  - **Fuga Financiera (*Budget Creep*):** Desviaciones presupuestarias no detectadas a tiempo entre cotizaciones y desembolsos reales.
  - **Descoordinación en Vivo:** Cronogramas en papel o PDFs desactualizados durante el "minuto a minuto" de la fiesta.
  - **Fricción con el Cliente:** Reporteo manual repetitivo hacia los anfitriones.
- **Notas para el Expositor:** "Un evento social o corporativo no permite margen de error. La dispersión actual genera estrés y pérdidas económicas para los organizadores al no existir una plataforma unificada que integre presupuesto, proveedores y agenda."

---

### Diapositiva 3: Descripción de la Solución
- **Título:** Planora: El Centro de Mando para Organizadores de Eventos
- **Elementos Visuales:** Mockup conceptual de la plataforma web en laptop y móvil.
- **Puntos Clave:**
  - **Qué es:** Una plataforma web SaaS B2B enfocada exclusivamente en el organizador profesional (*wedding planners*, eventos corporativos, graduaciones y XV años).
  - **Qué NO es:** No es un portal público de descubrimiento o venta masiva de boletos tipo Eventbrite.
  - **Propuesta de Valor:** Control operativo integral en un único panel con acceso colaborativo para clientes y proveedores.
- **Notas para el Expositor:** "Planora no compite con plataformas de venta de tickets. Es una herramienta de gestión B2B para que el profesional controle contratos, finanzas, invitados y el cronograma del evento en tiempo real."

---

### Diapositiva 4: Objetivos del Proyecto
- **Título:** Objetivos Generales y Específicos
- **Elementos Visuales:** Diagrama de diana con metas claras y medibles.
- **Puntos Clave:**
  - **Objetivo General:** Desarrollar y desplegar una plataforma web modular para la gestión de eventos, soportada por un pipeline de integración y despliegue continuo automatizado.
  - **Objetivos Específicos:**
    1. Diseñar un modelo de datos relacional normalizado en Cloudflare D1.
    2. Construir una API RESTful ultrarrápida con Hono y Workers (<50ms).
    3. Implementar un motor de lógica de negocio para conciliación financiera y RSVP.
    4. Automatizar el pipeline CI/CD con pruebas en Vitest, publicación en Docker Hub y despliegue en Cloudflare.
- **Notas para el Expositor:** "El objetivo combina dos frentes: entregar una solución de software con lógica de negocio real y demostrar una infraestructura de desarrollo continuo automatizada de nivel industrial."

---

### Diapositiva 5: Usuarios y Matriz de Roles (RBAC)
- **Título:** Modelo de Roles y Control de Acceso
- **Elementos Visuales:** Tabla resumen de la matriz RBAC con iconos de verificación.
- **Puntos Clave:**
  - **Administrador (`admin`):** Auditoría técnica, supervisión de salud del sistema y gestión global.
  - **Organizador (`organizer`):** Usuario principal. Control total de eventos, finanzas, tareas y contratos.
  - **Cliente (`client`):** Portal de consulta restringido. Visualiza avance, aprueba presupuestos e interactúa con su lista de invitados.
- **Notas para el Expositor:** "Adoptamos un modelo de tres roles estrictamente justificado. Esto evita accesos no autorizados y permite al cliente final auditar su evento sin interferir en los costos operativos del organizador."

---

### Diapositiva 6: Componentes Principales del MVP
- **Título:** Arquitectura Modular de Componentes (10 Módulos)
- **Elementos Visuales:** Diagrama de bloques hexagonales agrupados por área (Identidad, Operaciones, Finanzas).
- **Puntos Clave:**
  - **Identidad & Contactos:** Usuarios, Clientes, Proveedores.
  - **Núcleo del Evento:** Eventos, Lista de Invitados (RSVP), Agenda (Minuto a minuto).
  - **Finanzas & Contrataciones:** Catálogo de Servicios, Contrataciones, Gastos y Presupuesto.
  - **Seguimiento:** Tablero de Tareas y Dashboard Ejecutivo de KPIs.
- **Notas para el Expositor:** "El sistema se diseñó en 10 módulos cohesivos y desacoplados. Cada uno expone endpoints CRUD y métodos de dominio especializados."

---

### Diapositiva 7: Diagrama de Clases UML
- **Título:** Diseño del Dominio y Modelo Orientado a Objetos
- **Elementos Visuales:** Diagrama UML de clases (Mermaid exportado) destacando agregados y relaciones.
- **Puntos Clave:**
  - Agregado raíz: `Event` con relaciones de composición hacia `Guest`, `Expense`, `Task` y `AgendaItem`.
  - Relación asociativa N:M materializada: `EventService` uniendo `Event` y `Service` con precio pactado.
  - Separación entre atributos de persistencia y métodos de comportamiento.
- **Notas para el Expositor:** "Aquí observamos el diagrama de clases del dominio. Se aprecia la relación entre el evento, sus contrataciones y los gastos derivados, asegurando integridad referencial en todo momento."

---

### Diapositiva 8: Lógica de Negocio y Métodos Especializados
- **Título:** Más Allá del CRUD: Métodos y Reglas de Negocio Reales
- **Elementos Visuales:** Fórmulas matemáticas y diagramas de flujo de decisiones.
- **Puntos Clave:**
  - `calculateBudgetStatus()`: Balance disponible, porcentaje de ejecución y semáforo de sobrecosto (Verde/Amarillo/Rojo).
  - `confirmEvent()`: Validación estricta de fecha futura y cliente asociado.
  - `registerRsvp()` & `assignTable()`: Control algorítmico de aforo por mesa y acompañantes.
  - `detectTimelineConflicts()`: Detección automática de solapamiento horario en el itinerario.
- **Notas para el Expositor:** "La plataforma no es una simple libreta de notas. Implementa algoritmos de conciliación contable, detección de empalmes en la agenda y alertas proactivas antes de que ocurra un sobrecosto."

---

### Diapositiva 9: Stack Tecnológico
- **Título:** Stack Tecnológico: Enfoque Edge y TypeScript End-to-End
- **Elementos Visuales:** Logotipos de React, TypeScript, Vite, Hono, Cloudflare D1/R2, Drizzle, Vitest y Docker.
- **Puntos Clave:**
  - **Frontend:** React 18, TypeScript, Tailwind CSS (Cloudflare Pages).
  - **Backend API:** Cloudflare Workers, Hono Web Framework, Drizzle ORM.
  - **Datos & Storage:** Cloudflare D1 (SQLite distribuido), Cloudflare R2 (Object Storage).
  - **Calidad & DevOps:** Vitest, Docker, Docker Hub, GitHub Actions, Wrangler CLI.
- **Notas para el Expositor:** "Elegimos TypeScript de punta a punta. Eliminamos servidores tradicionales en favor de Cloudflare Workers y D1, logrando una arquitectura sin servidores que arranca en 0 milisegundos."

---

### Diapositiva 10: Arquitectura Lógica del Software
- **Título:** Arquitectura Lógica en Capas (Clean Architecture en el Edge)
- **Elementos Visuales:** Diagrama jerárquico de 6 capas: Usuario $\rightarrow$ Frontend (React SPA) $\rightarrow$ Cloudflare Edge (DNS/WAF/Routing) $\rightarrow$ API Gateway (Hono en Workers) $\rightarrow$ Capa de Servicios y Dominio (Casos de Uso y Puertos) $\rightarrow$ Persistencia y Almacenamiento (D1, R2, KV). Incluye homologación visual con los paquetes de íconos oficiales de **AWS Architecture Icons** y **Azure Architecture Icons** indicados en la rúbrica.
- **Puntos Clave:**
  - **Clean Architecture & Puertos y Adaptadores:** Desacoplamiento total entre las reglas de negocio y los servicios de Cloudflare.
  - **Inversión de Dependencias (DIP):** El núcleo de dominio define contratos (`IRepository`, `IFileStoragePort`); los adaptadores de D1 y R2 implementan la persistencia concreta.
  - **Homologación Académica:** Equivalencias visuales directas: Cloudflare Pages $\approx$ AWS Amplify / Azure Static Web Apps, Workers $\approx$ AWS Lambda / Azure Functions, D1 $\approx$ Aurora Serverless / Azure SQL, R2 $\approx$ Amazon S3 / Azure Blob Storage.
- **Notas para el Expositor:** "La arquitectura lógica está estructurada bajo Clean Architecture. Los servicios de negocio son independientes de la nube concreta, lo que nos permite tanto ejecutarlos en el Edge de Cloudflare con latencia mínima como homologar el diseño formalmente con los estándares de arquitectura de AWS y Azure requeridos por la cátedra."

---

### Diapositiva 11: Infraestructura Cloudflare
- **Título:** Recursos en la Nube y Declaración IaC (`wrangler.toml`)
- **Elementos Visuales:** Mapa conceptual de recursos: Pages, Workers, D1, R2 y KV con sus bindings.
- **Puntos Clave:**
  - **Bindings Nativos:** Cero sockets TCP manuales; inyección directa de `env.DB` y `env.STORAGE`.
  - **Cloudflare R2:** Almacenamiento S3 sin costos de transferencia (*zero egress fees*) para contratos y recibos.
  - **Cloudflare KV:** Lista negra de tokens JWT y control de tasa de peticiones.
- **Notas para el Expositor:** "La infraestructura se define como código mediante Wrangler. Los bindings nativos garantizan seguridad sin necesidad de exponer contraseñas de bases de datos en variables de texto plano."

---

### Diapositiva 12: Estrategia de CI/CD y Deployment
- **Título:** Pipeline de Integración y Despliegue Continuo
- **Elementos Visuales:** Diagrama de flujo de GitHub Actions con las 3 etapas principales.
- **Puntos Clave:**
  - **Etapa 1:** Linting, TypeScript Typecheck y Pruebas Unitarias con Vitest.
  - **Etapa 2:** Construcción multi-stage de imágenes Docker y publicación en Docker Hub.
  - **Etapa 3:** Migración remota de D1 y despliegue automatizado a Cloudflare Workers y Pages.
- **Notas para el Expositor:** "Cada commit a la rama principal dispara un pipeline automatizado. Si un test unitario falla, el despliegue se detiene automáticamente, garantizando cero regresiones en producción."

---

### Diapositiva 13: Estrategia Docker y Docker Hub
- **Título:** Contenedores Reproducibles y Publicación OCI
- **Elementos Visuales:** Diagrama de Docker multi-stage y captura conceptual de Docker Hub.
- **Puntos Clave:**
  - **Aclaración Clave:** Workers ejecuta V8 Isolates; Docker se emplea para reproducibilidad y portabilidad de compilación/tests.
  - **Multi-stage Builds:** Imágenes Alpine ultra optimizadas (<95 MB en API, <25 MB en Frontend con Nginx).
  - **Imágenes en Docker Hub:** `organizacion/planora-api` y `organizacion/planora-frontend` versionadas con tags SemVer y Git SHA.
- **Notas para el Expositor:** "Utilizamos Docker para estandarizar el entorno de construcción y testing. Las imágenes finales se publican automáticamente en Docker Hub como entregable formal de infraestructura."

---

### Diapositiva 14: Estrategia de Pruebas Unitarias (QA)
- **Título:** Aseguramiento de Calidad con Vitest
- **Elementos Visuales:** Tabla de cobertura y ejemplos de assertions de pruebas unitarias.
- **Puntos Clave:**
  - **Meta de Cobertura:** $\ge 85\%$ en capa de dominio y métodos de negocio.
  - **Suites implementadas:**
    - `calculateBudgetStatus`: Escenarios verde, amarillo, rojo (sobrecosto) y valores frontera.
    - `EventLifecycle`: Validación de fechas retroactivas y avance de estado.
    - `AgendaConflict`: Verificación de solapamiento de horarios.
- **Notas para el Expositor:** "Nuestra estrategia de testing se concentró en la lógica de dominio. No probamos simples getters; probamos las reglas matemáticas y de negocio que protegen la integridad del evento."

---

### Diapositiva 15: Estrategia de Ramas Git
- **Título:** Flujo de Trabajo Git Adaptado y Conventional Commits
- **Elementos Visuales:** Diagrama de ramas gitGraph (`main`, `develop`, `feature/*`, `fix/*`, `hotfix/*`).
- **Puntos Clave:**
  - Dos ramas troncales protegidas: `main` (producción) y `develop` (integración).
  - Ramas de trabajo nombradas por Issue: `feature/10-event-engine`, `fix/22-rsvp-bug`.
  - Commits estandarizados con Conventional Commits (`feat:`, `fix:`, `test:`, `ci:`).
  - Políticas de Branch Protection: CI en verde obligatorio para aprobar Pull Requests.
- **Notas para el Expositor:** "Adoptamos un modelo Git Flow adaptado que aporta orden estricto de ingeniería sin burocracia innecesaria para un proyecto individual."

---

### Diapositiva 16: Gestión del Proyecto con GitHub Project Board
- **Título:** Tablero de Control y Seguimiento Kanban
- **Elementos Visuales:** Representación gráfica de las 6 columnas del Project Board (`BACKLOG` a `DONE`).
- **Puntos Clave:**
  - 6 Columnas de flujo continuo: BACKLOG $\rightarrow$ TODO $\rightarrow$ IN PROGRESS $\rightarrow$ REVIEW $\rightarrow$ TESTING $\rightarrow$ DONE.
  - 23 Issues atómicos completamente detallados con criterios de aceptación verificables.
  - Trazabilidad total entre tareas del tablero, ramas de Git y Pull Requests.
- **Notas para el Expositor:** "El tablero de GitHub Projects refleja el avance real. Cada tarjeta representa un Issue con criterios de aceptación claros, vinculada directamente a su rama y Pull Request."

---

### Diapositiva 17: Plan de Trabajo y Cronograma
- **Título:** Fases de Ingeniería y Cumplimiento de Milestones
- **Elementos Visuales:** Diagrama de Gantt mostrando las 9 fases del proyecto desde Análisis hasta Entrega.
- **Puntos Clave:**
  - 9 Fases secuenciales de desarrollo y 10 Milestones estructurados.
  - Desde el modelado inicial en D1 hasta el despliegue productivo y la documentación final.
  - Cumplimiento estricto del alcance sin sobrecostos de tiempo.
- **Notas para el Expositor:** "El plan de trabajo estructurado en 9 fases permitió avanzar de manera metódica, asegurando que cada componente contara con su arquitectura, pruebas y automatización antes de pasar a la siguiente etapa."

---

### Diapositiva 18: Conclusiones y Demostración
- **Título:** Conclusiones y Demostración Técnica
- **Elementos Visuales:** Resumen de logros cuantitativos (0ms cold start, 85% coverage, CI/CD automatizado).
- **Puntos Clave:**
  - **Logro de Negocio:** Una plataforma integral que resuelve la fragmentación operativa y el descontrol financiero en eventos.
  - **Logro de Infraestructura:** Adopción exitosa de tecnologías Edge Serverless (Cloudflare) con automatización total en GitHub Actions y Docker Hub.
  - **Viabilidad y Mantenibilidad:** Arquitectura limpia y ligera, ejecutable por un solo desarrollador y con costo operativo prácticamente nulo.
  - *Preguntas y Respuestas.*
- **Notas para el Expositor:** "Planora demuestra que es posible construir una plataforma profesional, de alto rendimiento y bajo costo operativo utilizando las mejores prácticas de la ingeniería de software y la infraestructura continua. Muchas gracias, quedo atento a sus preguntas."
