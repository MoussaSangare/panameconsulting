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
    newestOnTop={false}
    closeOnClick={true}
    rtl={false}
    pauseOnFocusLoss={false}
    draggable={true}
    pauseOnHover={true}
    theme='light'
    limit={1}
    toastClassName='toast-custom'
    bodyClassName='toast-body'
    progressClassName='toast-progress'
  />
);

// Vérification robuste du DOM
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Élément 'root' non trouvé dans le DOM");
}

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