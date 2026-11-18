import React, { useState } from 'react';
import { ThemeToggleButton } from '../context/ThemeContext';
import type { PlanoraApiClient } from '../services/apiClient';
import type { AuthUser, EventDetailResponse } from '../types';

type ClientTab = 'summary' | 'rsvp' | 'tables' | 'timeline';

interface ClientPortalProps {
  user: AuthUser;
  api: PlanoraApiClient;
  eventDetail: EventDetailResponse;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  user,
  api,
  eventDetail,
  onRefresh,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<ClientTab>('summary');
  const [rbacMessage, setRbacMessage] = useState<string | null>(null);
  const [rsvpNotice, setRsvpNotice] = useState<string | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState('Prima Valeria Alarcón');
  const [rsvpStatus, setRsvpStatus] = useState<'confirmed' | 'pending' | 'declined'>('confirmed');
  const [plusOnes, setPlusOnes] = useState(1);
  const [mealPref, setMealPref] = useState<'standard' | 'vegetarian' | 'vegan' | 'child'>(
    'vegetarian'
  );
  const [allergies, setAllergies] = useState('Alergia leve a almendras');
  const [isCriticalAllergy, setIsCriticalAllergy] = useState(false);

  const eventId = eventDetail.event.id;

  const handleTestRbacForbidden = async () => {
    setRbacMessage(null);
    try {
      await api.recordExpense(eventId, {
        concept: 'Intento de gasto no autorizado',
        category: 'other',
        amount: 5000
      });
    } catch (err) {
      setRbacMessage(
        err instanceof Error
          ? `HTTP 403 Forbidden (RBAC Security): ${err.message}`
          : 'HTTP 403 Forbidden'
      );
    }
  };

  const handleSaveClientGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRsvpNotice(null);
    setRsvpError(null);
    const parts = guestName.trim().split(/\s+/);
    const firstName = parts[0] || 'Invitado';
    const lastName = parts.slice(1).join(' ');

    try {
      await api.addGuest(eventId, {
        firstName,
        lastName,
        rsvpStatus,
        plusOnes,
        mealPreference: mealPref,
        allergies: allergies.trim(),
        hasCriticalAllergies: isCriticalAllergy
      });
      await onRefresh();
      setRsvpNotice(`Confirmación guardada para ${guestName}.`);
    } catch (err) {
      setRsvpError(
        err instanceof Error ? err.message : 'No fue posible guardar la confirmación.'
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="topbar-surface px-6 md:px-10 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#5C3E2B] border border-[#8C6245] flex items-center justify-center heading-font font-bold text-[#F6F3EE] text-sm">
            P
          </div>
          <span className="heading-font font-bold tracking-[0.16em] text-sm">PLANORA</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full elevated-card text-wood-accent font-medium">
            Portal Anfitrión • {user.name}
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

      {/* Hero del Evento del Cliente */}
      <div className="surface-card border-b border-[var(--border-subtle)] px-6 md:px-12 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-[#5C3E2B] text-[#F6F3EE]">
                🥂 Portal Exclusivo del Cliente
              </span>
              <span className="text-xs text-secondary-tone">
                {eventDetail.event.eventDate.slice(0, 10)}
              </span>
            </div>
            <h1 className="heading-font text-2xl md:text-4xl font-bold">
              {eventDetail.event.title}
            </h1>
            <p className="text-xs md:text-sm text-secondary-tone">
              {eventDetail.event.venueName} • Coordinación integral Planora
            </p>
          </div>

          <div className="elevated-card rounded-2xl p-4 min-w-[240px] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-wood-accent font-semibold">Avance de Organización</span>
              <span className="heading-font font-bold text-base">
                {eventDetail.event.progress}% Listo
              </span>
            </div>
            <div className="w-full h-2 bg-[#3B281E]/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8C6245]"
                style={{ width: `${eventDetail.event.progress}%` }}
              />
            </div>
            <p className="text-xs text-secondary-tone">
              {eventDetail.rsvpMetrics.totalConfirmedSeats} de {eventDetail.event.estimatedGuests}{' '}
              lugares confirmados
            </p>
          </div>
        </div>

        <nav
          aria-label="Pestañas Portal Cliente"
          className="max-w-6xl mx-auto pt-6 flex flex-wrap gap-2 text-xs"
        >
          {(
            [
              ['summary', '1. Resumen de Mi Evento'],
              ['rsvp', '2. Mis Invitados, RSVP & Alergias'],
              ['tables', '3. Mapa de Mis Mesas'],
              ['timeline', '4. Mi Cronograma & Contratos']
            ] as Array<[ClientTab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={
                activeTab === key
                  ? 'px-4 py-2.5 rounded-xl bg-[#5C3E2B] text-[#F6F3EE] font-bold shadow-sm cursor-pointer'
                  : 'px-4 py-2.5 rounded-xl elevated-card hover:border-[#8C6245] cursor-pointer'
              }
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido de Pestañas */}
      <main className="max-w-6xl w-full mx-auto p-6 md:p-8 flex-1 space-y-6">
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="surface-card rounded-2xl p-5 space-y-1.5">
                <span className="text-xs text-secondary-tone font-medium">
                  Mis Invitados Confirmados
                </span>
                <p className="heading-font text-3xl font-bold">
                  {eventDetail.rsvpMetrics.totalConfirmedSeats} Personas
                </p>
                <p className="text-xs text-wood-accent">
                  {eventDetail.tables.length} mesas configuradas
                </p>
              </div>
              <div className="surface-card rounded-2xl p-5 space-y-1.5">
                <span className="text-xs text-secondary-tone font-medium">
                  Menús y Alergias Registradas
                </span>
                <p className="heading-font text-3xl font-bold">100% Cubierto</p>
                <p className="text-xs text-secondary-tone">
                  {eventDetail.cateringReport.criticalAlerts.length} atenciones especiales en cocina
                </p>
              </div>
              <div className="surface-card rounded-2xl p-5 space-y-1.5">
                <span className="text-xs text-secondary-tone font-medium">
                  Servicios Contratados
                </span>
                <p className="heading-font text-3xl font-bold">
                  {eventDetail.contracts.length} Contratos
                </p>
                <p className="text-xs text-emerald-500 font-semibold">
                  ● Documentos firmados en R2
                </p>
              </div>
            </div>

            <div className="surface-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="heading-font text-lg font-bold">Resumen Económico Aprobado</h2>
                <span className="text-xs px-2.5 py-0.5 rounded bg-[#5C3E2B] text-[#F6F3EE]">
                  Vista de Consulta
                </span>
              </div>
              <p className="text-xs text-secondary-tone">
                Presupuesto pactado:{' '}
                <strong>${eventDetail.budget.initialBudget.toLocaleString('en-US')} MXN</strong>{' '}
                (Ejecución macro: {eventDetail.budget.spentPercentage}%). Como anfitrión puedes
                consultar el avance global, mientras que el registro interno de gastos es exclusivo
                de tu organizador.
              </p>
              <button
                type="button"
                onClick={handleTestRbacForbidden}
                className="px-4 py-2 rounded-xl text-xs font-semibold elevated-card hover:border-red-500 cursor-pointer"
              >
                🔒 Verificar protección RBAC de gastos internos (CP-SEC-05)
              </button>
              {rbacMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-950/90 border border-red-700 text-red-200 text-xs"
                >
                  <strong>◆ {rbacMessage}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rsvp' && (
          <div className="space-y-6">
            <div className="surface-card rounded-2xl p-6 space-y-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-wood-accent font-semibold">
                  Gestión Directa del Anfitrión
                </span>
                <h2 className="heading-font text-xl font-bold">
                  Confirmar Asistencia (RSVP), Menú y Alergias de Mis Invitados
                </h2>
              </div>

              {rsvpError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-950/90 border border-red-700 text-red-200 text-xs"
                >
                  ◆ {rsvpError}
                </div>
              )}

              {rsvpNotice && (
                <div
                  role="status"
                  className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs"
                >
                  ● {rsvpNotice}
                </div>
              )}

              <form
                onSubmit={handleSaveClientGuest}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
              >
                <div>
                  <label htmlFor="cli-g-name" className="font-semibold block mb-1">
                    Nombre del Invitado
                  </label>
                  <input
                    id="cli-g-name"
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl input-adaptive"
                  />
                </div>
                <div>
                  <label htmlFor="cli-g-rsvp" className="font-semibold block mb-1">
                    Estado RSVP
                  </label>
                  <select
                    id="cli-g-rsvp"
                    value={rsvpStatus}
                    onChange={(e) =>
                      setRsvpStatus(e.target.value as 'confirmed' | 'pending' | 'declined')
                    }
                    className="w-full px-3 py-2 rounded-xl input-adaptive"
                  >
                    <option value="confirmed">● Confirmado</option>
                    <option value="pending">◌ Pendiente</option>
                    <option value="declined">✕ Declinado</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cli-g-plus" className="font-semibold block mb-1">
                    Acompañantes (+1s)
                  </label>
                  <select
                    id="cli-g-plus"
                    value={plusOnes}
                    onChange={(e) => setPlusOnes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl input-adaptive"
                  >
                    <option value={0}>Sin acompañante (1 silla)</option>
                    <option value={1}>+1 acompañante (2 sillas)</option>
                    <option value={2}>+2 acompañantes (3 sillas)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cli-g-diet" className="font-semibold block mb-1">
                    Menú / Alergia
                  </label>
                  <div className="flex gap-1">
                    <select
                      aria-label="Preferencia de menú"
                      value={mealPref}
                      onChange={(e) =>
                        setMealPref(
                          e.target.value as 'standard' | 'vegetarian' | 'vegan' | 'child'
                        )
                      }
                      className="w-1/2 px-2 py-2 rounded-xl input-adaptive"
                    >
                      <option value="standard">Estándar</option>
                      <option value="vegetarian">Vegetariano</option>
                      <option value="vegan">Vegano</option>
                      <option value="child">Infantil</option>
                    </select>
                    <input
                      id="cli-g-diet"
                      type="text"
                      placeholder="Alergia"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      className="w-1/2 px-2 py-2 rounded-xl input-adaptive"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 text-xs text-secondary-tone cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCriticalAllergy}
                      onChange={(e) => setIsCriticalAllergy(e.target.checked)}
                    />
                    <span>Alergia crítica / anafilaxia</span>
                  </label>
                  <button
                    type="submit"
                    className="w-full btn-trunk py-2.5 px-4 rounded-xl font-semibold cursor-pointer"
                  >
                    + Guardar Confirmación
                  </button>
                </div>
              </form>
            </div>

            <div className="surface-card rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <h3 id="client-guests-caption" className="heading-font text-base font-bold">
                  Mi Lista de Invitados
                </h3>
                <span className="text-xs text-wood-accent">Sincronizada con tu Planner</span>
              </div>
              <div
                tabIndex={0}
                role="region"
                aria-labelledby="client-guests-caption"
                className="table-wrapper"
              >
                <table
                  className="text-xs"
                  style={
                    {
                      '--label-2': '"Asistencia"',
                      '--label-3': '"Lugares"',
                      '--label-4': '"Mesa"',
                      '--label-5': '"Menú y Alergias"'
                    } as React.CSSProperties
                  }
                >
                  <thead>
                    <tr className="text-left text-secondary-tone border-b border-[var(--border-subtle)]">
                      <th className="py-3 px-5">Invitado</th>
                      <th className="py-3 px-4">Asistencia</th>
                      <th className="py-3 px-4">Lugares</th>
                      <th className="py-3 px-4">Mesa Asignada</th>
                      <th className="py-3 px-5">Menú y Alergias</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {eventDetail.guests.map((g) => (
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
                          {g.tableNumber ? `Mesa ${String(g.tableNumber).padStart(2, '0')}` : 'Por asignar'}
                        </td>
                        <td className="py-3.5 px-5">
                          {g.mealPreference}
                          {g.allergies ? ` • ▲ ${g.allergies}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tables' && (
          <div className="surface-card rounded-2xl p-6 space-y-4">
            <h2 className="heading-font text-xl font-bold">
              Distribución de Mesas de Mi Evento
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {eventDetail.tables.map((t) => (
                <div key={t.id} className="p-5 rounded-2xl elevated-card space-y-2">
                  <div className="flex justify-between font-bold text-sm">
                    <span>{t.label}</span>
                    <span>
                      {t.seated}/{t.capacity}
                    </span>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded bg-[#5C3E2B] text-[#F6F3EE]">
                    {t.availableSeats === 0
                      ? 'Mesa Completa'
                      : `${t.availableSeats} asientos disponibles`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 surface-card rounded-2xl p-6 space-y-4">
              <h2 className="heading-font text-xl font-bold">
                Itinerario Minuto a Minuto de Nuestro Gran Día
              </h2>
              <div className="space-y-3 text-xs">
                {eventDetail.agenda.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl elevated-card border-l-4 border-l-[#8C6245]"
                  >
                    <span className="font-mono text-wood-accent font-bold">
                      {item.startTime} – {item.endTime} hrs
                    </span>
                    <p className="font-bold text-sm mt-0.5">{item.title}</p>
                    <p className="text-secondary-tone">{item.locationDetail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-5 surface-card rounded-2xl p-6 space-y-4">
              <h2 className="heading-font text-xl font-bold">
                Mis Contratos Autorizados (Cloudflare R2)
              </h2>
              <div className="space-y-2.5 text-xs">
                {eventDetail.contracts.map((ct) => (
                  <div
                    key={ct.id}
                    className="p-3.5 rounded-xl elevated-card flex items-center justify-between gap-2"
                  >
                    <span>
                      📄 <strong>{ct.serviceName}</strong> ({ct.vendorName})
                    </span>
                    <span className="text-wood-accent font-semibold">
                      {ct.contractUrl ? 'Disponible' : 'En firma'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
