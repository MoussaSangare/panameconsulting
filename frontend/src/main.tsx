import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ToastContainer } from 'react-toastify';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

const GlobalToastContainer = () => (
  <ToastContainer
    position='top-right'
    autoClose={3000}
    hideProgressBar={false}
    newestOnTop={true}
    closeOnClick
    pauseOnHover
    draggable
    theme='light'
    limit={1}
    pauseOnFocusLoss={false}
  />
);

// Vérification que nous sommes dans un environnement browser
if (typeof window !== 'undefined') {
  const rootElement = document.getElementById('root');

  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <HelmetProvider>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <AuthProvider>
              <App />
              <GlobalToastContainer />
            </AuthProvider>
          </BrowserRouter>
        </HelmetProvider>
      </React.StrictMode>
    );
  } else {
    // Gestion d'erreur silencieuse en développement uniquement
    if (import.meta.env.DEV) {
      console.error("Élément 'root' non trouvé dans le DOM");
    }
  }
}
