import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (typeof globalThis.console !== 'undefined') {
      globalThis.console.error(
        'Erreur capturée par ErrorBoundary:',
        error,
        errorInfo
      );
    }

    // Handle DOM manipulation errors silently (common with third-party libraries)
    if (
      error.message.includes('removeChild') ||
      error.message.includes('Node') ||
      error.name === 'NotFoundError'
    ) {
      if (typeof globalThis.console !== 'undefined') {
        globalThis.console.warn(
          'DOM manipulation error detected, attempting recovery...'
        );
      }
      // Try to recover by refreshing AOS if available
      if (
        typeof globalThis.window !== 'undefined' &&
        (globalThis.window as any).AOS
      ) {
        globalThis.setTimeout(() => {
          (globalThis.window as any).AOS.refresh();
        }, 100);
      }
      return;
    }

    // Log l'erreur silencieusement sans afficher d'alerte
    if (
      error.message.includes('500') ||
      error.message.includes('Internal Server Error')
    ) {
      if (typeof globalThis.console !== 'undefined') {
        globalThis.console.warn(
          'Erreur serveur détectée, tentative de récupération automatique...'
        );
      }
      // Ne pas afficher l'erreur à l'utilisateur pour les erreurs 500
      return;
    }

    this.setState({ error, errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  public render() {
    if (this.state.hasError) {
      // Si c'est une erreur 500, ne pas afficher l'interface d'erreur
      if (
        this.state.error?.message.includes('500') ||
        this.state.error?.message.includes('Internal Server Error')
      ) {
        return this.props.children;
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className='min-h-screen bg-gray-50 flex items-center justify-center p-4'>
          <div className='max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center'>
            <div className='mb-4'>
              <AlertTriangle className='w-16 h-16 text-red-500 mx-auto' />
            </div>
            <h1 className='text-xl font-semibold text-gray-900 mb-2'>
              Oups ! Quelque chose s'est mal passé
            </h1>
            <p className='text-gray-600 mb-6'>
              Une erreur inattendue s'est produite. Veuillez réessayer.
            </p>

            <div className='space-y-3'>
              <button
                onClick={this.handleRetry}
                className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors'
              >
                <RefreshCw className='w-4 h-4' />
                Réessayer
              </button>

              <Link
                to='/'
                className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors'
              >
                <Home className='w-4 h-4' />
                Retour à l'accueil
              </Link>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className='mt-6 text-left'>
                <summary className='cursor-pointer text-sm text-gray-500 hover:text-gray-700'>
                  Détails de l'erreur (développement)
                </summary>
                <div className='mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700 overflow-auto'>
                  <div className='mb-2'>
                    <strong>Erreur:</strong> {this.state.error.toString()}
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className='whitespace-pre-wrap mt-1'>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
