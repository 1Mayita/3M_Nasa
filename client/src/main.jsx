import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import App from './App.jsx';
import AtlasApp from './atlas/AtlasApp.jsx';

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
        <App />
      </>
    );
  }
  return <AtlasApp />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);
