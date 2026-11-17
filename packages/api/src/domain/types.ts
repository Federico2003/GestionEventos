export type UserRole = 'admin' | 'organizer' | 'client';

export type EventType = 'wedding' | 'fifteen_years' | 'corporate' | 'graduation' | 'social';

export type EventStatus =
  | 'draft'
  | 'planning'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type RsvpStatus = 'pending' | 'confirmed' | 'declined';

export type MealPreference = 'standard' | 'vegetarian' | 'vegan' | 'child' | 'kosher' | 'other';

export type VendorCategory =
  | 'catering'
  | 'photography'
  | 'music_dj'
  | 'venue'
  | 'decoration'
  | 'flowers'
  | 'security'
  | 'transport'
  | 'other';

export type ExpenseCategory = VendorCategory | 'contingency';

export type ContractStatus = 'quoted' | 'contracted' | 'paid' | 'cancelled';

export type PaymentStatus = 'pending' | 'partial' | 'paid';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';

export type BudgetAlertLevel = 'green' | 'yellow' | 'red';

export interface BudgetSummaryVO {
  initialBudget: number;
  totalSpent: number;
  paidAmount: number;
  pendingAmount: number;
  remainingBalance: number;
  spentPercentage: number;
  statusAlert: BudgetAlertLevel;
  isOverrun: boolean;
}

export interface CriticalAllergyAlertVO {
  guestId: string;
  tableNumber: number | null;
  allergen: string;
}

export interface CateringReportVO {
  totalsByMenu: Partial<Record<MealPreference, number>>;
  platesByTable: Record<number, number>;
  criticalAlerts: CriticalAllergyAlertVO[];
}

export interface RsvpMetricsVO {
  totalInvitedGuests: number;
  confirmedGuests: number;
  pendingGuests: number;
  declinedGuests: number;
  totalConfirmedSeats: number;
  confirmationRate: number;
}

export interface TimelineConflictVO {
  itemAId: string;
  itemBId: string;
  reason: string;
  overlapStart: string;
  overlapEnd: string;
}
