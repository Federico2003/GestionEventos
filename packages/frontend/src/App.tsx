import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPortal } from './components/AdminPortal';
import { ClientPortal } from './components/ClientPortal';
import { LoginView } from './components/LoginView';
import { ThemeProvider, ThemeToggleButton } from './context/ThemeContext';
import {
  captureFrontendException,
  captureFrontendMessage,
  setFrontendTelemetryUser,
  traceFrontendAction
} from './monitoring/sentry';
import { PlanoraApiClient } from './services/apiClient';
import type {
  AuthUser,
  DashboardSummary,
  EventDetailResponse,
  EventPortfolioItem
} from './types';

export interface AppProps {
  apiClient?: PlanoraApiClient;
}

export const App: React.FC<AppProps> = ({ apiClient }) => {
  const api = useMemo(() => apiClient ?? new PlanoraApiClient(), [apiClient]);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [events, setEvents] = useState<EventPortfolioItem[]>([]);
  const [activeEvent, setActiveEvent] = useState<EventDetailResponse | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => Boolean(api.getToken()));
  const [portalError, setPortalError] = useState<string | null>(null);

  const loadPortalState = useCallback(
    async (preferredEventId?: string) => {
      const [dash, eventListResp] = await Promise.all([api.getDashboard(), api.listEvents()]);
      setDashboard(dash);
      setEvents(eventListResp.events);

      const targetId = preferredEventId ?? eventListResp.events[0]?.id;
      if (targetId) {
        const detail = await api.getEventDetail(targetId);
        setActiveEvent(detail);
      } else {
        setActiveEvent(null);
      }
    },
    [api]
  );

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setIsRestoringSession(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { user: restoredUser } = await api.getMe();
        if (cancelled) return;
        setUser(restoredUser);
        setFrontendTelemetryUser(restoredUser);
        await loadPortalState();
      } catch {
        if (!cancelled) {
          api.setToken(null);
          setFrontendTelemetryUser(null);
          setUser(null);
          setDashboard(null);
          setEvents([]);
          setActiveEvent(null);
        }
      } finally {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, loadPortalState]);

  const handleLogin = async (email: string, password: string) => {
    setPortalError(null);
    return traceFrontendAction('auth.login', 'ui.action', async () => {
      const { user: loggedUser } = await api.login(email, password);
      setUser(loggedUser);
      setFrontendTelemetryUser(loggedUser);
      captureFrontendMessage('Inicio de sesión exitoso en Planora Frontend', 'info', {
        role: loggedUser.role
      });
      await loadPortalState();
    });
  };

  const handleSelectEvent = async (eventId: string) => {
    setPortalError(null);
    try {
      const detail = await api.getEventDetail(eventId);
      setActiveEvent(detail);
    } catch (err) {
      captureFrontendException(err, { action: 'selectEvent', eventId });
      setPortalError(
        err instanceof Error ? err.message : 'No fue posible cargar el detalle del evento.'
      );
    }
  };

  const handleRefresh = async () => {
    setPortalError(null);
    await loadPortalState(activeEvent?.event.id);
  };

  const handleLogout = async () => {
    await api.logout();
    captureFrontendMessage('Cierre de sesión en Planora Frontend', 'info');
    setFrontendTelemetryUser(null);
    setUser(null);
    setDashboard(null);
    setEvents([]);
    setActiveEvent(null);
    setPortalError(null);
  };

  const renderContent = () => {
    if (isRestoringSession) {
      return (
        <div className="min-h-screen flex items-center justify-center text-sm text-secondary-tone">
          Cargando sesión de Planora...
        </div>
      );
    }

    if (!user || !dashboard) {
      return <LoginView onLogin={handleLogin} />;
    }

    if (!activeEvent) {
      return (
        <div className="min-h-screen flex flex-col">
          <header className="topbar-surface px-6 md:px-10 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#5C3E2B] border border-[#8C6245] flex items-center justify-center heading-font font-bold text-[#F6F3EE] text-sm">
                P
              </div>
              <span className="heading-font font-bold tracking-[0.16em] text-sm">PLANORA</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full elevated-card text-wood-accent font-medium">
                {user.name} ({user.role})
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <ThemeToggleButton />
              <button
                type="button"
                onClick={handleLogout}
                className="px-3.5 py-2 rounded-xl surface-card hover:border-[#8C6245] text-xs font-semibold cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 flex items-center justify-center">
            <div className="surface-card rounded-2xl p-8 text-center space-y-3 w-full">
              <h1 className="heading-font text-2xl font-bold">
                Bienvenido a Planora, {user.name}
              </h1>
              <p className="text-sm text-secondary-tone">
                Aún no tienes eventos asignados o activos en tu portafolio ({dashboard.totalEvents}{' '}
                eventos registrados).
              </p>
            </div>
          </main>
        </div>
      );
    }

    if (user.role === 'client') {
      return (
        <ClientPortal
          user={user}
          api={api}
          eventDetail={activeEvent}
          onRefresh={handleRefresh}
          onLogout={handleLogout}
        />
      );
    }

    return (
      <AdminPortal
        user={user}
        api={api}
        dashboard={dashboard}
        events={events}
        activeEvent={activeEvent}
        onSelectEvent={handleSelectEvent}
        onRefresh={handleRefresh}
        onLogout={handleLogout}
      />
    );
  };

  return (
    <ThemeProvider>
      {portalError && (
        <div
          role="alert"
          className="px-6 py-3 bg-red-950/90 border-b border-red-700 text-red-200 text-xs text-center"
        >
          {portalError}
        </div>
      )}
      {renderContent()}
    </ThemeProvider>
  );
};

export default App;
