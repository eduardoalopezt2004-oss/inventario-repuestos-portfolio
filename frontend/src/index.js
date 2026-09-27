import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'admin-lte/dist/js/adminlte.min.js';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Activa el service worker de Workbox para soporte offline (solo en producción/build)
serviceWorkerRegistration.register();

// Recarga la página una sola vez cuando el service worker activa una nueva
// versión, para que el usuario siempre vea el bundle más reciente sin tener
// que cerrar todas las pestañas manualmente.
if ('serviceWorker' in navigator) {
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });
}
