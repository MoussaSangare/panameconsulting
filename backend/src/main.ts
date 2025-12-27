import {
  ValidationPipe,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  NestExpressApplication,
  ExpressAdapter,
} from "@nestjs/platform-express";
import * as express from "express";
import * as fs from "fs";
import helmet from "helmet";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import { join } from "path";
import { AppModule } from "./app.module";

// 📦 ÉTENDRE L'INTERFACE REQUEST D'EXPRESS
declare global {
  namespace Express {
    interface Request {
      invalidJson?: boolean;
      isPublicRoute?: boolean;
      requestId?: string;
      startTime?: number;
    }
  }
}

// 🔧 Configuration
const isProduction = process.env.NODE_ENV === 'production';
const logger = new Logger("Bootstrap");

// 🌐 ORIGINES AUTORISÉES UNIQUEMENT
const productionOrigins = [
  "https://panameconsulting.com",
  "https://www.panameconsulting.com",
  "https://panameconsulting.vercel.app",
  "https://panameconsulting.up.railway.app",
  "https://vercel.live",
  "http://localhost:5713",
  "http://localhost:10000",
];

// Utiliser la même liste pour tous les environnements
const allowedOrigins = productionOrigins;

// Fonction pour générer un ID de requête unique
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

async function bootstrap() {
  try {
    logger.log("🚀 Démarrage du serveur API...");
    logger.log(`🌍 Environnement: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    logger.log(`📋 Origines autorisées: ${JSON.stringify(allowedOrigins)}`);

    // 🔧 Configuration Express
    const server = express();

    // ✅ MIDDLEWARE: ID de requête
    server.use((req: express.Request, _res: express.Response, next) => {
      req.requestId = generateRequestId();
      req.startTime = Date.now();
      next();
    });

    // ✅ MIDDLEWARE: Compression GZIP
    server.use(compression());

    // ✅ MIDDLEWARE: Cookie Parser
    server.use(cookieParser(process.env.COOKIE_SECRET));

    // ✅ MIDDLEWARE: Parsing JSON avec validation
    server.use(express.json({
      limit: '10mb',
      verify: (req: express.Request, _res: express.Response, buf: Buffer, encoding: BufferEncoding) => {
        try {
          if (buf && buf.length) {
            JSON.parse(buf.toString(encoding || 'utf8'));
          }
        } catch {
          req.invalidJson = true;
        }
      }
    }));

    // ✅ MIDDLEWARE: URL-encoded data
    server.use(express.urlencoded({
      limit: '10mb',
      extended: true,
      parameterLimit: 1000
    }));

    // ✅ MIDDLEWARE: Text data
    server.use(express.text({
      limit: '1mb',
      type: 'text/plain'
    }));

    // ✅ CRÉATION DE L'APPLICATION NEST
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(server),
      {
        logger: isProduction 
          ? ['error', 'warn', 'log'] 
          : ['error', 'warn', 'log', 'debug', 'verbose'],
        bufferLogs: true,
        abortOnError: false,
      },
    );

    // ✅ MIDDLEWARE: Sécurité Helmet
    const cspDirectives = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...allowedOrigins],
      frameSrc: ["'self'", "https://vercel.live"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    };

    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: cspDirectives,
        },
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: "same-origin" },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        },
        frameguard: { action: 'deny' },
        hidePoweredBy: true,
        noSniff: true,
        xssFilter: true,
      }),
    );

    // ✅ MIDDLEWARE: Headers de sécurité additionnels
    app.use((_req: express.Request, res: express.Response, next) => {
      res.removeHeader("X-Powered-By");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
      res.setHeader("X-Request-ID", _req.requestId || '');
      next();
    });

    // ✅ MIDDLEWARE: Validation JSON
    app.use((req: express.Request, res: express.Response, next) => {
      if (req.invalidJson) {
        return res.status(400).json({
          error: 'Invalid JSON payload',
          message: 'Le corps de la requête contient du JSON invalide',
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        });
      }
      next();
    });

    // ✅ CONFIGURATION CORS STRICTE
    app.enableCors({
      origin: (origin, callback) => {
        // CORRECTION : Autoriser les requêtes sans origine (curl, scripts, etc.)
        if (!origin) {
          logger.debug(`✅ No origin (server-to-server request)`);
          return callback(null, true);
        }

        // Vérifier si l'origine est dans la liste autorisée
        const isAllowed = allowedOrigins.includes(origin);
        
        if (isAllowed) {
          logger.debug(`✅ Origin allowed: ${origin}`);
          return callback(null, true);
        }

        // Bloquer toutes les autres origines
        logger.warn(`❌ Origin blocked: ${origin}`);
        logger.warn(`📋 Allowed origins are: ${JSON.stringify(allowedOrigins)}`);
        return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-Request-ID",
        "Cookie",
        "Set-Cookie",
        "Access-Control-Allow-Credentials",
      ],
      credentials: true,
      maxAge: 86400,
      exposedHeaders: [
        "Authorization",
        "Set-Cookie",
        "X-Request-ID",
      ],
      optionsSuccessStatus: 204,
      preflightContinue: false,
    });

    // ✅ MIDDLEWARE: Logging des requêtes
    app.use((req: express.Request, res: express.Response, next) => {
      const startTime = req.startTime || Date.now();
      
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const duration = Date.now() - startTime;
        const logData = {
          requestId: req.requestId,
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.headers['user-agent']?.substring(0, 100) || 'unknown',
          origin: req.headers.origin || 'none',
          ip: req.ip || req.socket.remoteAddress,
        };

        if (res.statusCode >= 400) {
          logger.warn(`Request error: ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
        } else {
          logger.log(`Request: ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
        }

        return originalEnd.apply(res, args);
      };

      next();
    });

    // ✅ ROUTES DE BASE AVEC STYLE TAILWIND CSS
    const getStatusBadge = () => {
      return isProduction 
        ? `<span class="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm font-medium">PRODUCTION</span>`
        : `<span class="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium">DEVELOPMENT</span>`;
    };

    const getMemoryUsage = () => {
      const usage = process.memoryUsage();
      return {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        rss: Math.round(usage.rss / 1024 / 1024)
      };
    };

    // Route racine avec design Tailwind CSS
    server.get("/", (_req: express.Request, res: express.Response) => {
      const memory = getMemoryUsage();
      
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>🚀 API Paname Consulting - Votre partenaire immigration</title>
          
          <!-- Tailwind CSS CDN -->
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    sky: {
                      500: '#0ea5e9',
                      600: '#0284c7',
                    }
                  },
                  animation: {
                    'pulse-slow': 'pulse 3s ease-in-out infinite',
                    'float': 'float 6s ease-in-out infinite',
                    'gradient': 'gradient 8s ease infinite',
                  },
                  keyframes: {
                    float: {
                      '0%, 100%': { transform: 'translateY(0)' },
                      '50%': { transform: 'translateY(-10px)' }
                    },
                    gradient: {
                      '0%, 100%': { backgroundPosition: '0% 50%' },
                      '50%': { backgroundPosition: '100% 50%' }
                    }
                  }
                }
              }
            }
          </script>
          
          <!-- Google Fonts -->
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          
          <style>
            * {
              font-family: 'Inter', sans-serif;
            }
            .gradient-bg {
              background: linear-gradient(-45deg, #0ea5e9, #0284c7, #0ea5e9, #0284c7);
              background-size: 400% 400%;
              animation: gradient 15s ease infinite;
            }
            .glass-card {
              background: rgba(255, 255, 255, 0.05);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .glow {
              box-shadow: 0 0 20px rgba(14, 165, 233, 0.3);
            }
            .hover-lift {
              transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .hover-lift:hover {
              transform: translateY(-5px);
              box-shadow: 0 10px 25px rgba(14, 165, 233, 0.2);
            }
          </style>
        </head>
        <body class="bg-gray-900 text-gray-100 min-h-screen">
          <!-- Background Gradient -->
          <div class="fixed inset-0 gradient-bg opacity-30 -z-10"></div>
          
          <!-- Animated Background Elements -->
          <div class="fixed inset-0 overflow-hidden -z-10">
            <div class="absolute -top-40 -right-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl"></div>
            <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-600/20 rounded-full blur-3xl"></div>
            <div class="absolute top-1/2 left-1/4 w-64 h-64 bg-sky-400/10 rounded-full blur-2xl animate-pulse-slow"></div>
          </div>
          
          <!-- Main Container -->
          <div class="container mx-auto px-4 py-8 max-w-6xl">
            <!-- Header -->
            <header class="text-center mb-12 animate-float">
              <div class="inline-block p-4 glass-card rounded-2xl mb-6 glow">
                <div class="text-6xl">🚀</div>
              </div>
              <h1 class="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-linear-to-r from-white to-sky-300 font-['Poppins']">
                API Paname Consulting
              </h1>
              <p class="text-xl text-gray-300 max-w-2xl mx-auto">
                Plateforme backend sécurisée pour la gestion des démarches d'immigration et des procédures administratives
              </p>
            </header>

            <!-- Main Status Card -->
            <div class="glass-card rounded-2xl p-8 mb-8 glow">
              <div class="flex items-center justify-between mb-8">
                <h2 class="text-3xl font-bold text-white flex items-center gap-3">
                  <span class="w-4 h-4 bg-green-500 rounded-full animate-pulse"></span>
                  Status du Serveur
                </h2>
                ${getStatusBadge()}
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <!-- Version -->
                <div class="bg-gray-800/50 rounded-xl p-6">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 bg-sky-500/20 rounded-lg">
                      <span class="text-sky-400 text-xl">📦</span>
                    </div>
                    <h3 class="font-semibold text-gray-300">Version</h3>
                  </div>
                  <p class="text-2xl font-bold">${process.env.npm_package_version || '1.0.0'}</p>
                  <p class="text-sm text-gray-400 mt-2">Dernière mise à jour</p>
                </div>
                
                <!-- Uptime -->
                <div class="bg-gray-800/50 rounded-xl p-6">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 bg-sky-500/20 rounded-lg">
                      <span class="text-sky-400 text-xl">⏱️</span>
                    </div>
                    <h3 class="font-semibold text-gray-300">Uptime</h3>
                  </div>
                  <p class="text-2xl font-bold">${Math.round(process.uptime())}s</p>
                  <p class="text-sm text-gray-400 mt-2">Temps de fonctionnement</p>
                </div>
                
                <!-- Memory -->
                <div class="bg-gray-800/50 rounded-xl p-6">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 bg-sky-500/20 rounded-lg">
                      <span class="text-sky-400 text-xl">💾</span>
                    </div>
                    <h3 class="font-semibold text-gray-300">Mémoire</h3>
                  </div>
                  <p class="text-2xl font-bold">${memory.heapUsed} MB</p>
                  <p class="text-sm text-gray-400 mt-2">Utilisée / ${memory.heapTotal} MB</p>
                </div>
                
                <!-- Node Version -->
                <div class="bg-gray-800/50 rounded-xl p-6">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 bg-sky-500/20 rounded-lg">
                      <span class="text-sky-400 text-xl">⚡</span>
                    </div>
                    <h3 class="font-semibold text-gray-300">Node.js</h3>
                  </div>
                  <p class="text-2xl font-bold">${process.version.replace('v', '')}</p>
                  <p class="text-sm text-gray-400 mt-2">Version du runtime</p>
                </div>
              </div>
              
              <!-- Timestamp -->
              <div class="bg-gray-800/30 rounded-xl p-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="text-sky-400">📅</span>
                    <span class="text-gray-300">Dernière mise à jour</span>
                  </div>
                  <span class="font-mono text-sky-300">${new Date().toLocaleString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}</span>
                </div>
              </div>
            </div>

            <!-- CORS Configuration -->
            <div class="glass-card rounded-2xl p-8 mb-8">
              <h3 class="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                <span class="text-sky-400">🔒</span>
                Configuration CORS Stricte
              </h3>
              <div class="bg-gray-800/30 rounded-xl p-6">
                <h4 class="font-bold text-lg mb-4 text-white">Origines autorisées :</h4>
                <div class="space-y-3">
                  ${allowedOrigins.map(origin => `
                    <div class="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                      <span class="text-green-400">✓</span>
                      <code class="text-sky-300 font-mono">${origin}</code>
                    </div>
                  `).join('')}
                </div>
                <p class="text-sm text-gray-400 mt-4">
                  Toutes les autres origines sont automatiquement bloquées.
                </p>
              </div>
            </div>

            <!-- Quick Actions -->
            <h3 class="text-2xl font-bold mb-6 text-white">Accès Rapide</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <!-- Health Check -->
              <a href="/health" 
                 class="group glass-card rounded-xl p-6 hover-lift border border-gray-700 hover:border-sky-500/50">
                <div class="flex items-start justify-between mb-4">
                  <div class="p-3 bg-sky-500/20 rounded-lg group-hover:bg-sky-500/30 transition-colors">
                    <span class="text-2xl text-sky-400">🏥</span>
                  </div>
                  <span class="text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>
                <h4 class="font-bold text-lg mb-2 text-white">Health Check</h4>
                <p class="text-gray-400 text-sm">Vérifiez l'état complet du serveur et des services</p>
              </a>
              
              <!-- API Documentation -->
              <a href="/api" 
                 class="group glass-card rounded-xl p-6 hover-lift border border-gray-700 hover:border-sky-500/50">
                <div class="flex items-start justify-between mb-4">
                  <div class="p-3 bg-sky-500/20 rounded-lg group-hover:bg-sky-500/30 transition-colors">
                    <span class="text-2xl text-sky-400">📚</span>
                  </div>
                  <span class="text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>
                <h4 class="font-bold text-lg mb-2 text-white">Documentation API</h4>
                <p class="text-gray-400 text-sm">Découvrez tous les endpoints disponibles</p>
              </a>
              
              <!-- Contact Support -->
              <a href="mailto:panameconsulting906@gmail.com" 
                 class="group glass-card rounded-xl p-6 hover-lift border border-gray-700 hover:border-sky-500/50">
                <div class="flex items-start justify-between mb-4">
                  <div class="p-3 bg-sky-500/20 rounded-lg group-hover:bg-sky-500/30 transition-colors">
                    <span class="text-2xl text-sky-400">💌</span>
                  </div>
                  <span class="text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>
                <h4 class="font-bold text-lg mb-2 text-white">Support Technique</h4>
                <p class="text-gray-400 text-sm">Contactez notre équipe pour assistance</p>
              </a>
            </div>

            <!-- API Endpoints -->
            <div class="glass-card rounded-2xl p-8 mb-8">
              <h3 class="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                <span class="text-sky-400">🔧</span>
                Endpoints Principaux
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-gray-800/30 rounded-lg p-4 hover:bg-gray-800/50 transition-colors">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="text-green-400">✓</span>
                    <code class="text-sky-300 font-mono">/api/auth</code>
                  </div>
                  <p class="text-sm text-gray-400">Authentification & Autorisation</p>
                </div>
                <div class="bg-gray-800/30 rounded-lg p-4 hover:bg-gray-800/50 transition-colors">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="text-green-400">✓</span>
                    <code class="text-sky-300 font-mono">/api/users</code>
                  </div>
                  <p class="text-sm text-gray-400">Gestion des utilisateurs</p>
                </div>
                <div class="bg-gray-800/30 rounded-lg p-4 hover:bg-gray-800/50 transition-colors">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="text-green-400">✓</span>
                    <code class="text-sky-300 font-mono">/api/procedures</code>
                  </div>
                  <p class="text-sm text-gray-400">Procédures administratives</p>
                </div>
                <div class="bg-gray-800/30 rounded-lg p-4 hover:bg-gray-800/50 transition-colors">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="text-green-400">✓</span>
                    <code class="text-sky-300 font-mono">/api/contact</code>
                  </div>
                  <p class="text-sm text-gray-400">Formulaire de contact</p>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <footer class="mt-12 pt-8 border-t border-gray-800">
              <div class="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h4 class="font-bold text-lg mb-2">Paname Consulting</h4>
                  <p class="text-gray-400 text-sm">Votre partenaire pour l'immigration en France</p>
                </div>
                
                <div class="flex items-center gap-6">
                  <div class="text-center">
                    <div class="text-2xl mb-2">🔒</div>
                    <p class="text-xs text-gray-400">Sécurité</p>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl mb-2">⚡</div>
                    <p class="text-xs text-gray-400">Performance</p>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl mb-2">🛡️</div>
                    <p class="text-xs text-gray-400">Fiabilité</p>
                  </div>
                </div>
                
                <div class="text-center md:text-right">
                  <p class="text-gray-500 text-sm">© ${new Date().getFullYear()} Paname Consulting</p>
                  <p class="text-gray-600 text-xs mt-1">Tous droits réservés</p>
                </div>
              </div>
              
              <div class="mt-8 text-center text-gray-600 text-sm">
                <p>Powered by NestJS • Express • TypeScript • Tailwind CSS</p>
                <p class="mt-2">Serveur ID: ${process.pid} • Port: ${process.env.PORT || 10000}</p>
              </div>
            </footer>
          </div>
        </body>
        </html>
      `);
    });

    // Health check (optimisé)
    server.get("/health", (_req: express.Request, res: express.Response) => {
      const memory = getMemoryUsage();
      
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: isProduction ? "production" : "development",
        cors: {
          enabled: true,
          strict: true,
          allowed_origins: allowedOrigins,
          total_allowed: allowedOrigins.length
        },
        memory: {
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          rss: memory.rss
        },
        node: {
          version: process.version,
          pid: process.pid,
          platform: process.platform,
          arch: process.arch
        },
        server: {
          requestId: _req.requestId,
          host: process.env.HOST || "0.0.0.0",
          port: process.env.PORT || 10000
        }
      });
    });

    // API Info (optimisé)
    server.get("/api", (_req: express.Request, res: express.Response) => {
      res.status(200).json({
        service: "paname-consulting-api",
        version: process.env.npm_package_version || "1.0.0",
        cors_policy: "strict",
        allowed_origins: allowedOrigins,
        endpoints: {
          auth: {
            path: "/api/auth",
            methods: ["POST", "GET"],
            description: "Authentification et gestion des tokens"
          },
          users: {
            path: "/api/users",
            methods: ["GET", "POST", "PUT", "DELETE"],
            description: "Gestion des utilisateurs"
          },
          procedures: {
            path: "/api/procedures",
            methods: ["GET", "POST", "PUT", "DELETE"],
            description: "Gestion des procédures administratives"
          },
          contact: {
            path: "/api/contact",
            methods: ["POST"],
            description: "Formulaire de contact"
          },
          destinations: {
            path: "/api/destinations",
            methods: ["GET"],
            description: "Destinations disponibles"
          },
          rendezvous: {
            path: "/api/rendezvous",
            methods: ["GET", "POST", "PUT", "DELETE"],
            description: "Gestion des rendez-vous"
          }
        },
        support: {
          email: "panameconsulting906@gmail.com",
          status: "active"
        },
        security: {
          cors: "enabled (strict mode)",
          helmet: "enabled",
          rate_limiting: "disabled (temp)",
          validation: "enabled"
        }
      });
    });

    // ✅ CRÉATION DES DOSSIERS NÉCESSAIRES
    const uploadsDir = join(__dirname, "..", "uploads");
    const logsDir = join(__dirname, "..", "logs");
    
    [uploadsDir, logsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.log(`📁 Répertoire créé: ${dir}`);
      }
    });

    // ✅ FICHIERS STATIQUES
    app.use(
      "/uploads",
      express.static(uploadsDir, {
        maxAge: "30d",
        setHeaders: (res, path) => {
          if (path.endsWith('.pdf') || path.endsWith('.jpg') || path.endsWith('.png')) {
            res.setHeader('Cache-Control', 'public, max-age=2592000');
          }
        }
      }),
    );

    // ✅ CONFIGURATION GLOBALE
    app.setGlobalPrefix("api");

    // ✅ VALIDATION GLOBALE
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        validationError: {
          target: false,
          value: false,
        },
        exceptionFactory: (errors) => {
          const messages = errors.map(error => {
            const constraints = error.constraints ? Object.values(error.constraints) : [];
            return `${error.property}: ${constraints.join(', ')}`;
          });
          return new BadRequestException({
            message: 'Validation failed',
            errors: messages,
            timestamp: new Date().toISOString()
          });
        }
      }),
    );

    // ✅ RATE LIMITING SIMPLIFIÉ
    logger.log("⚠️ Rate limiting temporairement désactivé pour le diagnostic");

    // ✅ DÉMARRAGE DU SERVEUR
    const port = parseInt(process.env.PORT || "10000", 10);
    const host = process.env.HOST || "0.0.0.0";

    logger.log(`🔄 Tentative de démarrage sur ${host}:${port}...`);
    logger.log(`🔒 CORS en mode strict - seulement ${allowedOrigins.length} origine(s) autorisée(s)`);
    
    await app.listen(port, host);

    // ✅ LOG DE DÉMARRAGE
    logger.log("=".repeat(60));
    logger.log(`🎉 Serveur démarré avec succès !`);
    logger.log(`📍 URL: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    logger.log(`🔒 CORS STRICT: Seules les origines suivantes sont autorisées :`);
    allowedOrigins.forEach(origin => logger.log(`   ✅ ${origin}`));
    logger.log(`⚙️  Environnement: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    logger.log(`📊 Node.js: ${process.version}`);
    logger.log(`🔒 Sécurité: Helmet, Validation activés`);
    logger.log("=".repeat(60));

    // ✅ LOG SUPPLEMENTAIRE
    logger.log(`💡 Conseil: Visitez http://${host === '0.0.0.0' ? 'localhost' : host}:${port} pour voir l'interface`);
    logger.log(`📋 API disponible sur: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/api`);
    logger.log(`⚠️ ATTENTION: Seules les origines listées sont autorisées.`);

  } catch (error: unknown) {
    logger.error("❌ Échec du démarrage du serveur", {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      pid: process.pid,
    });
    
    // Attendre un peu pour que les logs soient écrits
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    process.exit(1);
  }
}

// ✅ GESTION DES ERREURS GLOBALES
process.on("uncaughtException", (error: Error) => {
  const logger = new Logger("UncaughtException");
  logger.error("⚠️ Exception non capturée", {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on("unhandledRejection", (reason: any, _promise: Promise<any>) => {
  const logger = new Logger("UnhandledRejection");
  logger.error("⚠️ Rejet de promesse non géré", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    timestamp: new Date().toISOString(),
  });
});

process.on("SIGTERM", () => {
  const logger = new Logger("SIGTERM");
  logger.log("📩 Signal SIGTERM reçu, arrêt gracieux...");
  setTimeout(() => {
    logger.log("👋 Arrêt gracieux terminé");
    process.exit(0);
  }, 10000).unref();
});

process.on("SIGINT", () => {
  const logger = new Logger("SIGINT");
  logger.log("📩 Signal SIGINT (Ctrl+C) reçu, arrêt gracieux...");
  setTimeout(() => {
    logger.log("👋 Arrêt gracieux terminé");
    process.exit(0);
  }, 10000).unref();
});

// ✅ DÉMARRAGE
bootstrap().catch((error: unknown) => {
  const logger = new Logger("Bootstrap");
  logger.error("💥 Échec du bootstrap", {
    error: error instanceof Error ? error.message : 'Erreur inconnue',
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  });
  
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});