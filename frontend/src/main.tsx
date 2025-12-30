import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import './index.css';

const GlobalToastContainer = () => (
  <ToastContainer
    position='top-right'
    autoClose={3000}
    hideProgressBar={false}
    newestOnTop={false}
    closeOnClick={true}
    rtl={false}
    pauseOnFocusLoss={false}
    draggable={true}
    pauseOnHover={true}
    theme='light'
  />
);

// Vérification robuste du DOM
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Élément 'root' non trouvé dans le DOM");
}

// React 19 : createRoot est toujours la méthode recommandée
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <GlobalToastContainer />
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);