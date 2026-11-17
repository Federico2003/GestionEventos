import { EventEntity } from '../domain/entities/EventEntity';
import { EventTable } from '../domain/entities/EventTable';
import { ExpenseEntity } from '../domain/entities/Expense';
import { GuestEntity } from '../domain/entities/GuestEntity';
import { AgendaItemEntity, TaskEntity } from '../domain/entities/TaskAndAgenda';
import { ClientEntity, UserEntity } from '../domain/entities/UserAndClient';
import { EventServiceEntity, VendorEntity } from '../domain/entities/VendorAndService';

export const DEMO_HASH_PLACEHOLDER = 'pending$pbkdf2-bootstrap';

export class PlanoraDataStore {
  public readonly users = new Map<string, UserEntity>();
  public readonly clients = new Map<string, ClientEntity>();
  public readonly events = new Map<string, EventEntity>();
  public readonly tables = new Map<string, EventTable>();
  public readonly guests = new Map<string, GuestEntity>();
  public readonly vendors = new Map<string, VendorEntity>();
  public readonly contracts = new Map<string, EventServiceEntity>();
  public readonly expenses = new Map<string, ExpenseEntity>();
  public readonly tasks = new Map<string, TaskEntity>();
  public readonly agendaItems = new Map<string, AgendaItemEntity>();

  constructor(defaultPasswordHash = DEMO_HASH_PLACEHOLDER) {
    this.seed(defaultPasswordHash);
  }

  public hasPendingDemoPasswords(): boolean {
    for (const user of this.users.values()) {
      if (user.passwordHash === DEMO_HASH_PLACEHOLDER) {
        return true;
      }
    }
    return false;
  }

  public updateDefaultPasswordHashes(realHash: string): void {
    for (const user of this.users.values()) {
      if (user.passwordHash === DEMO_HASH_PLACEHOLDER) {
        user.passwordHash = realHash;
      }
    }
  }

  private seed(defaultHash: string): void {
    // 1. Usuarios (Admin, Organizadores con aislamiento multitenant y Cliente/Novios)
    const users = [
      new UserEntity({
        id: 'u-admin',
        name: 'Federico Z. (Administrador)',
        email: 'admin@planora.mx',
        passwordHash: defaultHash,
        role: 'admin',
        phone: '+52 55 1000 0001'
      }),
      new UserEntity({
        id: 'u-org',
        name: 'Federico Z. (Senior Planner)',
        email: 'organizer@planora.mx',
        passwordHash: defaultHash,
        role: 'organizer',
        phone: '+52 55 2000 0002'
      }),
      new UserEntity({
        id: 'u-org-a',
        name: 'Organizador Agencia A',
        email: 'orga@planora.mx',
        passwordHash: defaultHash,
        role: 'organizer',
        phone: '+52 55 3000 0003'
      }),
      new UserEntity({
        id: 'u-org-b',
        name: 'Organizador Agencia B',
        email: 'orgb@planora.mx',
        passwordHash: defaultHash,
        role: 'organizer',
        phone: '+52 55 4000 0004'
      }),
      new UserEntity({
        id: 'u-client',
        name: 'Sofía Villarreal & Mateo Alarcón',
        email: 'sofia@cliente.mx',
        passwordHash: defaultHash,
        role: 'client',
        phone: '+52 55 8899 1122'
      })
    ];
    users.forEach((u) => this.users.set(u.id, u));

    // 2. Clientes
    const clients = [
      new ClientEntity({
        id: 'cli-1',
        organizerId: 'u-org',
        userId: 'u-client',
        firstName: 'Sofía',
        lastName: 'Villarreal',
        email: 'sofia@cliente.mx',
        phone: '+52 55 8899 1122',
        notes: 'Boda estelar en Hacienda San Gabriel'
      }),
      new ClientEntity({
        id: 'cli-2',
        organizerId: 'u-org',
        firstName: 'Luis',
        lastName: 'Méndez (Grupo Horizonte)',
        email: 'lmendez@horizonte.mx',
        phone: '+52 55 7744 3300',
        notes: 'Gala Corporativa Fin de Año'
      }),
      new ClientEntity({
        id: 'cli-3',
        organizerId: 'u-org',
        firstName: 'Roberto',
        lastName: 'Montemayor',
        email: 'rmontemayor@correo.mx',
        phone: '+52 81 1122 9988',
        notes: 'XV Años Camila Montemayor'
      }),
      new ClientEntity({
        id: 'cli-de-org-b',
        organizerId: 'u-org-b',
        firstName: 'Valeria',
        lastName: 'Privada Agencia B',
        email: 'valeria@agenciab.mx',
        phone: '+52 33 4455 6677',
        notes: 'Expediente exclusivo del Organizador B (prueba multitenant CP-SEC-05)'
      })
    ];
    clients.forEach((c) => this.clients.set(c.id, c));

    // 3. Eventos (fechas futuras dinámicas para validez permanente)
    const futureNov = new Date();
    futureNov.setMonth(futureNov.getMonth() + 4);
    const futureDec = new Date();
    futureDec.setMonth(futureDec.getMonth() + 6);
    const futureJan = new Date();
    futureJan.setMonth(futureJan.getMonth() + 9);

    const events = [
      new EventEntity({
        id: 'evt-1',
        organizerId: 'u-org',
        clientId: 'cli-1',
        title: 'Boda Sofía Villarreal & Mateo Alarcón',
        eventType: 'wedding',
        status: 'confirmed',
        eventDate: futureNov,
        venueName: 'Hacienda San Gabriel',
        venueAddress: 'Carretera Federal Cuernavaca Km 42, Morelos',
        initialBudget: 500000,
        estimatedGuests: 240
      }),
      new EventEntity({
        id: 'evt-2',
        organizerId: 'u-org',
        clientId: 'cli-2',
        title: 'Gala Anual Grupo Horizonte',
        eventType: 'corporate',
        status: 'confirmed',
        eventDate: futureDec,
        venueName: 'Salón Imperial Reforma',
        venueAddress: 'Paseo de la Reforma 505, CDMX',
        initialBudget: 700000,
        estimatedGuests: 320
      }),
      new EventEntity({
        id: 'evt-3',
        organizerId: 'u-org',
        clientId: 'cli-3',
        title: 'XV Años Camila Montemayor',
        eventType: 'fifteen_years',
        status: 'draft',
        eventDate: futureJan,
        venueName: 'Jardín Las Campanas',
        venueAddress: 'San Pedro Garza García, NL',
        initialBudget: 220000,
        estimatedGuests: 180
      })
    ];
    events.forEach((e) => this.events.set(e.id, e));

    // 4. Mesas de evt-1
    const tables = [
      new EventTable({ id: 'tbl-4', eventId: 'evt-1', tableNumber: 4, label: 'Mesa 04 • Familia Novia', capacity: 10 }),
      new EventTable({ id: 'tbl-9', eventId: 'evt-1', tableNumber: 9, label: 'Mesa 09 • Corporativos & Médicos', capacity: 10 }),
      new EventTable({ id: 'tbl-12', eventId: 'evt-1', tableNumber: 12, label: 'Mesa 12 • Amigos Universidad', capacity: 10 }),
      new EventTable({ id: 'tbl-15', eventId: 'evt-1', tableNumber: 15, label: 'Mesa 15 • Familia Novio', capacity: 10 })
    ];
    tables.forEach((t) => this.tables.set(t.id, t));

    // 5. Invitados de evt-1 (con acompañantes y alergias críticas reales)
    const guests = [
      new GuestEntity({
        id: 'gst-1',
        eventId: 'evt-1',
        firstName: 'Elena',
        lastName: 'Villarreal',
        email: 'elena.v@correo.mx',
        phone: '+52 55 1111 2222',
        tableNumber: 4,
        rsvpStatus: 'confirmed',
        plusOnes: 3,
        mealPreference: 'standard',
        allergies: 'Mariscos / Crustáceos',
        hasCriticalAllergies: true,
        dietaryRestrictions: 'Utensilios separados en cocina'
      }),
      new GuestEntity({
        id: 'gst-2',
        eventId: 'evt-1',
        firstName: 'Fernando',
        lastName: 'Villarreal',
        email: 'fernando.v@correo.mx',
        tableNumber: 4,
        rsvpStatus: 'confirmed',
        plusOnes: 5,
        mealPreference: 'standard',
        allergies: 'Mariscos',
        hasCriticalAllergies: true,
        dietaryRestrictions: 'Riesgo anafiláctico'
      }),
      new GuestEntity({
        id: 'gst-3',
        eventId: 'evt-1',
        firstName: 'Dr. Alejandro',
        lastName: 'Ríos',
        email: 'arios@hospital.mx',
        tableNumber: 9,
        rsvpStatus: 'confirmed',
        plusOnes: 3,
        mealPreference: 'vegetarian',
        allergies: 'Gluten (Celiaquía Estricta)',
        hasCriticalAllergies: true,
        dietaryRestrictions: 'Menú libre de trigo y cebada'
      }),
      new GuestEntity({
        id: 'gst-4',
        eventId: 'evt-1',
        firstName: 'Arq. Mariana',
        lastName: 'Solís',
        email: 'msolis@estudio.mx',
        tableNumber: 9,
        rsvpStatus: 'confirmed',
        plusOnes: 3,
        mealPreference: 'vegan',
        allergies: 'Nueces y Almendras',
        hasCriticalAllergies: true,
        dietaryRestrictions: 'Sin trazas de frutos secos'
      }),
      new GuestEntity({
        id: 'gst-5',
        eventId: 'evt-1',
        firstName: 'Rodrigo',
        lastName: 'Alarcón',
        email: 'ralarcon@correo.mx',
        tableNumber: 15,
        rsvpStatus: 'confirmed',
        plusOnes: 5,
        mealPreference: 'standard'
      }),
      new GuestEntity({
        id: 'gst-6',
        eventId: 'evt-1',
        firstName: 'Tía Lucía',
        lastName: 'Villarreal',
        email: 'lucia.v@correo.mx',
        tableNumber: null,
        rsvpStatus: 'pending',
        plusOnes: 1,
        mealPreference: 'vegetarian'
      })
    ];
    guests.forEach((g) => this.guests.set(g.id, g));

    // 6. Proveedores y Contratos R2
    const vendors = [
      new VendorEntity({
        id: 'vnd-1',
        organizerId: 'u-org',
        businessName: 'Hacienda San Gabriel S.A.',
        category: 'venue',
        contactName: 'Lic. Patricia Mora',
        email: 'reservas@haciendasangabriel.mx',
        phone: '+52 777 310 2200',
        rating: 4.9
      }),
      new VendorEntity({
        id: 'vnd-2',
        organizerId: 'u-org',
        businessName: 'Alta Cocina & Banquetes Ambrosía',
        category: 'catering',
        contactName: 'Chef Esteban Cárdenas',
        email: 'chef@ambrosiabanquetes.mx',
        phone: '+52 55 5200 9900',
        rating: 5.0
      }),
      new VendorEntity({
        id: 'vnd-3',
        organizerId: 'u-org',
        businessName: 'Ensamble & Audio Lumina',
        category: 'music_dj',
        contactName: 'Ing. Daniel Ortega',
        email: 'produccion@luminaaudio.mx',
        phone: '+52 55 4400 8811',
        rating: 4.8
      })
    ];
    vendors.forEach((v) => this.vendors.set(v.id, v));

    const contracts = [
      new EventServiceEntity({
        id: 'ctr-1',
        eventId: 'evt-1',
        serviceId: 'srv-venue-1',
        serviceName: 'Renta Exclusiva de Hacienda y Capilla',
        vendorName: 'Hacienda San Gabriel S.A.',
        category: 'venue',
        agreedPrice: 165000,
        status: 'paid',
        contractUrl: 'contracts/evt-1/Contrato-Hacienda-San-Gabriel.pdf'
      }),
      new EventServiceEntity({
        id: 'ctr-2',
        eventId: 'evt-1',
        serviceId: 'srv-cat-1',
        serviceName: 'Banquete 3 Tiempos + Barra Premium (240 pax)',
        vendorName: 'Alta Cocina & Banquetes Ambrosía',
        category: 'catering',
        agreedPrice: 145000,
        status: 'contracted',
        contractUrl: 'contracts/evt-1/Menu-Oficial-Poliza-Banquete.pdf'
      }),
      new EventServiceEntity({
        id: 'ctr-3',
        eventId: 'evt-1',
        serviceId: 'srv-dj-1',
        serviceName: 'Audio Line Array, Cuerdas y DJ Residente',
        vendorName: 'Ensamble & Audio Lumina',
        category: 'music_dj',
        agreedPrice: 50000,
        status: 'contracted',
        contractUrl: 'contracts/evt-1/Croquis-Audio-Escenario.pdf'
      })
    ];
    contracts.forEach((c) => this.contracts.set(c.id, c));

    // 7. Gastos de evt-1 ($360,000 de $500,000 = 72% Estado Verde)
    const expenses = [
      new ExpenseEntity({
        id: 'exp-1',
        eventId: 'evt-1',
        eventServiceId: 'ctr-1',
        concept: 'Liquidación Renta Hacienda San Gabriel',
        category: 'venue',
        amount: 165000,
        paymentStatus: 'paid',
        receiptUrl: 'receipts/evt-1/recibo-hacienda.pdf',
        paidAt: '2026-10-01T14:00:00.000Z'
      }),
      new ExpenseEntity({
        id: 'exp-2',
        eventId: 'evt-1',
        eventServiceId: 'ctr-2',
        concept: 'Anticipo y Menú Degustación Banquete Ambrosía',
        category: 'catering',
        amount: 145000,
        paymentStatus: 'paid',
        receiptUrl: 'receipts/evt-1/recibo-banquete.pdf',
        paidAt: '2026-10-12T16:30:00.000Z'
      }),
      new ExpenseEntity({
        id: 'exp-3',
        eventId: 'evt-1',
        eventServiceId: 'ctr-3',
        concept: 'Producción Sonora e Iluminación Arquitectónica',
        category: 'music_dj',
        amount: 50000,
        paymentStatus: 'pending',
        dueDate: '2026-11-15'
      })
    ];
    expenses.forEach((ex) => this.expenses.set(ex.id, ex));

    // 8. Tareas Operativas de evt-1
    const tasks = [
      new TaskEntity({
        id: 'tsk-1',
        eventId: 'evt-1',
        assignedTo: 'u-org',
        title: 'Entregar croquis final de mesas y protocolo de alergias al Chef',
        priority: 'urgent',
        status: 'completed',
        dueDate: '2026-11-10',
        completedAt: '2026-10-20T12:00:00.000Z'
      }),
      new TaskEntity({
        id: 'tsk-2',
        eventId: 'evt-1',
        assignedTo: 'u-org',
        title: 'Validar prueba de iluminación cálida en arcos principales',
        priority: 'high',
        status: 'completed',
        dueDate: '2026-11-12',
        completedAt: '2026-10-21T18:00:00.000Z'
      }),
      new TaskEntity({
        id: 'tsk-3',
        eventId: 'evt-1',
        assignedTo: 'u-org',
        title: 'Confirmar asistencia de últimos invitados pendientes en RSVP',
        priority: 'high',
        status: 'in_progress',
        dueDate: '2026-11-18'
      }),
      new TaskEntity({
        id: 'tsk-4',
        eventId: 'evt-1',
        assignedTo: 'u-client',
        title: 'Confirmar canción oficial de entrada de novios (20:15 hrs)',
        priority: 'medium',
        status: 'completed',
        dueDate: '2026-11-19',
        completedAt: '2026-10-22T09:00:00.000Z'
      })
    ];
    tasks.forEach((t) => this.tasks.set(t.id, t));

    // 9. Cronograma Minuto a Minuto de evt-1
    const agenda = [
      new AgendaItemEntity({
        id: 'agd-1',
        eventId: 'evt-1',
        title: 'Ceremonia Civil y Religiosa',
        startTime: '17:30',
        endTime: '18:45',
        responsiblePerson: 'Coordinador Principal',
        locationDetail: 'Capilla de Piedra',
        notes: 'Cortejo listo 15 min antes',
        orderIndex: 0
      }),
      new AgendaItemEntity({
        id: 'agd-2',
        eventId: 'evt-1',
        title: 'Recepción y Cóctel de Bienvenida',
        startTime: '19:00',
        endTime: '20:00',
        responsiblePerson: 'Capitán de Meseros',
        locationDetail: 'Jardín Principal',
        notes: 'Cuarteto de cuerdas en vivo y coctelería de autor',
        orderIndex: 1
      }),
      new AgendaItemEntity({
        id: 'agd-3',
        eventId: 'evt-1',
        title: 'Entrada de los Novios y Banquete a 3 Tiempos',
        startTime: '20:15',
        endTime: '21:45',
        responsiblePerson: 'Chef Esteban Cárdenas',
        locationDetail: 'Salón Mayor Hacienda San Gabriel',
        notes: 'Priorizar servicio libre de alérgenos en Mesas 04 y 09',
        orderIndex: 2
      }),
      new AgendaItemEntity({
        id: 'agd-4',
        eventId: 'evt-1',
        title: 'Primer Vals y Apertura de Pista',
        startTime: '22:00',
        endTime: '23:30',
        responsiblePerson: 'Ing. Daniel Ortega (DJ)',
        locationDetail: 'Pista Central',
        notes: 'Pirotecnia fría autorizada',
        orderIndex: 3
      })
    ];
    agenda.forEach((a) => this.agendaItems.set(a.id, a));
  }
}
