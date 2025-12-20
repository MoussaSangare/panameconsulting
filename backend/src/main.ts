import { ValidationPipe, Logger, BadRequestException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ExpressAdapter } from "@nestjs/platform-express";
import * as express from "express";
import * as fs from "fs";
import helmet from "helmet";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import { join } from "path";
import { AppModule } from "./app.module";
import rateLimit from "express-rate-limit";

// Déclaration pour étendre Request
declare global {
  namespace Express {
    interface Request {
      invalidJson?: boolean;
    }
  }
}

const isProduction = process.env.NODE_ENV === 'production';

// Origines autorisées EXCLUSIVEMENT en production
const productionOrigins = [
  "https://panameconsulting.com",
  "https://www.panameconsulting.com",
  "https://panameconsulting.vercel.app",
  "https://vercel.live",
  "http://localhost:5713",
  "http://localhost:5173"
];

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some(allowedOrigin => {
    if (allowedOrigin.includes('*')) {
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

  try {
    // Créer l'application Express
    const server = express();

    // Middlewares de base
    server.use(compression());
    server.use(cookieParser());

    // Parser JSON avec gestion d'erreur
    server.use(express.json({
      limit: '10mb',
      verify: (req: express.Request, res: express.Response, buf: Buffer, encoding: BufferEncoding) => {
        try {
          if (buf && buf.length) {
            JSON.parse(buf.toString(encoding || 'utf8'));
          }
        } catch (e) {
          (req as any).invalidJson = true;
        }
      }
    }));

    server.use(express.urlencoded({
      limit: '10mb',
      extended: true,
      parameterLimit: 1000
    }));

    // Créer l'application NestJS
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(server),
      {
        logger: ["error", "warn", "log"],
        bufferLogs: true,
      },
    );

    // Configuration de sécurité
    app.set('trust proxy', 1);

    // Helmet configuration
    app.use(helmet({
      contentSecurityPolicy: isProduction ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", ...productionOrigins],
          fontSrc: ["'self'", "https:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'self'", "https://vercel.live", "https://www.google.com"],
        },
      } : false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
    }));

    // Headers de sécurité supplémentaires
    app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.removeHeader("X-Powered-By");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      next();
    });

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limite chaque IP à 100 requêtes par windowMs
      standardHeaders: true,
      legacyHeaders: false,
    });

    app.use(limiter);

    // CORS configuration STRICTE
    app.enableCors({
      origin: (origin, callback) => {
        // 🔒 Vérifier l'origine pour toutes les requêtes
        if (!origin) {
          logger.warn(`Requête sans origine rejetée`);
          callback(new Error('Origin header is required'), false);
          return;
        }

        // Vérifier si l'origine est autorisée
        if (isOriginAllowed(origin, productionOrigins)) {
          logger.debug(`Origine autorisée: ${origin}`);
          callback(null, true);
        } else {
          logger.warn(`Origine non autorisée: ${origin}`);
          callback(new Error(`Origin ${origin} is not allowed`), false);
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
      ],
    });

    // Validation globale
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors) => {
          const messages = errors.map(error => {
            const constraints = error.constraints ? Object.values(error.constraints) : [];
            return `${error.property}: ${constraints.join(', ')}`;
          });
          return new BadRequestException({
            message: 'Validation failed',
            errors: messages,
          });
        }
      }),
    );

    // Routes de base
    server.get("/", (_req: express.Request, res: express.Response) => {
      res.send("API Paname Consulting - Online");
    });

    server.get("/health", (_req: express.Request, res: express.Response) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        cors: {
          allowedOrigins: productionOrigins,
          strictMode: true
        }
      });
    });

    // Créer les dossiers nécessaires
    const uploadsDir = join(process.cwd(), "uploads");
    const logsDir = join(process.cwd(), "logs");

    [uploadsDir, logsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.log(`Dossier créé: ${dir}`);
      }
    });

    // Servir les fichiers statiques
    app.use("/uploads", express.static(uploadsDir));

    // Préfixe global API
    app.setGlobalPrefix("api");

    // Démarrer le serveur
    const port = process.env.PORT || 10000;
    await app.listen(port, "0.0.0.0");

    logger.log(`🚀 Application démarrée sur le port ${port}`);
    logger.log(`📁 Dossier uploads: ${uploadsDir}`);
    logger.log(`🔧 Environnement: ${process.env.NODE_ENV || 'production'}`);
    logger.log(`🔐 CORS strict activé - ${productionOrigins.length} origines autorisées`);
    
    // Afficher les origines autorisées
    productionOrigins.forEach(origin => {
      logger.log(`   • ${origin}`);
    });

  } catch (error) {
    logger.error("Erreur lors du démarrage:", error);
    process.exit(1);
  }
}

// Gestion des erreurs globales
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Démarrer l'application
bootstrap();