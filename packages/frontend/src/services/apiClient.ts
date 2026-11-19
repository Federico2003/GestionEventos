import { captureFrontendException, traceFrontendAction } from '../monitoring/sentry';
import type {
  AuthUser,
  BudgetSummary,
  DashboardSummary,
  EventDetailResponse,
  EventPortfolioItem,
  ExpenseItem,
  GuestItem,
  HealthStatus,
  TaskItem
} from '../types';

export interface ApmCheckResult {
  apm: string;
  mode: string;
  traceId?: string;
  sentryEnabled?: boolean;
  sentryEventId?: string;
  message: string;
  timestamp: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiHttpError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TOKEN_STORAGE_KEY = 'planora_session_token';

function readStoredToken(): string | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(TOKEN_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignorar errores de almacenamiento restringido
  }
}

export class PlanoraApiClient {
  private token: string | null = null;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl?: string, fetchImpl?: FetchLike) {
    const envUrl =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
        ? String(import.meta.env.VITE_API_URL)
        : '/api/v1';
    this.baseUrl = (baseUrl ?? envUrl).replace(/\/+$/, '');
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
    this.token = readStoredToken();
  }

  public setToken(token: string | null): void {
    this.token = token;
    writeStoredToken(token);
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined)
    };
    if (init.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return traceFrontendAction(
      `API ${method} ${path}`,
      'http.client',
      async () => {
        let res: Response;
        try {
          res = await this.fetchImpl(`${this.baseUrl}${path}`, {
            ...init,
            headers
          });
        } catch (networkErr) {
          captureFrontendException(networkErr, { path, method, kind: 'network_error' });
          throw networkErr;
        }

        if (res.status === 204) {
          return undefined as T;
        }

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const httpError = new ApiHttpError(
            res.status,
            body.error ?? 'HTTP_ERROR',
            body.message ?? `Error HTTP ${res.status}`
          );
          if (res.status >= 500) {
            captureFrontendException(httpError, {
              path,
              method,
              status: res.status,
              traceId: body.traceId
            });
          }
          throw httpError;
        }

        return body as T;
      },
      { 'http.request.method': method, 'url.path': path }
    );
  }

  public async triggerApmCheck(
    mode: 'message' | 'error' = 'message',
    message?: string
  ): Promise<ApmCheckResult> {
    const params = new URLSearchParams({ mode });
    if (message) {
      params.set('message', message);
    }
    return this.request<ApmCheckResult>(`/apm/test?${params.toString()}`);
  }

  public async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const result = await this.request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(result.token);
    return result;
  }

  public async getMe(): Promise<{ user: AuthUser }> {
    return this.request<{ user: AuthUser }>('/auth/me');
  }

  public async logout(): Promise<void> {
    try {
      await this.request<void>('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  public async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  public async getDashboard(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('/dashboard');
  }

  public async listEvents(): Promise<{ events: EventPortfolioItem[] }> {
    return this.request<{ events: EventPortfolioItem[] }>('/events');
  }

  public async getEventDetail(eventId: string): Promise<EventDetailResponse> {
    return this.request<EventDetailResponse>(`/events/${eventId}`);
  }

  public async cloneEvent(
    eventId: string,
    title: string,
    eventDate: string
  ): Promise<EventDetailResponse> {
    return this.request<EventDetailResponse>(`/events/${eventId}/clone`, {
      method: 'POST',
      body: JSON.stringify({ title, eventDate })
    });
  }

  public async addGuest(
    eventId: string,
    payload: {
      firstName: string;
      lastName?: string;
      rsvpStatus: 'pending' | 'confirmed' | 'declined';
      plusOnes: number;
      tableNumber?: number | null;
      mealPreference?: 'standard' | 'vegetarian' | 'vegan' | 'child' | 'kosher' | 'other';
      allergies?: string;
      hasCriticalAllergies?: boolean;
    }
  ): Promise<{ guestId: string; guest: GuestItem }> {
    return this.request<{ guestId: string; guest: GuestItem }>(`/events/${eventId}/guests`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async recordExpense(
    eventId: string,
    payload: {
      concept: string;
      category: string;
      amount: number;
      paymentStatus?: 'pending' | 'partial' | 'paid';
    }
  ): Promise<{ expense: ExpenseItem; budget: BudgetSummary }> {
    return this.request<{ expense: ExpenseItem; budget: BudgetSummary }>(
      `/events/${eventId}/expenses`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  }

  public async completeTask(
    eventId: string,
    taskId: string
  ): Promise<{ task: TaskItem; progress: number }> {
    return this.request<{ task: TaskItem; progress: number }>(
      `/events/${eventId}/tasks/${taskId}/complete`,
      { method: 'PATCH' }
    );
  }

  public async addAgendaItem(
    eventId: string,
    payload: {
      title: string;
      startTime: string;
      endTime: string;
      responsiblePerson: string;
      locationDetail: string;
    }
  ): Promise<{ item: unknown }> {
    return this.request<{ item: unknown }>(`/events/${eventId}/agenda`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}
