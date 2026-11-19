export type UserRole = 'admin' | 'organizer' | 'client';
export type ThemeMode = 'dark' | 'light';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface DashboardSummary {
  totalEvents: number;
  confirmedEvents: number;
  draftEvents: number;
  totalBudgetVolume: number;
  totalSpentVolume: number;
  overallExecutionPct: number;
  totalConfirmedAttendees: number;
  totalTablesCount: number;
  totalCriticalAllergies: number;
  contractsInR2: number;
  activeEvents?: number;
  overdueTasks?: number;
  upcomingEvents?: Array<{
    id: string;
    title: string;
    eventDate: string;
    status: string;
    venueName: string;
  }>;
}

/** Respuesta de GET /api/v1/health (estado real del ambiente desplegado). */
export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  environment: string;
  apm: { provider: string; enabled: boolean };
  database: {
    provider: string;
    status: 'connected' | 'error' | 'not_configured';
    tables?: Record<string, number>;
  };
  timestamp: string;
}

export interface EventPortfolioItem {
  id: string;
  title: string;
  eventType: string;
  status: string;
  eventDate: string;
  venueName: string;
  initialBudget: number;
  estimatedGuests: number;
  clientId: string;
  clientName: string;
  clientEmail: string;
  confirmedSeats: number;
  progress: number;
  budgetStatus: 'green' | 'yellow' | 'red';
  spentPercentage: number;
}

export interface TableOccupancyItem {
  id: string;
  eventId: string;
  tableNumber: number;
  label: string;
  capacity: number;
  seated: number;
  availableSeats: number;
}

export interface GuestItem {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  tableNumber: number | null;
  rsvpStatus: 'pending' | 'confirmed' | 'declined';
  plusOnes: number;
  totalSeats: number;
  mealPreference: 'standard' | 'vegetarian' | 'vegan' | 'child' | 'kosher' | 'other';
  allergies: string;
  hasCriticalAllergies: boolean;
  dietaryRestrictions: string;
}

export interface BudgetSummary {
  initialBudget: number;
  totalSpent: number;
  paidAmount: number;
  pendingAmount: number;
  remainingBalance: number;
  spentPercentage: number;
  statusAlert: 'green' | 'yellow' | 'red';
  isOverrun: boolean;
}

export interface ExpenseItem {
  id: string;
  eventId: string;
  concept: string;
  category: string;
  amount: number;
  paymentStatus: 'pending' | 'partial' | 'paid';
  receiptUrl: string | null;
}

export interface ContractItem {
  id: string;
  eventId: string;
  serviceName: string;
  vendorName: string;
  category: string;
  agreedPrice: number;
  status: string;
  contractUrl: string | null;
}

export interface TaskItem {
  id: string;
  eventId: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  dueDate: string;
}

export interface AgendaItem {
  id: string;
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  responsiblePerson: string;
  locationDetail: string;
  notes: string;
  orderIndex: number;
}

export interface EventDetailResponse {
  event: {
    id: string;
    title: string;
    eventType: string;
    status: string;
    eventDate: string;
    venueName: string;
    venueAddress: string;
    initialBudget: number;
    estimatedGuests: number;
    clientName: string;
    clientEmail: string;
    progress: number;
  };
  budget: BudgetSummary;
  rsvpMetrics: {
    totalInvitedGuests: number;
    confirmedGuests: number;
    pendingGuests: number;
    declinedGuests: number;
    totalConfirmedSeats: number;
    confirmationRate: number;
  };
  cateringReport: {
    totalsByMenu: Record<string, number>;
    platesByTable: Record<string, number>;
    criticalAlerts: Array<{ guestId: string; tableNumber: number | null; allergen: string }>;
    enrichedAlerts: Array<{
      guestId: string;
      guestName: string;
      tableNumber: number | null;
      allergen: string;
      dietaryRestrictions: string;
    }>;
  };
  tables: TableOccupancyItem[];
  guests: GuestItem[];
  expenses: ExpenseItem[];
  contracts: ContractItem[];
  tasks: TaskItem[];
  agenda: AgendaItem[];
}
