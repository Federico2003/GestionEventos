import React, { useState } from 'react';
import { ThemeToggleButton } from '../context/ThemeContext';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);

  const handleEmailBlur = () => {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('Ingresa un correo electrónico con formato válido.');
    }
  };

  const handleCustomImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setCustomBgUrl(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    setFieldError(null);
    setIsSubmitting(true);

    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'No fue posible iniciar sesión con las credenciales ingresadas.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Barra superior minimalista con conmutador Sol / Luna */}
      <header className="topbar-surface px-6 md:px-10 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#5C3E2B] border border-[#8C6245] flex items-center justify-center heading-font font-bold text-[#F6F3EE] text-sm">
            P
          </div>
          <span className="heading-font font-bold tracking-[0.18em] text-sm">PLANORA</span>
        </div>
        <ThemeToggleButton />
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* Columna Izquierda: Identidad de Marca */}
        <section className="lg:col-span-5 login-left-panel p-8 md:p-12 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5C3E2B] border border-[#8C6245] flex items-center justify-center heading-font font-bold text-[#F6F3EE] text-xl">
              P
            </div>
            <div>
              <span className="heading-font font-bold tracking-[0.2em] text-lg block leading-none">
                PLANORA
              </span>
              <span className="text-xs text-wood-accent font-medium">
                Event Management &amp; Financial Control
              </span>
            </div>
          </div>

          <div className="space-y-4 my-10 max-w-md">
            <h1 className="heading-font text-3xl md:text-4xl font-bold leading-tight">
              Tu centro de control para eventos extraordinarios.
            </h1>
            <p className="text-sm text-secondary-tone">
              Gestión integral de invitados, asignación de mesas, control gastronómico de alergias,
              presupuestos y cronograma minuto a minuto.
            </p>
          </div>

          <div className="pt-6 border-t border-[var(--border-subtle)] text-xs text-wood-accent font-medium">
            PLANORA • Plataforma de Gestión y Logística de Eventos
          </div>
        </section>

        {/* Columna Derecha: Fondo de Evento de Gala + Tarjeta Minimalista Iniciar Sesión */}
        <section
          className="lg:col-span-7 relative p-6 md:p-14 flex items-center justify-center overflow-hidden"
          style={
            customBgUrl
              ? {
                  backgroundImage: `url('${customBgUrl}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }
              : undefined
          }
        >
          {!customBgUrl && (
            <svg
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover"
              viewBox="0 0 1200 900"
              preserveAspectRatio="xMidYMid slice"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <radialGradient id="warmGlow1" cx="50%" cy="25%" r="60%">
                  <stop offset="0%" stopColor="#9C7A5B" stopOpacity="0.65" />
                  <stop offset="50%" stopColor="#4A3525" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#171412" stopOpacity="0.95" />
                </radialGradient>
                <radialGradient id="bokehLight" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFFDF9" stopOpacity="0.95" />
                  <stop offset="40%" stopColor="#D8BC9C" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#8C6245" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="1200" height="900" fill="#171412" />
              <rect width="1200" height="900" fill="url(#warmGlow1)" />
              <path
                d="M80,900 L80,340 A190,190 0 0,1 460,340 L460,900 Z"
                fill="none"
                stroke="#8C6245"
                strokeWidth="3"
                opacity="0.5"
              />
              <path
                d="M410,900 L410,300 A210,210 0 0,1 830,300 L830,900 Z"
                fill="none"
                stroke="#C5A888"
                strokeWidth="3"
                opacity="0.55"
              />
              <path
                d="M760,900 L760,340 A190,190 0 0,1 1140,340 L1140,900 Z"
                fill="none"
                stroke="#8C6245"
                strokeWidth="3"
                opacity="0.5"
              />
              <line x1="270" y1="0" x2="270" y2="210" stroke="#C5A888" strokeWidth="1.5" opacity="0.5" />
              <line x1="620" y1="0" x2="620" y2="170" stroke="#C5A888" strokeWidth="2" opacity="0.6" />
              <line x1="950" y1="0" x2="950" y2="220" stroke="#C5A888" strokeWidth="1.5" opacity="0.5" />
              <circle cx="270" cy="220" r="60" fill="url(#bokehLight)" />
              <circle cx="620" cy="180" r="80" fill="url(#bokehLight)" />
              <circle cx="950" cy="230" r="60" fill="url(#bokehLight)" />
              <ellipse
                cx="280"
                cy="790"
                rx="220"
                ry="42"
                fill="#2A1C14"
                stroke="#8C6245"
                strokeWidth="1.5"
                opacity="0.8"
              />
              <ellipse
                cx="920"
                cy="800"
                rx="230"
                ry="45"
                fill="#2A1C14"
                stroke="#8C6245"
                strokeWidth="1.5"
                opacity="0.8"
              />
              <ellipse
                cx="600"
                cy="840"
                rx="280"
                ry="52"
                fill="#241811"
                stroke="#C5A888"
                strokeWidth="1.5"
                opacity="0.85"
              />
            </svg>
          )}

          <div className="absolute inset-0 login-overlay-surface" />

          <label className="absolute bottom-4 right-4 z-20 px-3 py-1.5 rounded-xl surface-card text-wood-accent hover:border-[#8C6245] text-xs cursor-pointer shadow-md">
            <span>📷 Cambiar imagen de evento</span>
            <input
              type="file"
              accept="image/*"
              className="visually-hidden"
              onChange={handleCustomImage}
            />
          </label>

          {/* Tarjeta Minimalista de Iniciar Sesión */}
          <div className="relative z-10 w-full max-w-md rounded-2xl p-8 md:p-10 shadow-2xl space-y-6 login-card-surface">
            <div className="space-y-1 text-center">
              <span className="text-xs uppercase tracking-[0.22em] text-wood-accent font-semibold">
                PLANORA
              </span>
              <h2 className="heading-font text-2xl md:text-3xl font-bold">Iniciar Sesión</h2>
            </div>

            <form
              action="/api/v1/auth/login"
              method="POST"
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <div>
                <label htmlFor="login-email" className="text-xs font-semibold block mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  enterKeyHint="next"
                  required
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError) setFieldError(null);
                    if (submitError) setSubmitError(null);
                  }}
                  onBlur={handleEmailBlur}
                  aria-describedby={fieldError ? 'login-email-error' : undefined}
                  className="w-full px-4 py-3 rounded-xl input-adaptive"
                />
                {fieldError && (
                  <p
                    id="login-email-error"
                    aria-live="polite"
                    className="mt-1.5 text-xs text-red-400 font-medium"
                  >
                    <span aria-hidden="true">◆ </span>
                    {fieldError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="login-password" className="text-xs font-semibold block mb-1.5">
                  Contraseña
                </label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  enterKeyHint="done"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (submitError) setSubmitError(null);
                  }}
                  className="w-full px-4 py-3 rounded-xl input-adaptive"
                />
              </div>

              <div aria-live="polite">
                {submitError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-red-950/90 border border-red-700 text-red-200 text-xs"
                  >
                    <span aria-hidden="true">◆ </span>
                    <span>{submitError}</span>
                  </div>
                )}
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-trunk py-3.5 px-5 rounded-xl text-sm font-semibold shadow-lg cursor-pointer"
                >
                  {isSubmitting ? 'Ingresando...' : 'Ingresar'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};
