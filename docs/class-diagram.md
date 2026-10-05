# Diagrama de Clases UML — Planora

Este documento presenta el diseño orientado a objetos del dominio de **Planora**. El modelo refleja fielmente la lógica de negocio, las operaciones de persistencia (CRUD) y los métodos especializados requeridos para la gestión profesional de eventos.

---

## 1. Diagrama de Clases Completo (Mermaid UML)

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
    'classText': '#0f172a'
  }
}}%%
classDiagram
    direction TB

    class User {
        +string id
        +string name
        +string email
        +string passwordHash
        +UserRole role
        +string phone
        +DateTime createdAt
        +DateTime updatedAt
        +create(userData: CreateUserDTO): User
        +getById(userId: string): User
        +update(userId: string, data: UpdateUserDTO): User
        +delete(userId: string): boolean
        +authenticate(password: string): AuthToken
        +changePassword(oldPass: string, newPass: string): boolean
        +deactivate(): void
    }

    class Client {
        +string id
        +string organizerId
        +string userId
        +string firstName
        +string lastName
        +string email
        +string phone
        +string notes
        +DateTime createdAt
        +DateTime updatedAt
        +create(clientData: CreateClientDTO): Client
        +getById(clientId: string): Client
        +update(clientId: string, data: UpdateClientDTO): Client
        +delete(clientId: string): boolean
        +linkUserAccount(userId: string): void
        +getClientHistorySummary(): ClientSummaryVO
    }

    class Event {
        +string id
        +string organizerId
        +string clientId
        +string title
        +EventType eventType
        +EventStatus status
        +Date eventDate
        +string venueName
        +string venueAddress
        +number initialBudget
        +number estimatedGuests
        +DateTime createdAt
        +DateTime updatedAt
        +create(data: CreateEventDTO): Event
        +getById(eventId: string): Event
        +update(eventId: string, data: UpdateEventDTO): Event
        +delete(eventId: string): boolean
        +confirmEvent(): boolean
        +cancelEvent(reason: string): void
        +calculateBudget(): BudgetSummaryVO
        +calculateProgress(): number
        +cloneStructure(newTitle: string, newDate: Date): Event
        +getEventSummary(): EventDashboardVO
        +generateCateringReport(): CateringReportVO
    }

    class Guest {
        +string id
        +string eventId
        +string firstName
        +string lastName
        +string email
        +string phone
        +number tableNumber
        +RsvpStatus rsvpStatus
        +number plusOnes
        +MealPreference mealPreference
        +string allergies
        +string dietaryRestrictions
        +DateTime createdAt
        +DateTime updatedAt
        +create(guestData: CreateGuestDTO): Guest
        +getById(guestId: string): Guest
        +update(guestId: string, data: UpdateGuestDTO): Guest
        +delete(guestId: string): boolean
        +registerRsvp(status: RsvpStatus, plusOnes: number): boolean
        +assignTable(tableNum: number, maxCapacity: number): boolean
        +registerDietaryProfile(mealPref: MealPreference, allergies: string, notes: string): void
        +hasCriticalAllergies(): boolean
    }

    class Vendor {
        +string id
        +string organizerId
        +string businessName
        +VendorCategory category
        +string contactName
        +string email
        +string phone
        +number rating
        +DateTime createdAt
        +DateTime updatedAt
        +create(vendorData: CreateVendorDTO): Vendor
        +getById(vendorId: string): Vendor
        +update(vendorId: string, data: UpdateVendorDTO): Vendor
        +delete(vendorId: string): boolean
        +updateRating(newRating: number): void
        +getPerformanceMetrics(): VendorMetricsVO
    }

    class Service {
        +string id
        +string vendorId
        +string name
        +string description
        +number basePrice
        +DateTime createdAt
        +DateTime updatedAt
        +create(serviceData: CreateServiceDTO): Service
        +getById(serviceId: string): Service
        +update(serviceId: string, data: UpdateServiceDTO): Service
        +delete(serviceId: string): boolean
    }

    class EventService {
        +string id
        +string eventId
        +string serviceId
        +number agreedPrice
        +ContractStatus status
        +string contractUrl
        +string notes
        +DateTime createdAt
        +DateTime updatedAt
        +contract(data: ContractServiceDTO): EventService
        +getById(contractId: string): EventService
        +update(contractId: string, data: UpdateContractDTO): EventService
        +cancelContract(): boolean
        +attachContractDocument(r2Key: string): void
        +generateExpense(): Expense
    }

    class Expense {
        +string id
        +string eventId
        +string eventServiceId
        +string concept
        +ExpenseCategory category
        +number amount
        +Date dueDate
        +PaymentStatus paymentStatus
        +string receiptUrl
        +DateTime paidAt
        +DateTime createdAt
        +DateTime updatedAt
        +create(expenseData: CreateExpenseDTO): Expense
        +getById(expenseId: string): Expense
        +update(expenseId: string, data: UpdateExpenseDTO): Expense
        +delete(expenseId: string): boolean
        +registerPayment(receiptR2Key: string): void
        +isOverdue(): boolean
    }

    class Task {
        +string id
        +string eventId
        +string assignedTo
        +string title
        +string description
        +TaskPriority priority
        +TaskStatus status
        +Date dueDate
        +DateTime completedAt
        +DateTime createdAt
        +DateTime updatedAt
        +create(taskData: CreateTaskDTO): Task
        +getById(taskId: string): Task
        +update(taskId: string, data: UpdateTaskDTO): Task
        +delete(taskId: string): boolean
        +completeTask(): void
        +reassign(newUserId: string): void
        +isOverdue(): boolean
    }

    class AgendaItem {
        +string id
        +string eventId
        +string title
        +string startTime
        +string endTime
        +string responsiblePerson
        +string locationDetail
        +string notes
        +number orderIndex
        +DateTime createdAt
        +DateTime updatedAt
        +create(data: CreateAgendaItemDTO): AgendaItem
        +getById(itemId: string): AgendaItem
        +update(itemId: string, data: UpdateAgendaItemDTO): AgendaItem
        +delete(itemId: string): boolean
        +reposition(newOrderIndex: number): void
        +hasTimeConflict(other: AgendaItem): boolean
    }

    %% Relaciones y Cardinalidades
    User "1" --> "0..*" Client : "administra"
    User "1" --> "0..*" Event : "coordina (organizer)"
    User "1" --> "0..*" Vendor : "registra"
    User "1" <-- "0..*" Task : "asignado a"

    Client "1" --> "0..*" Event : "contrata"
    Client "0..1" --> "0..1" User : "acceso portal"

    Event "1" *-- "0..*" Guest : "compuesto por"
    Event "1" *-- "0..*" Expense : "acumula"
    Event "1" *-- "0..*" Task : "contiene"
    Event "1" *-- "0..*" AgendaItem : "itinerario"
    Event "1" *-- "0..*" EventService : "servicios contratados"

    Vendor "1" *-- "1..*" Service : "ofrece"
    Service "1" <-- "0..*" EventService : "referencia a"
    EventService "0..1" <-- "0..*" Expense : "vinculado a pago"
```

---

## 2. Explicación de Clases y Métodos de Negocio

El modelo de clases no se limita a operaciones de acceso a datos (*Active Record* o getters/setters pasivos); encapsula la lógica medular del negocio conforme a los principios de diseño de software orientado a objetos y *Domain-Driven Design (DDD)*:

### 2.1 Clase `Event`
- **Responsabilidad Central:** Es el agregado raíz (*Aggregate Root*) de la gestión operativa.
- **Métodos de Negocio Destacados:**
  - `confirmEvent()`: Evalúa que existan condiciones mínimas (cliente asignado, fecha en el futuro y presupuesto base registrado) para avanzar el estado a `confirmed`.
  - `cancelEvent(reason)`: Ejecuta una desactivación ordenada; suspende tareas activas y marca contrataciones de servicios pendientes en estado `cancelled`.
  - `calculateBudget()`: Invoca la suma agregada de la colección de `Expense` para emitir un objeto inmutable de valor (`BudgetSummaryVO`) con presupuesto asignado, gastado, comprometido y disponible.
  - `calculateProgress()`: Retorna un porcentaje numérico del 0 al 100 calculado a partir de la razón entre tareas en estado `completed` sobre el total de tareas operativas registradas.
  - `cloneStructure(newTitle, newDate)`: Implementa el patrón *Prototype*; toma las tareas y la estructura del cronograma de un evento exitoso para inicializar uno nuevo ahorrando tiempo de configuración al organizador.

### 2.2 Clase `Guest`
- **Responsabilidad:** Gestión de confirmación de asistencia y control de aforo por mesa.
- **Métodos de Negocio Destacados:**
  - `registerRsvp(status, plusOnes)`: Controla que los acompañantes no superen el límite establecido y actualiza la confirmación de asistencia.
  - `assignTable(tableNum, maxCapacity)`: Verifica que la suma de invitados sentados previamente en `tableNum` más este invitado y sus `plusOnes` no exceda la capacidad máxima por mesa.

### 2.3 Clase `EventService`
- **Responsabilidad:** Representa el contrato vinculante entre el organizador y el proveedor para un evento dado.
- **Métodos de Negocio Destacados:**
  - `attachContractDocument(r2Key)`: Vincula la llave del archivo almacenado en Cloudflare R2 con el contrato legal.
  - `generateExpense()`: Automatiza la creación de un objeto `Expense` para asegurar que todo servicio contratado se refleje inmediatamente en el balance presupuestario del evento.

### 2.4 Clase `Expense`
- **Responsabilidad:** Trazabilidad de desembolsos monetarios y cuentas por pagar.
- **Métodos de Negocio Destacados:**
  - `registerPayment(receiptR2Key)`: Cambia el estado a `paid`, vincula el comprobante digital subido a Cloudflare R2 y sella la fecha de ejecución.
  - `isOverdue()`: Compara la fecha de vencimiento (`dueDate`) con la fecha actual cuando el estado es `pending`.

### 2.5 Clase `Task` y `AgendaItem`
- **Responsabilidad:** Coordinación temporal previa (pre-producción) y durante el día del evento (producción en vivo).
- **Métodos de Negocio Destacados:**
  - `completeTask()`: Marca la tarea como finalizada y sella `completedAt`.
  - `hasTimeConflict(other: AgendaItem)`: Detecta solapamientos horarios en la misma locación o con la misma persona responsable, evitando choques en el itinerario de la fiesta.
