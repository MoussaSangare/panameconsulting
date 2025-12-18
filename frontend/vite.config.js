import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  
  // Configuration du serveur de développement
  server: {
    host: true, // Permet l'accès depuis le réseau local
    open: true, // Ouvre le navigateur automatiquement
    proxy: mode === 'development' ? {
      '/api': {
        target: 'http://localhost:10000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/auth': {
        target: 'http://localhost:10000',
        changeOrigin: true,
        secure: false,
      }
    } : undefined,
  },
  
  // Configuration du build
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'react-toastify'],
          'date-vendor': ['date-fns', 'date-fns/locale/fr'],
          'admin': [
            './src/pages/admin/AdminDashboard.tsx',
            './src/pages/admin/UsersManagement.tsx',
            './src/pages/admin/AdminMessages.tsx',
            './src/pages/admin/AdminProfile.tsx',
            './src/pages/admin/AdminProcedure.tsx',
            './src/pages/admin/AdminDestinations.tsx'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    // Optimisations pour la production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true,
      },
    },
  },
  
  // Optimisation des dépendances
  optimizeDeps: {
    include: [
      'date-fns',
      'date-fns/locale/fr',
      '@heroicons/react/24/outline', 
      'react-icons/fi'
    ],
    exclude: ['date-fns-tz']
  },
  
  // Configuration spécifique à l'environnement
  base: mode === 'production' ? '/' : '/',
  
  // Variables d'environnement
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
    __VITE_MODE__: JSON.stringify(mode),
  },
  
  // Préréndu pour améliorer les performances en production
  ssr: mode === 'production' ? {
    noExternal: ['react-icons', 'lucide-react'],
  } : undefined,
}));