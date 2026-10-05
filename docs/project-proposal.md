# Planora — Propuesta de Proyecto de Grado / Proyecto Final

**Asignatura:** Infraestructura para el Desarrollo Continuo (9º Semestre)  
**Proyecto:** Plataforma Web para la Gestión Profesional de Eventos  
**Nombre Oficial Seleccionado:** **Planora** (*Plataforma Integral de Gestión y Control Operativo para Organizadores de Eventos*)  
**Estado:** Documento de Especificación de Requisitos y Propuesta Técnica  

---

## 1. Evaluación y Selección del Nombre del Proyecto

Se evaluaron 8 alternativas de nombres profesionales, memorables y con alto potencial de posicionamiento en el ecosistema SaaS de eventos:

| # | Nombre Propuesto | Significado Etimológico / Conceptual | Por qué Funciona | Ventaja para Branding |
|---|------------------|--------------------------------------|------------------|-----------------------|
| 1 | **Planora** *(Recomendado)* | Fusión de *Planning* (planificación rigurosa) y *Aura* (la esencia y distinción única de cada celebración). | Es sonoro, corto (3 sílabas), fácil de pronunciar tanto en español como en inglés, y evoca orden sin perder elegancia. | Nombre limpio, registrable como dominio y marca SaaS. Transmite serenidad y control en un nicho caracterizado por el estrés operativo. |
| 2 | **Eventis** | Unión de *Event* y el sufijo latino *-is* (orden y ciudad/organización). | Muy directo, técnico y conciso. | Excelente para productos orientados a la productividad pura y dashboards limpios. |
| 3 | **VowFlow** | Fusión de *Vow* (voto/compromiso) y *Workflow* (flujo de trabajo). | Excelente metáfora de flujo continuo para eventos solemnes y sociales. | Fuerte en el segmento nupcial y social, aunque algo encasillado para eventos corporativos. |
| 4 | **OpusEvent** | Derivado del latín *Opus* (obra maestra, trabajo de autor) y *Event*. | Comunica que cada evento orquestado es una obra maestra de logística. | Posicionamiento prémium y corporativo para agencias que atienden cuentas VIP. |
| 5 | **AuraPlanner** | Combinación explícita de *Aura* y *Planner*. | Claridad inmediata sobre la función del sistema y el perfil de usuario. | Muy descriptivo, aunque menos distintivo como producto de software independiente. |
| 6 | **Caelum Events** | *Caelum* (latín para cielo o espacio abierto). | Aspiracional, refinado y poético. | Atractivo para diseñadores de eventos de lujo, pero menos representativo de un software de gestión operativa. |
| 7 | **SynchroEvent** | Derivado de sincronización y eventos. | Enfatiza la coordinación milimétrica del cronograma y proveedores. | Altamente técnico; comunica precisión logística y cero contratiempos. |
| 8 | **NexusEvent** | *Nexus* (punto de convergencia o núcleo central). | Representa la centralización de presupuestos, clientes y agenda en un único punto. | Resalta la propuesta de valor de integración omnicanal. |

### Selección y Justificación del Nombre Oficial: **Planora**
Se selecciona formalmente **Planora**. El nombre proyecta sofisticación, calma y orden metódico. Al no utilizar términos excesivamente nupciales (como *bride* o *vow*), permite abarcar holísticamente:
- Bodas y XV años.
- Aniversarios y graduaciones.
- Conferencias y eventos corporativos.
- Convenciones y galas sociales.

Su lema operativo es: **"Planora: Tu centro de control operativo para eventos extraordinarios."**

---

## 2. Contexto de Negocio y Problemática Identificada

### 2.1 Hallazgos de Exploración Inicial
Como parte de una exploración inicial con una persona con experiencia práctica en la organización profesional de eventos, se identificaron los puntos de dolor y dificultades más desgastantes en la operativa real de un evento (bodas, XV años, aniversarios y reuniones corporativas):

1. **Gestión de Invitados y Conteo de Asistentes:** Dificultad para mantener un conteo exacto de personas confirmadas, declinadas y acompañantes (+1s), lo que impacta de forma directa en el costo por cubierto del banquete.
2. **Distribución y Aforo de Mesas:** Complejidad logística al distribuir físicamente a los asistentes en las mesas del salón respetando límites de capacidad y afinidades familiares/sociales.
3. **Alimentación y Asignación de Menús:** Dificultad para saber con exactitud qué tipo de platillo (menú estándar, menú infantil, vegetariano, vegano, kosher) corresponde a cada comensal sentado en cada mesa.
4. **Alergias y Restricciones Médicas Críticas:** Alto riesgo de incidentes de salud al no contar con un registro riguroso de alergias severas (mariscos, cacahuates, gluten/celiaquía, lactosa) que debe comunicarse con absoluta precisión al equipo de cocina/catering para evitar contaminación cruzada.
5. **Gestión de Bebidas:** Complejidad para calcular y prever las cantidades e insumos requeridos (barra libre, tipos de destilados, refrescos, descorche) sin incurrir en desabasto o sobrecompras.
6. **Logística de Transporte:** Retos al coordinar el traslado de invitados o comitivas (itinerarios, horarios, vehículos y listas de pasajeros) cuando el propio organizador debe gestionarlo.
7. **Dispersión de Información (Hipótesis Inicial):** Actualmente se tiene como hipótesis de trabajo que estos procesos suelen coordinarse mediante herramientas separadas (hojas de cálculo en Excel, conversaciones de WhatsApp y notas dispersas en Google Drive), lo que genera pérdida de sincronización y alta fricción operativa.

### 2.2 Justificación de la Solución Centralizada
La concurrencia de estas problemáticas demuestra que los aspectos logísticos más críticos comparten un sujeto común: **el asistente al evento**. Centralizar en una plataforma web la relación entre invitados, mesas, menús, alergias, cronogramas y presupuesto permite al organizador mitigar riesgos humanos, eliminar la duplicación de datos y brindar reportes consolidados inmediatos tanto al cliente como al proveedor del banquete. Desplegar esta solución sobre la infraestructura Serverless de Cloudflare (Pages, Workers, D1, R2 y KV) garantiza acceso móvil ultra veloz y disponibilidad garantizada durante el evento sin costos de infraestructura pesada.

---

## 3. Objetivos del Proyecto

### 3.1 Objetivo General
Diseñar, arquitectar, implementar y desplegar una plataforma web integral (*Planora*) que permita a organizadores profesionales centralizar la gestión de clientes, presupuestos, servicios de proveedores, listas de invitados, cronogramas y tareas operativas, respaldada por una infraestructura de desarrollo continuo automatizada mediante GitHub Actions, Docker Hub y el ecosistema Cloudflare.

### 3.2 Objetivos Específicos
1. **Modelar una base de datos relacional normalizada** en Cloudflare D1 (SQLite) que relacione de forma íntegra clientes, eventos, contrataciones de proveedores, control de gastos, invitados y tareas.
2. **Desarrollar una API RESTful modular y tipada de alto rendimiento** utilizando Cloudflare Workers y el microframework Hono, garantizando tiempos de respuesta inferiores a 100 ms en el Edge.
3. **Construir una interfaz de usuario moderna, reactiva e intuitiva** con React, TypeScript y Tailwind CSS, desplegada sobre Cloudflare Pages.
4. **Implementar un motor de lógica de negocio** para la conciliación presupuestaria en tiempo real, alertas de sobrecosto, confirmación de RSVP de invitados y avance porcentual del evento.
5. **Establecer un pipeline de Integración y Despliegue Continuo (CI/CD)** en GitHub Actions que ejecute pruebas unitarias con Vitest, construya imágenes reproducibles de Docker para Docker Hub y automatice el despliegue a Cloudflare mediante Wrangler.

---

## 4. Usuarios Objetivo y Roles

### 4.1 Definición de Usuarios Objetivo
- **Organizadores Independientes / Wedding Planners:** Coordinadores que gestionan de 3 a 15 eventos en paralelo y necesitan control financiero y de cronograma estricto.
- **Agencias de Eventos Sociales y Corporativos:** Pequeñas y medianas agencias que requieren estandarizar tareas y contratos con proveedores.
- **Clientes del Evento (Novios, Festejados o Comités Corporativos):** Usuarios finales que demandan transparencia en el avance de su celebración sin interactuar con los detalles internos de costos del organizador.

### 4.2 Sistema de Roles del MVP

Para mantener el proyecto viable para un desarrollo universitario individual y a la vez profesional, se definen estrictamente tres roles:

1. **Administrador (`admin`):** Administrador de la plataforma técnica. Gestiona el alta de organizadores, audita la salud del sistema y supervisa el uso de almacenamiento.
2. **Organizador (`organizer`):** Usuario principal de la plataforma. Crea eventos, gestiona clientes, presupuestos, proveedores, tareas, minutas y cronogramas.
3. **Cliente (`client`):** Acceso de portal restringido (modo consulta y confirmación). Puede consultar el estado general de su evento, visualizar el cronograma del día, confirmar/revisar su lista de invitados y descargar contratos autorizados.

#### Matriz de Roles y Permisos (RBAC)

| Módulo / Funcionalidad | Administrador (`admin`) | Organizador (`organizer`) | Cliente (`client`) |
|------------------------|:-----------------------:|:-------------------------:|:------------------:|
| Gestión de Cuentas de Organizador | ✅ Total | ❌ No permitido | ❌ No permitido |
| Creación / Edición de Eventos | 👁️ Auditoría | ✅ Total (sus eventos) | ❌ Solo lectura de su evento |
| Gestión de Clientes | 👁️ Auditoría | ✅ Total | 👁️ Solo su propio perfil |
| Lista de Invitados & Asignación de Mesas | ❌ No aplica | ✅ Total | ✏️ Consultar y actualizar RSVP |
| Catálogo de Proveedores & Servicios | 👁️ Auditoría | ✅ Total | ❌ No permitido |
| Contratación de Servicios (`event_services`) | ❌ No aplica | ✅ Total | 👁️ Ver servicios contratados |
| Registro de Gastos & Conciliación Presupuestaria | ❌ No aplica | ✅ Total | 👁️ Ver resumen macro aprobado |
| Alertas de Desviación Financiera | ❌ No aplica | ✅ Total | ❌ No permitido |
| Asignación y Ejecución de Tareas | ❌ No aplica | ✅ Total | 👁️ Ver tareas asignadas a cliente |
| Cronograma Minuto a Minuto (`agenda_items`) | ❌ No aplica | ✅ Total | 👁️ Consultar itinerario |
| Carga de Documentos/Recibos a R2 | 👁️ Auditoría | ✅ Total | 👁️ Descargar documentos finales |
| Dashboard Ejecutivo y Métricas | ✅ Métricas globales | ✅ Métricas de sus eventos | 👁️ Resumen de su evento |

---

## 5. Alcance del Proyecto: Delimitación del MVP vs. Funcionalidades Futuras

### 5.1 En el Alcance (MVP Esencial y Realizable)
El MVP se concentra en resolver la centralización del evento y los puntos de dolor de mayor correlación operativa (Núcleo de Invitados, Mesas, Alimentación, Alergias, Finanzas y Cronograma):
- Autenticación segura y control de acceso por roles (`admin`, `organizer`, `client`).
- Ciclo de vida y gestión integral de eventos (`draft` $\rightarrow$ `confirmed` $\rightarrow$ `completed`).
- **Gestión Avanzada de Invitados y Mesas:** Control riguroso de asistencia (RSVP), acompañantes (+1s), aforo y asignación de mesas físicas.
- **Asignación Gastronómica y Alertas de Alergias:** Registro del tipo de menú asignado por persona (regular, vegetariano, vegano, infantil, celíaco) y catálogo de alergias severas con emisión del **Reporte Oficial para Catering**.
- **Control Presupuestario y Conciliación:** Presupuesto inicial, gastos registrados, alertas preventivas de semáforo (Verde, Amarillo, Rojo) y carga de comprobantes en Cloudflare R2.
- **Gestión Básica de Bebidas y Transporte:** Se cubren dentro del flujo natural del evento como servicios contratados a proveedores (`event_services`), partidas de gastos y bloques de itinerario en la agenda.
- **Directorio de Proveedores y Servicios Contratados** con archivo de contratos PDF en Cloudflare R2.
- **Tablero de Tareas y Cronograma Minuto a Minuto** con detección de solapamientos horarios.
- Pruebas unitarias en Vitest ($\ge 85\%$ de cobertura en dominio) y automatización CI/CD con GitHub Actions y Docker Hub.

### 5.2 Fuera del Alcance (Funcionalidades Futuras — Post-MVP)
Para proteger la viabilidad de un proyecto universitario individual, se difieren formalmente las siguientes funcionalidades de alta complejidad:
1. **Módulo de Logística de Flotas y Rutas de Transporte en Tiempo Real:** Asignación granular de asientos en microbuses/vans, seguimiento GPS de unidades vehiculares y generación de pases de abordar QR para traslados.
2. **Calculadora Algorítmica de Consumo de Bebidas e Inventario:** Estimador predictivo de botellas por persona según duración del evento y control de merma/descorche en almacén durante la fiesta.
3. **Pasarelas de Pago Bancario en Vivo:** Cobro de boletos mediante tarjeta de crédito (Stripe/Mercado Pago) para eventos masivos (se mantiene el registro contable de pagos).
4. **Aplicación Móvil Nativa (iOS/Android):** El MVP es una Single Page Application 100% responsiva para navegadores móviles.

---

## 6. Especificación de Componentes del MVP y Lógica de Negocio

El sistema está estructurado en 10 componentes modulares. Cada componente cuenta con sus operaciones de persistencia (CRUD) y sus métodos de negocio con lógica de dominio real:

### 1. Componente de Usuarios (`UserComponent`)
- **Propósito:** Gestión de identidad, credenciales y roles del sistema.
- **Datos Principales:** `id`, `name`, `email`, `password_hash`, `role`, `phone`, `timestamps`.
- **Relaciones:** 1:N con Clientes, 1:N con Eventos (como organizador), 1:N con Proveedores.
- **CRUD:** `createUser()`, `getUserById()`, `updateUser()`, `deleteUser()`.
- **Métodos de Negocio:**
  - `authenticate(email, password)`: Valida credenciales, comprueba estado activo y genera token JWT firmado con expiración.
  - `changePassword(userId, oldPassword, newPassword)`: Valida robustez de contraseña y actualiza el hash seguro.
  - `deactivateUser(userId)`: Suspende accesos de forma lógica preservando la integridad referencial histórica.
- **Reglas y Validaciones:** Formato de correo RFC 5322 único en la base de datos; contraseñas de al menos 8 caracteres con mayúscula, número y símbolo.

### 2. Componente de Clientes (`ClientComponent`)
- **Propósito:** Registro y administración de los anfitriones o empresas contratantes del evento.
- **Datos Principales:** `id`, `organizer_id`, `user_id` (opcional para portal), `first_name`, `last_name`, `email`, `phone`, `notes`.
- **Relaciones:** N:1 con Organizador; 1:1 opcional con Usuario; 1:N con Eventos.
- **CRUD:** `createClient()`, `getClientById()`, `getClientsByOrganizer()`, `updateClient()`, `deleteClient()`.
- **Métodos de Negocio:**
  - `linkUserAccount(clientId, userId)`: Vincula el expediente del cliente con su cuenta de acceso al portal web.
  - `getClientHistorySummary(clientId)`: Retorna el historial consolidado de eventos pasados y activos del cliente con su volumen financiero total contratado.
- **Reglas y Validaciones:** Nombre y teléfono obligatorios; no se puede eliminar un cliente que posea eventos en estado `in_progress` o `planning`.

### 3. Componente de Eventos (`EventComponent`)
- **Propósito:** Núcleo operativo del sistema. Modela la celebración o reunión en todas sus fases.
- **Datos Principales:** `id`, `organizer_id`, `client_id`, `title`, `event_type`, `status`, `event_date`, `venue_name`, `venue_address`, `initial_budget`, `estimated_guests`.
- **Relaciones:** N:1 con Organizador; N:1 con Cliente; 1:N con Invitados, Tareas, Gastos, Servicios Contratados y Agenda.
- **CRUD:** `createEvent()`, `getEventById()`, `listEvents()`, `updateEvent()`, `deleteEvent()`.
- **Métodos de Negocio:**
  - `confirmEvent(eventId)`: Cambia el estado a `confirmed` tras verificar que la fecha es futura, el presupuesto inicial es mayor a 0 y existe un cliente asociado.
  - `cancelEvent(eventId, reason)`: Realiza una cancelación en cascada lógica: marca el evento como `cancelled`, cancela las tareas pendientes y congela la agenda.
  - `calculateEventProgress(eventId)`: Calcula el porcentaje de avance ponderado del evento basado en tareas completadas y servicios liquidados.
  - `cloneEventStructure(sourceEventId, newTitle, newDate)`: Permite clonar un evento previo sirviendo como plantilla para tareas típicas y cronograma base sin duplicar gastos ni clientes.
- **Reglas y Validaciones:** La fecha del evento debe ser estrictamente posterior a la fecha de creación; el `initial_budget` no puede ser negativo.

### 4. Componente de Invitados y Gastronomía (`GuestComponent`)
- **Propósito:** Administración de asistentes, confirmaciones (RSVP), aforo de mesas, asignación de menús y control crítico de alergias.
- **Datos Principales:** `id`, `event_id`, `first_name`, `last_name`, `email`, `phone`, `table_number`, `rsvp_status`, `plus_ones`, `meal_preference`, `allergies`, `dietary_restrictions`.
- **Relaciones:** N:1 con Evento.
- **CRUD:** `addGuest()`, `getGuestById()`, `listGuestsByEvent()`, `updateGuest()`, `removeGuest()`.
- **Métodos de Negocio:**
  - `registerRsvp(guestId, status, confirmedPlusOnes)`: Actualiza la asistencia (`confirmed`, `declined`, `pending`) y valida que los acompañantes no superen el límite permitido.
  - `assignTable(guestId, tableNumber, maxCapacityPerTable)`: Valida algorítmicamente la capacidad física de la mesa antes de asignar al invitado y a sus acompañantes para evitar sobrecupo.
  - `registerDietaryProfile(guestId, mealPreference, allergies, restrictions)`: Asigna el menú específico (estándar, vegetariano, vegano, infantil, celíaco) y cataloga alergias alimentarias.
  - `generateCateringDietaryReport(eventId)`: Genera un consolidado estructurado para el banquetero/chef que desglosa: (a) raciones totales por tipo de menú, (b) distribución de platillos por mesa, y (c) alertas rojas de alergias severas geolocalizadas por número de asiento y mesa para prevenir contaminación cruzada.
  - `calculateRsvpMetrics(eventId)`: Retorna total de invitados invitados, confirmados, declinados, porcentaje de confirmación y total de raciones requeridas.
- **Reglas y Validaciones:** `plus_ones` debe ser entero $\ge 0$; `meal_preference` debe pertenecer a una enumeración válida; si `allergies` no está vacío, el comensal se marca con una bandera de atención especial en el reporte.

### 5. Componente de Proveedores (`VendorComponent`)
- **Propósito:** Directorio y evaluación de empresas externas prestadoras de servicios para eventos.
- **Datos Principales:** `id`, `organizer_id`, `business_name`, `category`, `contact_name`, `email`, `phone`, `rating`.
- **Relaciones:** N:1 con Organizador; 1:N con Catálogo de Servicios.
- **CRUD:** `createVendor()`, `getVendorById()`, `listVendors()`, `updateVendor()`, `deleteVendor()`.
- **Métodos de Negocio:**
  - `updateRating(vendorId, newRating)`: Actualiza la calificación promedio del proveedor (escala de 1 a 5) basada en el desempeño de eventos concluidos.
  - `getVendorServiceSummary(vendorId)`: Lista los servicios ofrecidos junto con el volumen histórico de eventos en los que ha participado con el organizador.
- **Reglas y Validaciones:** Correo y teléfono válidos; la categoría debe pertenecer a una enumeración controlada.

### 6. Componente de Servicios y Contrataciones (`ServiceComponent` & `EventServiceComponent`)
- **Propósito:** Catálogo de servicios por proveedor y su vinculación formal con un evento específico.
- **Datos Principales:**
  - Catálogo: `id`, `vendor_id`, `name`, `description`, `base_price`.
  - Contratación: `id`, `event_id`, `service_id`, `agreed_price`, `status`, `contract_url`, `notes`.
- **Relaciones:** Servicio pertenece a Proveedor (N:1); Contratación une Evento con Servicio (N:M materializada).
- **CRUD:** `createService()`, `contractService()`, `getContractedServices()`, `updateContractedService()`, `cancelContractedService()`.
- **Métodos de Negocio:**
  - `attachContractDocument(contractId, fileKey)`: Almacena la referencia segura en Cloudflare R2 del contrato firmado.
  - `generateExpenseFromContract(contractId)`: Crea automáticamente el registro en el componente de gastos con estado `pending` por el monto acordado.
- **Reglas y Validaciones:** El precio pactado (`agreed_price`) debe ser mayor a 0; no se puede contratar un servicio si el proveedor no está activo.

### 7. Componente de Presupuesto y Gastos (`BudgetComponent` / `ExpenseComponent`)
- **Propósito:** Control financiero exhaustivo del evento, pagos efectuados y balance presupuestario.
- **Datos Principales:** `id`, `event_id`, `event_service_id` (opcional), `concept`, `category`, `amount`, `due_date`, `payment_status`, `receipt_url`, `paid_at`.
- **Relaciones:** N:1 con Evento; N:1 opcional con Contratación de Servicio.
- **CRUD:** `recordExpense()`, `getExpenseById()`, `listExpensesByEvent()`, `updateExpense()`, `deleteExpense()`.
- **Métodos de Negocio:**
  - `calculateBudgetStatus(eventId)`: Computa:
    $$\text{Presupuesto Inicial} - \sum \text{Gastos Registrados} = \text{Balance Disponible}$$
    Calcula porcentaje de ejecución financiera y monto pendiente de liquidación.
  - `checkBudgetOverrunAlert(eventId)`: Evalúa si los gastos superan el 90% o el 100% del presupuesto inicial y retorna el nivel de semáforo (`green`, `yellow`, `red`).
  - `registerPayment(expenseId, receiptKey)`: Transiciona el estado del gasto a `paid`, sella la fecha actual `paid_at` y vincula el comprobante digital en R2.
- **Reglas y Validaciones:** Monto (`amount`) estrictamente positivo; una eliminación de gasto recalcula de inmediato el balance del evento.

### 8. Componente de Tareas (`TaskComponent`)
- **Propósito:** Matriz operativa de actividades pendientes con plazos de entrega y responsables.
- **Datos Principales:** `id`, `event_id`, `title`, `description`, `assigned_to`, `priority`, `status`, `due_date`, `completed_at`.
- **Relaciones:** N:1 con Evento; N:1 con Usuario asignado.
- **CRUD:** `createTask()`, `getTaskById()`, `listTasksByEvent()`, `updateTask()`, `deleteTask()`.
- **Métodos de Negocio:**
  - `completeTask(taskId)`: Cambia el estado a `completed`, graba la marca de tiempo `completed_at` y notifica al evento para recalcular el porcentaje de progreso.
  - `getOverdueTasks(eventId)`: Identifica aquellas tareas en estado `todo` o `in_progress` cuya fecha límite es anterior a la fecha actual.
  - `reassignTask(taskId, newUserId)`: Cambia el responsable operativo y registra la trazabilidad del cambio.
- **Reglas y Validaciones:** La fecha límite de la tarea no puede ser posterior a la fecha de finalización del evento.

### 9. Componente de Agenda y Cronograma (`AgendaComponent`)
- **Propósito:** Coordinación del "minuto a minuto" o itinerario de ejecución durante el día del evento.
- **Datos Principales:** `id`, `event_id`, `title`, `start_time`, `end_time`, `responsible_person`, `location_detail`, `notes`, `order_index`.
- **Relaciones:** N:1 con Evento.
- **CRUD:** `addAgendaItem()`, `getAgendaItemById()`, `listAgendaByEvent()`, `updateAgendaItem()`, `deleteAgendaItem()`.
- **Métodos de Negocio:**
  - `reorderTimeline(eventId, orderedItemIds)`: Recalcula y persiste el índice de ordenamiento secuencial (`order_index`) de los bloques horarios.
  - `detectTimeConflicts(eventId)`: Evalúa el conjunto de bloques y advierte sobre solapamientos horarios en la misma locación o con el mismo responsable.
  - `getFormattedItinerary(eventId)`: Genera el itinerario estructurado listo para exportación o consulta móvil por proveedores.
- **Reglas y Validaciones:** `start_time` debe ser anterior o igual a `end_time`.

### 10. Componente de Dashboard y Resumen Ejecutivo (`DashboardComponent`)
- **Propósito:** Consolidación de indicadores clave de rendimiento (KPIs) operativos y financieros para el organizador.
- **Datos Principales:** Agregaciones calculadas en memoria y consultas SQL optimizadas de D1.
- **CRUD:** No es un CRUD convencional; es un componente de consulta analítica y agregación.
- **Métodos de Negocio:**
  - `getOrganizerOverview(organizerId)`: Agrega total de eventos activos, clientes atendidos, volumen financiero administrado y tareas críticas próximas a vencer.
  - `getEventDeepSummary(eventId)`: Reúne en una sola respuesta atómica: balance presupuestario, confirmaciones de asistencia, tareas pendientes y los próximos 3 hitos de la agenda.
- **Reglas y Validaciones:** Las consultas se ejecutan con índices adecuados sobre `organizer_id` y `event_id` para garantizar tiempos de respuesta inferiores a 50 ms.
