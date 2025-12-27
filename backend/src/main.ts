import {
  ValidationPipe,
  Logger,
  BadRequestException,
  RequestMethod,
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

// 🌐 ORIGINES AUTORISÉES
const productionOrigins = [
  "https://panameconsulting.com",
  "https://www.panameconsulting.com",
  "https://panameconsulting.vercel.app",
  "https://panameconsulting.up.railway.app",
  "https://vercel.live",
  "http://localhost:5713",
  "http://localhost:3000",
];

const developmentOrigins = [
  "http://localhost:3000",
  "http://localhost:5713",
  "http://localhost:8080",
];

const allowedOrigins = isProduction ? productionOrigins : developmentOrigins;

// Fonction pour générer un ID de requête unique
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Fonction pour vérifier les origines avec wildcards
const isOriginAllowed = (origin: string, allowedList: string[]): boolean => {
  if (!origin) return false;
  
  return allowedList.some(allowedOrigin => {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return origin === allowedOrigin;
  });
};

async function bootstrap() {
  try {
    logger.log("🚀 Starting API server...");

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
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...allowedOrigins],
      fontSrc: ["'self'", "https:"],
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

    // ✅ CONFIGURATION CORS
    app.enableCors({
      origin: (origin, callback) => {
        // Autoriser les requêtes sans origine en développement
        if (!origin && !isProduction) {
          return callback(null, true);
        }

        // Autoriser les requêtes sans origine pour les webhooks et certaines API
        if (!origin) {
          // Vérifier si c'est une route publique
          const publicRoutes = ['/health', '/api', '/webhooks'];
          const currentReq = (app as any).httpAdapter?.getInstance()?.request;
          const requestPath = currentReq?.originalUrl || '';
          
          const isPublic = publicRoutes.some(route => 
            requestPath.startsWith(route)
          );
          
          if (isPublic) {
            return callback(null, true);
          }
          return callback(new Error('Origin required'), false);
        }

        if (isOriginAllowed(origin, allowedOrigins)) {
          logger.debug(`✅ Origin allowed: ${origin}`);
          return callback(null, true);
        }

        logger.warn(`❌ Origin blocked: ${origin}`);
        return callback(new Error('Not allowed by CORS'), false);
      },
      methods: [
        RequestMethod.GET,
        RequestMethod.POST,
        RequestMethod.PUT,
        RequestMethod.PATCH,
        RequestMethod.DELETE,
        RequestMethod.OPTIONS,
        RequestMethod.HEAD,
      ].map(m => RequestMethod[m]),
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

    // ✅ ROUTES DE BASE (Express direct pour éviter les problèmes de path-to-regexp)
    
    // Route racine
    server.get("/", (_req: express.Request, res: express.Response) => {
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>API Paname Consulting</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0; padding: 2rem; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white; min-height: 100vh;
            }
            .container { max-width: 600px; margin: 0 auto; text-align: center; }
            h1 { margin-bottom: 1rem; }
            .status { 
              background: rgba(255,255,255,0.1); 
              padding: 1.5rem; border-radius: 8px; 
              margin: 1rem 0; 
            }
            .links { margin-top: 2rem; }
            .links a { 
              color: #ffd700; 
              margin: 0 1rem; 
              text-decoration: none;
              font-weight: bold;
            }
            .links a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 API Paname Consulting</h1>
            <div class="status">
              <p><strong>Status:</strong> ✅ En ligne</p>
              <p><strong>Environnement:</strong> ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}</p>
              <p><strong>Version:</strong> ${process.env.npm_package_version || '1.0.0'}</p>
              <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Uptime:</strong> ${Math.round(process.uptime())} seconds</p>
            </div>
            <div class="links">
              <a href="/health">Health Check</a>
              <a href="/api">API Info</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });

    // Health check
    server.get("/health", (_req: express.Request, res: express.Response) => {
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: isProduction ? "production" : "development",
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
        node: {
          version: process.version,
          pid: process.pid,
        },
      });
    });

    // API Info
    server.get("/api", (_req: express.Request, res: express.Response) => {
      res.status(200).json({
        service: "paname-consulting-api",
        version: process.env.npm_package_version || "1.0.0",
        endpoints: {
          auth: "/api/auth",
          users: "/api/users",
          procedures: "/api/procedures",
          contact: "/api/contact",
          destinations: "/api/destinations",
          rendezvous: "/api/rendezvous",
        },
        support: "panameconsulting906@gmail.com",
      });
    });

    // ✅ CRÉATION DES DOSSIERS NÉCESSAIRES
    const uploadsDir = join(__dirname, "..", "uploads");
    const logsDir = join(__dirname, "..", "logs");
    
    [uploadsDir, logsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.log(`Directory created: ${dir}`);
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

    // ✅ CONFIGURATION GLOBALE - CORRIGÉ POUR PATH-TO-REGEXP
    // CORRECTION IMPORTANTE : Utiliser des routes nommées ou des routes spécifiques
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

    // ✅ RATE LIMITING
    const rateLimit = require("express-rate-limit");

    // Middleware pour détecter les routes admin
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const adminRoutes = [
        '/api/users/stats',
        '/api/users/toggle-status',
        '/api/users/maintenance',
        '/api/users/admin-reset-password',
        '/api/procedures/admin',
        '/api/auth/logout-all',
        '/api/contact/stats',
      ];
      
      const isAdminRoute = adminRoutes.some(route => 
        req.path.startsWith(route)
      );
      
      (req as any).isAdminRoute = isAdminRoute;
      
      next();
    });

    // Rate limiter pour utilisateurs normaux
    const userLimiter = rateLimit({
      windowMs: 30 * 60 * 1000, // 30 minutes
      max: 5000,
      message: {
        status: 429,
        message: 'Trop de requêtes (5,000 req/30min)',
        limit: 5000,
        window: "30 minutes"
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      keyGenerator: (req: express.Request) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        return `user_${ip}`;
      },
      handler: (_req: express.Request, res: express.Response, _next, options) => {
        res.status(options.statusCode).json(options.message);
      },
    });

    // Rate limiter pour admin
    const adminLimiter = rateLimit({
      windowMs: 30 * 60 * 1000, // 30 minutes
      max: 25000,
      message: {
        status: 429,
        message: 'Trop de requêtes (25,000 req/30min)',
        limit: 25000,
        window: "30 minutes"
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      keyGenerator: (req: express.Request) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        return `admin_${ip}`;
      },
      handler: (_req: express.Request, res: express.Response, _next, options) => {
        res.status(options.statusCode).json(options.message);
      },
    });

    // Appliquer le rate limiting approprié
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if ((req as any).isAdminRoute) {
        return adminLimiter(req, res, next);
      } else {
        return userLimiter(req, res, next);
      }
    });

    // ✅ DÉMARRAGE DU SERVEUR
    const port = parseInt(process.env.PORT || "10000", 10);
    const host = process.env.HOST || "0.0.0.0";

    await app.listen(port, host);

    // ✅ LOG DE DÉMARRAGE
    logger.log("=".repeat(60));
    logger.log(`🚀 Server started successfully!`);
    logger.log(`📍 URL: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    logger.log(`⚙️  Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    logger.log(`📊 Node: ${process.version}`);
    logger.log(`🌐 CORS: ${allowedOrigins.length} allowed origins`);
    logger.log(`🔒 Security: Helmet, Rate Limiting, Validation enabled`);
    logger.log("=".repeat(60));

  } catch (error: unknown) {
    logger.error("❌ Failed to start server", {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      pid: process.pid,
    });
    
    process.exit(1);
  }
}

// ✅ GESTION DES ERREURS GLOBALES
process.on("uncaughtException", (error: Error) => {
  const logger = new Logger("UncaughtException");
  logger.error("⚠️ Uncaught Exception", {
    name: error.name,
    message: error.message,
    timestamp: new Date().toISOString(),
  });
  
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason: any, _promise: Promise<any>) => {
  const logger = new Logger("UnhandledRejection");
  logger.error("⚠️ Unhandled Promise Rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    timestamp: new Date().toISOString(),
  });
});

process.on("SIGTERM", () => {
  const logger = new Logger("SIGTERM");
  logger.log("📩 Received SIGTERM, shutting down gracefully...");
  setTimeout(() => {
    logger.log("👋 Graceful shutdown complete");
    process.exit(0);
  }, 10000).unref();
});

process.on("SIGINT", () => {
  const logger = new Logger("SIGINT");
  logger.log("📩 Received SIGINT (Ctrl+C), shutting down gracefully...");
  setTimeout(() => {
    logger.log("👋 Graceful shutdown complete");
    process.exit(0);
  }, 10000).unref();
});

// ✅ DÉMARRAGE
bootstrap().catch((error: unknown) => {
  const logger = new Logger("Bootstrap");
  logger.error("💥 Bootstrap failed", {
    error: error instanceof Error ? error.message : 'Unknown error',
    timestamp: new Date().toISOString(),
  });
  process.exit(1);
});