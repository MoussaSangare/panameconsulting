import {
  INestApplicationContext,
  ValidationPipe,
  Logger,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  NestExpressApplication,
  ExpressAdapter,
} from "@nestjs/platform-express";
import {
  useContainer as classValidatorUseContainer,
} from "class-validator";
import * as express from "express";
import * as fs from "fs";
import helmet from "helmet";
import * as compression from "compression";
import { join } from "path";
import { AppModule } from "./app.module";

function useContainer(
  appContext: INestApplicationContext,
  options: { fallbackOnErrors: boolean },
) {
  classValidatorUseContainer(appContext, options);
}

// 🔒 FORCER LA PRODUCTION EXCLUSIVE
const isProduction = true;

// 🌐 ORIGINES AUTORISÉES EN PRODUCTION EXCLUSIVE
const productionOrigins = [
  "https://panameconsulting.com",
  "https://www.panameconsulting.com",
  "https://panameconsulting.vercel.app",
  "https://admin.panameconsulting.com",
  "https://panameconsulting.netlify.app",
  "https://panbameconsulting.vercel.app",
  "https://vercel.live", // AJOUTÉ pour Vercel Live
];

// Fonction pour vérifier si une origine correspond à un pattern avec wildcard
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some(allowedOrigin => {
    if (allowedOrigin.includes('*')) {
      // Convertir le pattern avec wildcard en regex
      const pattern = allowedOrigin
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }
    return origin === allowedOrigin;
  });
}

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  // 🔧 Configuration de sécurité et performance
  const server = express();

  // ✅ Compression GZIP pour les réponses
  server.use(compression());

 
  // ✅ Route racine simple
  server.get("/", (_req: express.Request, res: express.Response) => {
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
            <p><strong>Environnement:</strong> PRODUCTION</p>
            <p><strong>Version:</strong> ${process.env.npm_package_version || '1.0.0'}</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div class="links">
            <a href="/health">Health Check</a>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // ✅ API info route
  server.get("/api", (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      status: "success",
      service: "API panameconsulting",
      version: process.env.npm_package_version || "1.0.0",
      timestamp: new Date().toISOString(),
      environment: "production",
      support: "panameconsulting906@gmail.com",
      uptime: process.uptime(),
    });
  });

  try {
    // ✅ Création de l'application
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(server),
      {
        logger: ["error", "warn", "log"], // Production: logs essentiels seulement
        bufferLogs: true,
      },
    );

    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    // 🔐 CONFIGURATION DE SÉCURITÉ HELMET AVEC CSP CORRIGÉE
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", ...productionOrigins],
            fontSrc: ["'self'", "https:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            // CORRECTION: Ajouter vercel.live au frame-src
            frameSrc: ["'self'", "https://vercel.live", "https://www.google.com"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
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
      }),
    );

    // ✅ Headers de sécurité additionnels
    app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.removeHeader("X-Powered-By");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
      next();
    });

    // 🌐 CONFIGURATION CORS POUR PRODUCTION EXCLUSIVE
    logger.log(`Configuration CORS pour environnement: PRODUCTION EXCLUSIVE`);
    logger.log(`Origines autorisées: ${productionOrigins.join(', ')}`);

    // ✅ CONFIGURATION CORS STRICTE
    app.enableCors({
      origin: (origin, callback) => {
        // 🔒 EN PRODUCTION EXCLUSIVE: REFUSER les requêtes sans origine
        if (!origin) {
          logger.warn(`❌ Requête sans origine rejetée en production`);
          callback(new Error('Origine requise en production'), false);
          return;
        }

        // 🔒 Vérification stricte des origines
        const isAllowed = isOriginAllowed(origin, productionOrigins);

        if (isAllowed) {
          callback(null, true);
        } else {
          logger.warn(`❌ Origine non autorisée par CORS: ${origin}`);
          callback(new Error(`Origine non autorisée: ${origin}`), false);
        }
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
      ],
      credentials: true,
      maxAge: 86400,
      exposedHeaders: [
        "Authorization",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ],
      optionsSuccessStatus: 204,
    });

    // ✅ Middleware pour gérer manuellement les headers CORS
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const origin = req.headers.origin;
      
      // Set le header Access-Control-Allow-Origin seulement pour les origines autorisées
      if (origin && isOriginAllowed(origin, productionOrigins)) {
        res.header("Access-Control-Allow-Origin", origin);
      }
      
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Origin, X-Requested-With");
      res.header("Access-Control-Expose-Headers", "Authorization, X-RateLimit-Limit, X-RateLimit-Remaining");
      res.header("Access-Control-Max-Age", "86400");
      
      // Répondre immédiatement aux requêtes OPTIONS (pré-vol CORS)
      if (req.method === "OPTIONS") {
        return res.status(200).end();
      }
      
      next();
    });

    // ✅ Création des dossiers nécessaires
    const uploadsDir = join(__dirname, "..", "uploads");
    const logsDir = join(__dirname, "..", "logs");
    
    [uploadsDir, logsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.log(`Dossier créé: ${dir}`);
      }
    });

    // ✅ Configuration des fichiers statiques
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

    // ✅ Configuration globale
    app.setGlobalPrefix("api", {
      exclude: ['/', '/uploads', '/uploads/(.*)']
    });
    
    // ✅ Validation globale
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true, // Strict en production
        transformOptions: {
          enableImplicitConversion: true,
        },
        validationError: {
          target: false, // Ne pas exposer le target en production
          value: false,
        },
      }),
    );

    // ✅ Rate limiting global
    const rateLimit = require("express-rate-limit");
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limite chaque IP à 100 requêtes par fenêtre
        message: {
          status: 429,
          message: "Trop de requêtes, veuillez réessayer plus tard.",
        },
        standardHeaders: true,
        legacyHeaders: false
      }),
    );

    const port = process.env.PORT || 10000;
    const host = "0.0.0.0";

    // ✅ Log de démarrage détaillé
    logger.log(`========================================`);
    logger.log(`🚀 Application: Paname Consulting API`);
    logger.log(`📍 Environnement: PRODUCTION EXCLUSIVE`);
    logger.log(`🌐 Host: ${host}`);
    logger.log(`🚪 Port: ${port}`);
    logger.log(`📁 Dossier uploads: ${uploadsDir}`);
    logger.log(`🔒 Mode production: ${isProduction}`);
    logger.log(`🔐 CORS activé: ${productionOrigins.length} origines`);
    logger.log(`========================================`);

    // ✅ Démarrage du serveur
    await app.listen(port, host);

    logger.log(`✅ Serveur démarré sur http://${host}:${port}`);
    logger.log(`✅ Documentation API: http://${host}:${port}/api`);
    
    // ✅ Information de monitoring
    const memoryUsage = process.memoryUsage();
    logger.log(`📊 Mémoire utilisée: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);

  } catch (error: unknown) {
    // ✅ Log sécurisé sans données sensibles
    logger.error("❌ Erreur fatale au démarrage", {
      message: error instanceof Error ? error.message : "Erreur inconnue",
      timestamp: new Date().toISOString(),
      environment: "production",
    });
    
    process.exit(1);
  }
}

// ✅ Gestion d'erreur globale
process.on("uncaughtException", (error: Error) => {
  const logger = new Logger("UncaughtException");
  
  logger.error("⚠️ Erreur non gérée détectée", {
    message: error.message,
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
  
  // En production, ne pas quitter immédiatement
  // Laisser le process manager redémarrer
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  const logger = new Logger("UnhandledRejection");
  
  logger.error("⚠️ Promise rejection non gérée", {
    reason: reason instanceof Error ? reason.message : "Raison inconnue",
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

// ✅ Gestion des signaux de terminaison
process.on("SIGTERM", () => {
  const logger = new Logger("SIGTERM");
  logger.log("📩 Signal SIGTERM reçu, arrêt gracieux...");
  process.exit(0);
});

process.on("SIGINT", () => {
  const logger = new Logger("SIGINT");
  logger.log("📩 Signal SIGINT reçu (Ctrl+C), arrêt gracieux...");
  process.exit(0);
});

// ✅ Démarrage avec gestion d'erreur
bootstrap().catch((error: unknown) => {
  const logger = new Logger("Bootstrap");
  logger.error("💥 Échec critique du bootstrap", {
    message: error instanceof Error ? error.message : "Erreur inconnue",
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
  
  process.exit(1);
});