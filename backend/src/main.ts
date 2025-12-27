/*
 * Paname Consulting API - Main Entry Point
 * This file bootstraps the NestJS application with all necessary configurations
 */

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
import { rateLimit } from "express-rate-limit";

declare global {
  namespace Express {
    interface Request {
      invalidJson?: boolean;
      isPublicRoute?: boolean;
      requestId?: string;
      startTime?: number;
      isAdminRoute?: boolean;
    }
  }
}

// Configuration CORS et CSP
const productionOrigins = [
  "https://panameconsulting.com",
  "https://www.panameconsulting.com",
  "https://panameconsulting.vercel.app",
  "https://panameconsulting.up.railway.app",
  "https://vercel.live",
  "http://localhost:5173",
  "http://localhost:10000",
];

const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? productionOrigins 
  : [...productionOrigins, "http://localhost:*", "http://localhost:10000", "http://localhost:5173"];

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

// Fonction de normalisation IP pour rate limiting
const normalizeIpForRateLimit = (req: express.Request): string => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Normaliser les adresses IPv6 localhost
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  
  // Pour IPv6, utiliser uniquement le préfixe /64
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::/64';
  }
  
  return ip;
};

async function bootstrap() {
  const server = express();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(server),
  );

  const logger = new Logger('Bootstrap');

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

  // ✅ CORS avec credentials
app.enableCors({
  origin: [
    "https://panameconsulting.com",
    "https://www.panameconsulting.com",
    "https://panameconsulting.vercel.app",
    "https://panameconsulting.up.railway.app",
    "https://vercel.live",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:10000"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie'],
  exposedHeaders: ['Set-Cookie'],
});

  server.get("/", (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "paname-consulting-api",
      version: process.env.npm_package_version || "1.0.0"
    });
  });

  // ✅ PREFIX GLOBAL DE L'API
  app.setGlobalPrefix("api");

  // ✅ API INFO - route séparée pour éviter les erreurs
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

  // ✅ MIDDLEWARE: Body parsers
  server.use(express.urlencoded({
    limit: '10mb',
    extended: true,
    parameterLimit: 1000
  }));

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

  // ✅ MIDDLEWARE: Compression
  server.use(compression());

  // ✅ MIDDLEWARE: Cookie Parser (options séparées)
  server.use(cookieParser(process.env.COOKIE_SECRET));

  // ✅ MIDDLEWARE: Configuration des cookies de session (30 minutes)
  server.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Configurer les cookies de réponse pour qu'ils soient sécurisés
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' as const,
      maxAge: 30 * 60 * 1000, // 30 minutes
      path: '/',
    };

    // Surcharger la méthode cookie pour appliquer les options par défaut
    const originalCookie = res.cookie;
    res.cookie = function(name: string, value: string, options: any = {}) {
      return originalCookie.call(this, name, value, { ...cookieOptions, ...options });
    };

    next();
  });

  // ✅ MIDDLEWARE: Security headers avec Helmet
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
    
    // Header pour indiquer la durée de session
    res.setHeader("X-Session-Timeout", "1800"); // 30 minutes en secondes
    
    next();
  });

  // ✅ MIDDLEWARE: Détection des routes admin
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
    
    req.isAdminRoute = isAdminRoute;
    
    next();
  });

  // Rate limiter pour utilisateurs normaux - 2000 requêtes / 30 minutes
  const userLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 2000,
    message: {
      status: 429,
      message: 'Trop de requêtes (2,000 req/30min)',
      limit: 2000,
      window: "30 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req: express.Request) => {
      const normalizedIp = normalizeIpForRateLimit(req);
      return `user_${normalizedIp}`;
    },
    handler: (_req: express.Request, res: express.Response, _next, options) => {
      res.status(options.statusCode).json(options.message);
    },
    validate: true,
  });

  // Rate limiter pour admin - 10000 requêtes / 30 minutes
  const adminLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 10000,
    message: {
      status: 429,
      message: 'Trop de requêtes (10,000 req/30min)',
      limit: 10000,
      window: "30 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req: express.Request) => {
      const normalizedIp = normalizeIpForRateLimit(req);
      return `admin_${normalizedIp}`;
    },
    handler: (_req: express.Request, res: express.Response, _next, options) => {
      res.status(options.statusCode).json(options.message);
    },
    validate: true,
  });

  // Appliquer le rate limiting approprié
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.isAdminRoute) {
      return adminLimiter(req, res, next);
    } else {
      return userLimiter(req, res, next);
    }
  });

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

  // ✅ DÉMARRAGE DU SERVEUR
  const port = parseInt(process.env.PORT, 10);
  const host = process.env.HOST || "0.0.0.0";

  await app.listen(port, host, () => {
    logger.log(`Server started successfully on PORT=${port}`); 
    logger.log(`🚀 Application is running on: ${host}:${port}`);
    logger.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`🍪 Session timeout: 30 minutes`);
    logger.log(`⏱️ Rate limits: Users=2000/30min, Admin=10000/30min`);
    logger.log(`🔐 CORS with credentials enabled`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
  process.exit(1);
});