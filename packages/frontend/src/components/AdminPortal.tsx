import React, { useState } from 'react';
import { ThemeToggleButton } from '../context/ThemeContext';
import {
  captureFrontendException,
  captureFrontendMessage,
  logFrontend,
  isFrontendSentryEnabled,
  resolveFrontendTelemetryConfig,
  traceFrontendAction
} from '../monitoring/sentry';
import type { PlanoraApiClient } from '../services/apiClient';
import type {
  AuthUser,
  DashboardSummary,
  EventDetailResponse,
  EventPortfolioItem
} from '../types';

type AdminTab = 'dashboard' | 'events' | 'guests' | 'catering' | 'budget' | 'agenda';

interface AdminPortalProps {
  user: AuthUser;
  api: PlanoraApiClient;
  dashboard: DashboardSummary;
  events: EventPortfolioItem[];
  activeEvent: EventDetailResponse;
  onSelectEvent: (eventId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}

const TAB_TITLES: Record<AdminTab, [string, string]> = {
  dashboard: ['PORTAL ADMINISTRADOR • MÓDULO 1 DE 6', 'Dashboard Ejecutivo y Supervisión de Plataforma'],
  events: ['PORTAL ADMINISTRADOR • MÓDULO 2 DE 6', 'Gestión de Eventos, Ciclo de Vida y Clientes'],
  guests: ['PORTAL ADMINISTRADOR • MÓDULO 3 DE 6', 'Control de Invitados y Bloqueo de Aforo de Mesas'],
  catering: ['PORTAL ADMINISTRADOR • MÓDULO 4 DE 6', 'Menús y Reporte Oficial de Alergias para Cocina'],
  budget: ['PORTAL ADMINISTRADOR • MÓDULO 5 DE 6', 'Presupuesto, Semáforo Financiero y Contratos R2'],
  agenda: ['PORTAL ADMINISTRADOR • MÓDULO 6 DE 6', 'Checklist Operativo y Cronograma Minuto a Minuto']
};

export const AdminPortal: React.FC<AdminPortalProps> = ({
  user,
  api,
  dashboard,
  events,
  activeEvent,
  onSelectEvent,
  onRefresh,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  // Estado formulario Invitados / Aforo
  const [guestFirstName, setGuestFirstName] = useState('Familia');
  const [guestLastName, setGuestLastName] = useState('Lombardo');
  const [guestPlusOnes, setGuestPlusOnes] = useState(2);
  const [guestTableNum, setGuestTableNum] = useState(9);

  // Estado formulario Gasto
  const [expenseConcept, setExpenseConcept] = useState('Diseño Floral Arcos Imperiales');
  const [expenseAmount, setExpenseAmount] = useState('110000');
  const [expenseCategory, setExpenseCategory] = useState('flowers');

  // Estado formulario Agenda
  const [agendaTitle, setAgendaTitle] = useState('Prueba de Audio Empalmada');
  const [agendaStart, setAgendaStart] = useState('19:30');
  const [agendaEnd, setAgendaEnd] = useState('20:30');
  const [agendaLocation, setAgendaLocation] = useState('Jardín Principal');

  const eventId = activeEvent.event.id;

  const handleCloneTemplate = async () => {
    setFeedbackBanner(null);
    try {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      await api.cloneEvent(
        eventId,
        `${activeEvent.event.title} (Plantilla Clonada)`,
        nextYear.toISOString()
      );
      await onRefresh();
      setFeedbackBanner({
        kind: 'success',
        text: 'Estructura clonada con éxito: se copiaron tareas operativas y cronograma sin duplicar gastos.'
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Error al clonar evento'
      });
    }
  };

  const handleAssignGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);
    try {
      await api.addGuest(eventId, {
        firstName: guestFirstName,
        lastName: guestLastName,
        rsvpStatus: 'confirmed',
        plusOnes: guestPlusOnes,
        tableNumber: guestTableNum
      });
      await onRefresh();
      setFeedbackBanner({
        kind: 'success',
        text: `Invitado ${guestFirstName} ${guestLastName} asignado en Mesa ${guestTableNum}.`
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Sobrecupo detectado en la mesa seleccionada'
      });
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);
    try {
      await api.recordExpense(eventId, {
        concept: expenseConcept.trim(),
        category: expenseCategory,
        amount: Number(expenseAmount),
        paymentStatus: 'pending'
      });
      await onRefresh();
      setFeedbackBanner({
        kind: 'success',
        text: 'Partida financiera registrada y semáforo presupuestal recalculado en tiempo real.'
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Error al registrar gasto'
      });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setFeedbackBanner(null);
    try {
      await api.completeTask(eventId, taskId);
      await onRefresh();
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'No fue posible completar la tarea'
      });
    }
  };

  const handleAddAgendaBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);
    try {
      await api.addAgendaItem(eventId, {
        title: agendaTitle,
        startTime: agendaStart,
        endTime: agendaEnd,
        responsiblePerson: 'Coordinador Técnico',
        locationDetail: agendaLocation
      });
      await onRefresh();
      setFeedbackBanner({
        kind: 'success',
        text: 'Bloque horario incorporado sin solapamientos en la agenda.'
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Conflicto horario detectado (409)'
      });
    }
  };

  const telemetryConfig = resolveFrontendTelemetryConfig();
  const frontendSentryActive = isFrontendSentryEnabled();

  const handleApmCheck = async (target: 'trace-message' | 'frontend-error' | 'backend-error') => {
    setFeedbackBanner(null);
    if (target === 'frontend-error') {
      const simulatedError = new Error(
        'APM_FRONTEND_SIMULATED_ERROR: Excepción controlada en Planora Frontend'
      );
      const eventId = captureFrontendException(simulatedError, {
        source: 'admin-dashboard-apm-check',
        environment: telemetryConfig.environment
      });
      setFeedbackBanner({
        kind: 'error',
        text: eventId
          ? `Error controlado capturado y enviado a Sentry (ID: ${eventId}).`
          : 'Error controlado capturado en modo local (configura VITE_SENTRY_DSN para enviarlo a Sentry).'
      });
      return;
    }

    if (target === 'backend-error') {
      try {
        await api.triggerApmCheck('error');
      } catch (err) {
        setFeedbackBanner({
          kind: 'error',
          text:
            err instanceof Error
              ? `Excepción Backend APM capturada: ${err.message}`
              : 'Error Backend APM capturado'
        });
      }
      return;
    }

    try {
      const result = await traceFrontendAction('planora.ui.apm_check', 'ui.diagnostic', async () => {
        captureFrontendMessage('Verificación manual de traza y mensaje en Planora APM', 'info', {
          environment: telemetryConfig.environment
        });
        logFrontend('info', 'Verificación manual APM iniciada desde el Dashboard', {
          environment: telemetryConfig.environment
        });
        return api.triggerApmCheck(
          'message',
          'Verificación integral Frontend -> Backend en Sentry APM'
        );
      });
      setFeedbackBanner({
        kind: 'success',
        text: `Traza y mensaje APM registrados (${result.traceId ?? 'local'})${
          result.sentryEventId ? ` • Sentry Event: ${result.sentryEventId}` : ''
        }.`
      });
    } catch (err) {
      setFeedbackBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'No fue posible completar la prueba APM'
      });
    }
  };

  const budgetAlertBadge = () => {
    const { statusAlert, spentPercentage } = activeEvent.budget;
    if (statusAlert === 'red') {
      return (
        <span className="px-3 py-1 rounded-full bg-red-950 text-red-200 border border-red-700 font-semibold text-xs">
          ◆ ROJO ({spentPercentage}%)
        </span>
      );
    }
    if (statusAlert === 'yellow') {
      return (
        <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-200 border border-amber-700 font-semibold text-xs">
          ▲ AMARILLO ({spentPercentage}%)
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-200 border border-emerald-700 font-semibold text-xs">
        ● VERDE ({spentPercentage}%)
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Topbar Global */}
      <header className="topbar-surface px-5 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#5C3E2B] border border-[#8C6245] flex items-center justify-center heading-font font-bold text-[#F6F3EE] text-sm">
            P
          </div>
          <span className="heading-font font-bold tracking-[0.16em] text-sm">PLANORA</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full elevated-card text-wood-accent font-medium">
            {user.role === 'admin' ? 'Administrador Global' : 'Wedding & Event Planner'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggleButton />
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl surface-card hover:border-[#8C6245] text-xs font-semibold cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* Sidebar */}
        <aside className="lg:col-span-3 xl:col-span-2 sidebar-surface p-5 flex flex-col justify-between gap-6">
          <div className="space-y-6">
            <div className="p-3.5 rounded-xl surface-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-wood-accent font-bold">
                  PORTAL ADMIN
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
              </div>
              <p className="heading-font text-sm font-bold truncate">{user.name}</p>
              <p className="text-xs text-secondary-tone">Permisos: CRUD Total + Finanzas</p>
            </div>

            <nav className="space-y-1 text-xs md:text-sm" aria-label="Navegación Portal Admin">
              <p className="px-3 text-xs uppercase tracking-wider text-secondary-tone font-semibold mb-2">
                Gestión Operativa
              </p>
              {(
                [
                  ['dashboard', '1. Dashboard & Sistema', 'KPIs'],
                  ['events', '2. Eventos & Clientes', String(events.length)],
                  [
                    'guests',
                    '3. Invitados & Mesas',
                    String(activeEvent.rsvpMetrics.totalConfirmedSeats)
                  ],
                  [
                    'catering',
                    '4. Catering & Alergias',
                    String(activeEvent.cateringReport.criticalAlerts.length)
                  ],
                  ['budget', '5. Presupuesto & R2', `${activeEvent.budget.spentPercentage}%`],
                  ['agenda', '6. Tareas & Cronograma', `${activeEvent.event.progress}%`]
                ] as Array<[AdminTab, string, string]>
              ).map(([key, label, badge]) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFeedbackBanner(null);
                      setActiveTab(key);
                    }}
                    className={
                      isActive
                        ? 'w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#5C3E2B] text-[#F6F3EE] font-semibold shadow-sm cursor-pointer'
                        : 'w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-xl text-secondary-tone hover:bg-[#5C3E2B]/15 transition-colors cursor-pointer'
                    }
                  >
                    <span>{label}</span>
                    <span className="text-xs font-semibold text-wood-accent">{badge}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-3.5 rounded-xl elevated-card space-y-1 text-xs">
            <p className="font-semibold text-wood-accent">Infraestructura Serverless</p>
            <p className="text-secondary-tone">Cloudflare Workers + Hono + D1 + R2 + KV</p>
          </div>
        </aside>

        {/* Área Principal */}
        <main className="lg:col-span-9 xl:col-span-10 flex flex-col">
          <div className="px-6 py-4 border-b border-[var(--border-subtle)] surface-card flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-wood-accent font-semibold">
                {TAB_TITLES[activeTab][0]}
              </span>
              <h1 className="heading-font text-xl md:text-2xl font-bold tracking-tight">
                {TAB_TITLES[activeTab][1]}
              </h1>
            </div>

            <div className="flex items-center gap-2.5 text-xs">
              <label htmlFor="active-event-select" className="text-secondary-tone font-medium">
                Evento Activo:
              </label>
              <select
                id="active-event-select"
                value={eventId}
                onChange={(e) => onSelectEvent(e.target.value)}
                className="px-3 py-1.5 rounded-xl input-adaptive text-xs font-semibold"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {feedbackBanner && (
            <div className="px-6 pt-5" aria-live="polite">
              <div
                role="alert"
                className={
                  feedbackBanner.kind === 'error'
                    ? 'p-4 rounded-xl bg-red-950/90 border border-red-700 text-red-200 text-xs'
                    : 'p-4 rounded-xl bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs'
                }
              >
                <strong>
                  {feedbackBanner.kind === 'error' ? '◆ Atención Operativa: ' : '● Operación Exitosa: '}
                </strong>
                {feedbackBanner.text}
              </div>
            </div>
          )}

          {/* MÓDULO 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="surface-card rounded-2xl p-5 space-y-1.5">
                  <span className="text-xs text-secondary-tone">Eventos Administrados</span>
                  <p className="heading-font text-3xl font-bold">{dashboard.totalEvents} Eventos</p>
                  <p className="text-xs text-wood-accent">
                    {dashboard.confirmedEvents} Confirmados • {dashboard.draftEvents} en Borrador
                  </p>
                </div>
                <div className="surface-card rounded-2xl p-5 space-y-1.5">
                  <span className="text-xs text-secondary-tone">Volumen Presupuestal</span>
                  <p className="heading-font text-3xl font-bold">
                    ${dashboard.totalBudgetVolume.toLocaleString('en-US')}
                  </p>
                  <p className="text-xs text-emerald-500 font-semibold">
                    ● {dashboard.overallExecutionPct}% ejecutado
                  </p>
                </div>
                <div className="surface-card rounded-2xl p-5 space-y-1.5">
                  <span className="text-xs text-secondary-tone">Asistentes Confirmados (RSVP)</span>
                  <p className="heading-font text-3xl font-bold">
                    {dashboard.totalConfirmedAttendees} Lugares
                  </p>
                  <p className="text-xs text-secondary-tone">
                    {dashboard.totalTablesCount} mesas registradas en D1
                  </p>
                </div>
                <div className="rounded-2xl p-5 space-y-1.5 bg-[#3B281E] text-[#F6F3EE] border border-[#8C6245]">
                  <span className="text-xs text-[#C5A888]">Alertas Médicas Cocina</span>
                  <p className="heading-font text-3xl font-bold">
                    {dashboard.totalCriticalAllergies} Críticas
                  </p>
                  <p className="text-xs text-[#EAE3D5]/80">Protocolo activo por mesa</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 surface-card rounded-2xl p-6 space-y-4">
                  <h2 className="heading-font text-lg font-bold">
                    Módulos Operativos del Evento Activo
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('guests')}
                      className="text-left p-4 rounded-xl elevated-card hover:border-[#8C6245] cursor-pointer space-y-1"
                    >
                      <p className="heading-font text-sm font-bold text-wood-accent">
                        → 3. Invitados y Aforo de Mesas
                      </p>
                      <p className="text-secondary-tone">
                        Asignar mesas validando capacidad máxima física (1 + acompañantes).
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('catering')}
                      className="text-left p-4 rounded-xl elevated-card hover:border-[#8C6245] cursor-pointer space-y-1"
                    >
                      <p className="heading-font text-sm font-bold text-wood-accent">
                        → 4. Catering y Reporte de Alergias
                      </p>
                      <p className="text-secondary-tone">
                        Emitir orden de cocina con platillos y alergias severas por mesa.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('budget')}
                      className="text-left p-4 rounded-xl elevated-card hover:border-[#8C6245] cursor-pointer space-y-1"
                    >
                      <p className="heading-font text-sm font-bold text-wood-accent">
                        → 5. Presupuesto, Pagos y R2
                      </p>
                      <p className="text-secondary-tone">
                        Controlar semáforo financiero y contratos PDF en Cloudflare R2.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('agenda')}
                      className="text-left p-4 rounded-xl elevated-card hover:border-[#8C6245] cursor-pointer space-y-1"
                    >
                      <p className="heading-font text-sm font-bold text-wood-accent">
                        → 6. Tareas y Cronograma
                      </p>
                      <p className="text-secondary-tone">
                        Gestionar checklist operativo y detectar choques horarios.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-5 surface-card rounded-2xl p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="heading-font text-lg font-bold">Estado de Infraestructura Edge</h2>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300">
                      ● Online
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="p-3 rounded-xl elevated-card flex justify-between">
                      <span className="text-secondary-tone">Base de Datos Cloudflare D1</span>
                      <span className="font-mono font-semibold text-wood-accent">
                        planora-d1-prod
                      </span>
                    </div>
                    <div className="p-3 rounded-xl elevated-card flex justify-between">
                      <span className="text-secondary-tone">Almacenamiento Cloudflare R2</span>
                      <span className="font-mono font-semibold text-wood-accent">
                        {dashboard.contractsInR2} Contratos PDF
                      </span>
                    </div>
                    <div className="p-3 rounded-xl elevated-card flex justify-between">
                      <span className="text-secondary-tone">Sesiones &amp; Blacklist JWT (KV)</span>
                      <span className="font-mono font-semibold text-emerald-500">Activa</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="surface-card rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-wood-accent font-semibold">
                      Observabilidad APM • Sentry
                    </span>
                    <h2 className="heading-font text-lg font-bold">
                      Monitoreo de Trazas, Errores y Mensajes
                    </h2>
                  </div>
                  <span
                    className={
                      frontendSentryActive
                        ? 'text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-semibold'
                        : 'text-xs px-2.5 py-1 rounded-full elevated-card text-secondary-tone font-semibold'
                    }
                  >
                    {frontendSentryActive
                      ? `● Sentry Activo (${telemetryConfig.environment})`
                      : `○ Sentry Standby (${telemetryConfig.environment})`}
                  </span>
                </div>
                <p className="text-xs text-secondary-tone">
                  Verifica en tiempo real el envío distribuido de trazas de rendimiento, mensajes de
                  telemetría y captura de excepciones tanto en Frontend React como en la API Hono.
                </p>
                <div className="flex flex-wrap gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleApmCheck('trace-message')}
                    className="btn-trunk px-4 py-2 rounded-xl font-semibold cursor-pointer"
                  >
                    Enviar Traza + Mensaje APM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApmCheck('frontend-error')}
                    className="px-4 py-2 rounded-xl surface-card hover:border-amber-600 font-semibold cursor-pointer"
                  >
                    Probar Error Frontend (Sentry)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApmCheck('backend-error')}
                    className="px-4 py-2 rounded-xl surface-card hover:border-red-600 text-red-400 font-semibold cursor-pointer"
                  >
                    Probar Error Backend (Sentry)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MÓDULO 2: EVENTOS Y CLIENTES */}
          {activeTab === 'events' && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="surface-card rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-wood-accent font-semibold">
                      Ciclo de Vida del Evento
                    </span>
                    <h2 className="heading-font text-xl font-bold">
                      Portafolio de Eventos y Cuentas de Clientes
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloneTemplate}
                    className="btn-trunk px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    ⧉ Clonar Plantilla de Evento
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {events.map((ev) => {
                    const isSelected = ev.id === eventId;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onSelectEvent(ev.id)}
                        className={
                          isSelected
                            ? 'w-full text-left p-5 rounded-xl bg-[#3B281E] text-[#F6F3EE] border border-[#8C6245] space-y-2 cursor-pointer'
                            : 'w-full text-left p-5 rounded-xl elevated-card space-y-2 cursor-pointer hover:border-[#8C6245]'
                        }
                      >
                        <div className="flex justify-between">
                          <span className="px-2 py-0.5 rounded bg-[#0C0A09]/50 text-[#C5A888] uppercase font-semibold">
                            {ev.status}
                          </span>
                          <span>{ev.eventDate.slice(0, 10)}</span>
                        </div>
                        <p className="heading-font text-lg font-bold">{ev.title}</p>
                        <p className={isSelected ? 'text-[#EAE3D5]/80' : 'text-secondary-tone'}>
                          Cliente: {ev.clientName} ({ev.clientEmail})
                        </p>
                        <p className="text-wood-accent font-semibold pt-1">
                          Presupuesto: ${ev.initialBudget.toLocaleString('en-US')} MXN • Avance:{' '}
                          {ev.progress}%
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MÓDULO 3: INVITADOS Y MESAS */}
          {activeTab === 'guests' && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="surface-card rounded-2xl p-6 space-y-5">
                <div>
                  <span className="text-xs uppercase tracking-wider text-wood-accent font-semibold">
                    Regla CP-MES-02 • Capacidad Física por Mesa
                  </span>
                  <h2 className="heading-font text-xl font-bold">
                    Asignación de Mesas y Control de Acompañantes (+1s)
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {activeEvent.tables.map((t) => (
                    <div key={t.id} className="p-4 rounded-xl elevated-card space-y-1.5">
                      <div className="flex justify-between font-bold">
                        <span>Mesa {String(t.tableNumber).padStart(2, '0')}</span>
                        <span
                          className={
                            t.availableSeats === 0 ? 'text-wood-accent' : 'text-emerald-500'
                          }
                        >
                          {t.seated}/{t.capacity}
                        </span>
                      </div>
                      <p className="text-secondary-tone">
                        {t.label} •{' '}
                        {t.availableSeats === 0
                          ? 'Completa'
                          : `${t.availableSeats} sillas libres`}
                      </p>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleAssignGuest}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2 text-xs"
                >
                  <div>
                    <label htmlFor="adm-g-first" className="font-semibold block mb-1">
                      Nombre
                    </label>
                    <input
                      id="adm-g-first"
                      name="firstName"
                      type="text"
                      required
                      value={guestFirstName}
                      onChange={(e) => setGuestFirstName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl input-adaptive"
                    />
                  </div>
                  <div>
                    <label htmlFor="adm-g-last" className="font-semibold block mb-1">
                      Apellido
                    </label>
                    <input
                      id="adm-g-last"
                      name="lastName"
                      type="text"
                      value={guestLastName}
                      onChange={(e) => setGuestLastName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl input-adaptive"
                    />
                  </div>
                  <div>
                    <label htmlFor="adm-g-plus" className="font-semibold block mb-1">
                      Acompañantes (+1s)
                    </label>
                    <select
                      id="adm-g-plus"
                      name="plusOnes"
                      value={guestPlusOnes}
                      onChange={(e) => setGuestPlusOnes(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl input-adaptive"
                    >
                      <option value={0}>0 acompañantes (1 silla)</option>
                      <option value={1}>+1 acompañante (2 sillas)</option>
                      <option value={2}>+2 acompañantes (3 sillas)</option>
                      <option value={3}>+3 acompañantes (4 sillas)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="adm-g-table" className="font-semibold block mb-1">
                      Mesa Destino
                    </label>
                    <select
                      id="adm-g-table"
                      name="tableNumber"
                      value={guestTableNum}
                      onChange={(e) => setGuestTableNum(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl input-adaptive"
                    >
                      {activeEvent.tables.map((t) => (
                        <option key={t.id} value={t.tableNumber}>
                          Mesa {t.tableNumber} ({t.seated}/{t.capacity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full btn-trunk py-2.5 px-4 rounded-xl font-semibold cursor-pointer"
                    >
                      Asignar a Mesa
                    </button>
                  </div>
                </form>
              </div>

              <div className="surface-card rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-[var(--border-subtle)]">
                  <h3 id="admin-guests-table-caption" className="heading-font text-base font-bold">
                    Padrón Nominal de Invitados
                  </h3>
                </div>
                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby="admin-guests-table-caption"
                  className="table-wrapper"
                >
                  <table
                    className="text-xs"
                    style={
                      {
                        '--label-2': '"Estado RSVP"',
                        '--label-3': '"Lugares"',
                        '--label-4': '"Mesa"',
                        '--label-5': '"Menú y Alergias"'
                      } as React.CSSProperties
                    }
                  >
                    <thead>
                      <tr className="text-left text-secondary-tone border-b border-[var(--border-subtle)]">
                        <th className="py-3 px-5">Invitado Titular</th>
                        <th className="py-3 px-4">Estado RSVP</th>
                        <th className="py-3 px-4">Lugares</th>
                        <th className="py-3 px-4">Mesa</th>
                        <th className="py-3 px-5">Menú y Alergias</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {activeEvent.guests.map((g) => (
                        <tr key={g.id}>
                          <th scope="row" className="py-3.5 px-5 text-left font-semibold">
                            {g.fullName}
                          </th>
                          <td className="py-3.5 px-4">
                            {g.rsvpStatus === 'confirmed'
                              ? '● Confirmado'
                              : g.rsvpStatus === 'declined'
                                ? '✕ Declinado'
                                : '◌ Pendiente'}
                          </td>
                          <td className="py-3.5 px-4">
                            {g.totalSeats} asientos (1+{g.plusOnes})
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-wood-accent">
                            {g.tableNumber ? `Mesa ${String(g.tableNumber).padStart(2, '0')}` : 'Sin asignar'}
                          </td>
                          <td className="py-3.5 px-5">
                            {g.mealPreference}
                            {g.hasCriticalAllergies ? ` • ◆ ${g.allergies}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MÓDULO 4: CATERING Y ALERGIAS */}
          {activeTab === 'catering' && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="surface-card rounded-2xl p-6 space-y-5">
                <div>
                  <span className="text-xs uppercase tracking-wider text-wood-accent font-semibold">
                    Regla CP-CAT-03 • Seguridad Alimentaria
                  </span>
                  <h2 className="heading-font text-xl font-bold">
                    Reporte Consolidado de Menús y Alergias Críticas para Cocina
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {Object.entries(activeEvent.cateringReport.totalsByMenu).map(([menu, qty]) => (
                    <div key={menu} className="p-4 rounded-xl elevated-card space-y-1">
                      <span className="uppercase text-secondary-tone">{menu}</span>
                      <p className="heading-font text-2xl font-bold">{qty} Platillos</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {activeEvent.cateringReport.enrichedAlerts.map((alert) => (
                    <div
                      key={alert.guestId}
                      className="p-4 rounded-xl elevated-card border-l-4 border-l-red-600 space-y-1"
                    >
                      <span className="text-red-400 font-bold">
                        ◆ MESA {alert.tableNumber ?? 'S/A'} — {alert.allergen}
                      </span>
                      <p className="font-semibold">Comensal: {alert.guestName}</p>
                      <p className="text-secondary-tone">
                        Protocolo: {alert.dietaryRestrictions || 'Utensilios separados en cocina'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MÓDULO 5: PRESUPUESTO Y R2 */}
          {activeTab === 'budget' && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="surface-card rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-wood-accent font-semibold">
                      Exclusivo Rol Admin / Organizer (CP-FIN-01)
                    </span>
                    <h2 className="heading-font text-xl font-bold">
                      Motor de Presupuesto, Gastos y Contratos en Cloudflare R2
                    </h2>
                  </div>
                  {budgetAlertBadge()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl elevated-card">
                    <span className="text-secondary-tone">Presupuesto Inicial</span>
                    <p className="heading-font text-2xl font-bold mt-1">
                      ${activeEvent.budget.initialBudget.toLocaleString('en-US')} MXN
                    </p>
                  </div>
                  <div className="p-4 rounded-xl elevated-card">
                    <span className="text-secondary-tone">Gasto Registrado</span>
                    <p className="heading-font text-2xl font-bold mt-1">
                      ${activeEvent.budget.totalSpent.toLocaleString('en-US')} MXN
                    </p>
                  </div>
                  <div className="p-4 rounded-xl elevated-card">
                    <span className="text-secondary-tone">Balance Disponible</span>
                    <p className="heading-font text-2xl font-bold mt-1">
                      ${activeEvent.budget.remainingBalance.toLocaleString('en-US')} MXN
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleAddExpense}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-xs"
                >
                  <div className="sm:col-span-2">
                    <label htmlFor="adm-exp-concept" className="font-semibold block mb-1">
                      Concepto del Gasto
                    </label>
                    <input
                      id="adm-exp-concept"
                      name="concept"
                      type="text"
                      required
                      value={expenseConcept}
                      onChange={(e) => setExpenseConcept(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl input-adaptive"
                    />
                  </div>
                  <div>
                    <label htmlFor="adm-exp-amount" className="font-semibold block mb-1">
                      Monto (MXN)
                    </label>
                    <input
                      id="adm-exp-amount"
                      name="amount"
                      type="number"
                      min="1"
                      required
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl input-adaptive"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <select
                      aria-label="Categoría del gasto"
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="px-2 py-2 rounded-xl input-adaptive"
                    >
                      <option value="flowers">Flores</option>
                      <option value="catering">Catering</option>
                      <option value="music_dj">Audio / DJ</option>
                      <option value="contingency">Imprevisto</option>
                    </select>
                    <button
                      type="submit"
                      className="flex-1 btn-trunk py-2.5 px-3 rounded-xl font-semibold cursor-pointer"
                    >
                      + Registrar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MÓDULO 6: TAREAS Y CRONOGRAMA */}
          {activeTab === 'agenda' && (
            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 surface-card rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="heading-font text-lg font-bold">Checklist Operativo</h2>
                    <span className="text-xs font-bold text-wood-accent">
                      {activeEvent.event.progress}% Completado
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    {activeEvent.tasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl elevated-card flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="font-semibold">{t.title}</p>
                          <p className="text-secondary-tone">Vence: {t.dueDate}</p>
                        </div>
                        {t.status === 'completed' ? (
                          <span className="text-emerald-500 font-semibold">● Lista</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCompleteTask(t.id)}
                            className="btn-trunk px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                          >
                            Completar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-7 surface-card rounded-2xl p-6 space-y-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-wood-accent font-semibold">
                      Regla CP-AGE-04 • Detección Automática de Empalmes
                    </span>
                    <h2 className="heading-font text-lg font-bold">
                      Cronograma Minuto a Minuto
                    </h2>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {activeEvent.agenda.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl elevated-card flex justify-between items-center"
                      >
                        <span>
                          <strong>
                            {item.startTime} – {item.endTime}
                          </strong>{' '}
                          • {item.title} ({item.locationDetail})
                        </span>
                        <span className="text-emerald-500 font-semibold">● Validado</span>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={handleAddAgendaBlock}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 text-xs"
                  >
                    <div className="sm:col-span-2">
                      <label htmlFor="adm-ag-title" className="font-semibold block mb-1">
                        Actividad
                      </label>
                      <input
                        id="adm-ag-title"
                        type="text"
                        required
                        value={agendaTitle}
                        onChange={(e) => setAgendaTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl input-adaptive"
                      />
                    </div>
                    <div>
                      <label htmlFor="adm-ag-start" className="font-semibold block mb-1">
                        Inicio / Fin
                      </label>
                      <div className="flex gap-1">
                        <input
                          id="adm-ag-start"
                          aria-label="Hora inicio"
                          type="text"
                          value={agendaStart}
                          onChange={(e) => setAgendaStart(e.target.value)}
                          className="w-1/2 px-2 py-2 rounded-xl input-adaptive"
                        />
                        <input
                          aria-label="Hora fin"
                          type="text"
                          value={agendaEnd}
                          onChange={(e) => setAgendaEnd(e.target.value)}
                          className="w-1/2 px-2 py-2 rounded-xl input-adaptive"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="adm-ag-loc" className="font-semibold block mb-1">
                        Escenario
                      </label>
                      <input
                        id="adm-ag-loc"
                        type="text"
                        required
                        value={agendaLocation}
                        onChange={(e) => setAgendaLocation(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl input-adaptive"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <button
                        type="submit"
                        className="w-full btn-trunk py-2.5 px-4 rounded-xl font-semibold cursor-pointer"
                      >
                        + Agregar Bloque al Cronograma (Validar Choques Horarios)
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
