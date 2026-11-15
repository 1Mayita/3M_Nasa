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
  // Si se corta el internet con la página abierta, se muestra la página del astronauta
  // (el service worker la sirve desde su caché) y al volver la conexión regresa a donde estaba.
  window.addEventListener('offline', function goOffline() {
    if (navigator.serviceWorker.controller) {
      window.location.assign('/offline.html?volver=' + encodeURIComponent(window.location.hash || ''));
    }
  });
}
