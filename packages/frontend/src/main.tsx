import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initFrontendSentry, SentryErrorBoundary } from './monitoring/sentry';
import './styles/theme.css';

initFrontendSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SentryErrorBoundary
      fallback={({ resetError }) => (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="surface-card rounded-2xl p-8 max-w-md text-center space-y-4">
            <h1 className="heading-font text-xl font-bold">
              Se detectó un error inesperado en la interfaz
            </h1>
            <p className="text-sm text-secondary-tone">
              El incidente fue reportado automáticamente al monitoreo APM de Sentry.
            </p>
            <button
              type="button"
              onClick={resetError}
              className="btn-trunk px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
            >
              Reintentar vista
            </button>
          </div>
        </div>
      )}
    >
      <App />
    </SentryErrorBoundary>
  </React.StrictMode>
);
