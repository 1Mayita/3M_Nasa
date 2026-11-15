import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import AtlasApp from './atlas/AtlasApp.jsx';

const App = React.lazy(() => import('./App.jsx'));

// Pantalla principal: atlas 3D. El calendario original sigue en #clasico.
function Root() {
  const [hash, setHash] = React.useState(window.location.hash);
  React.useEffect(function listen() {
    function onChange() {
      setHash(window.location.hash);
    }
    window.addEventListener('hashchange', onChange);
    return function cleanup() {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  if (hash === '#clasico') {
    return (
      <>
        <a href="#" style={{ position: 'fixed', top: 8, right: 12, zIndex: 10, fontSize: 13 }}>← Atlas 3D</a>
        <React.Suspense fallback={null}>
          <App />
        </React.Suspense>
      </>
    );
  }
  return <AtlasApp />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);

// Service worker (solo producción): muestra /offline.html cuando no hay red. Ver public/sw.js.
// Se registra de inmediato: el mapa sigue cargando mosaicos y el evento "load" puede tardar mucho.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  try {
    navigator.serviceWorker.register('/sw.js').catch(function ignore() {});
  } catch (e) {
    // sin service worker la app funciona igual
  }
}

// Aviso instantáneo sin conexión: la pantalla del astronauta (offline.html) se descarga al abrir la web
// y, en cuanto se corta el internet, se pone encima de todo sin cambiar de página. Al volver la conexión se quita sola.
if (import.meta.env.PROD) {
  let offlineHtml = null;
  fetch('/offline.html', { cache: 'no-cache' })
    .then(function read(response) { return response.ok ? response.text() : null; })
    .then(function keep(text) { offlineHtml = text; if (!navigator.onLine) { showOffline(); } })
    .catch(function ignore() {});

  const showOffline = function showOffline() {
    if (!offlineHtml || document.getElementById('offline-overlay')) {
      return;
    }
    const frame = document.createElement('iframe');
    frame.id = 'offline-overlay';
    frame.title = 'Sin conexión';
    frame.setAttribute('srcdoc', offlineHtml);
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483647;background:#0b1530';
    document.body.appendChild(frame);
    frame.focus();
  };
  const hideOffline = function hideOffline() {
    const frame = document.getElementById('offline-overlay');
    if (frame) {
      frame.remove();
    }
  };
  window.addEventListener('offline', showOffline);
  window.addEventListener('online', hideOffline);
  // Respaldo por si el navegador no avisa: revisa el estado cada 2 s
  window.setInterval(function check() {
    if (!navigator.onLine) {
      showOffline();
    } else {
      hideOffline();
    }
  }, 2000);
}
