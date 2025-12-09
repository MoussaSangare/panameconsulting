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
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module";

// 🔧 DÉTECTION D'ENVIRONNEMENT
const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// 🌐 ORIGINES AUTORISÉES
const getCorsOrigins = () => {
  const defaultOrigins = [
    "https://panameconsulting.com",
    "https://www.panameconsulting.com",
    "https://panameconsulting.vercel.app",
    "https://admin.panameconsulting.com",
    "https://panameconsulting.netlify.app",
    "http://localhost:5173",
  ];

  // Ajouter les URLs Vercel
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && !defaultOrigins.includes(`https://${vercelUrl}`)) {
    defaultOrigins.push(`https://${vercelUrl}`);
  }

  // Ajouter localhost pour le développement
  if (!isProduction) {
    defaultOrigins.push("http://localhost:3000");
    defaultOrigins.push(`http://localhost:${PORT}`);
  }

  // Ajouter les origines depuis les variables d'environnement
  const envOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  envOrigins.forEach(origin => {
    const trimmed = origin.trim();
    if (trimmed && !defaultOrigins.includes(trimmed)) {
      defaultOrigins.push(trimmed);
    }
  });

  return [...new Set(defaultOrigins)];
};

function useContainer(
  appContext: INestApplicationContext,
  options: { fallbackOnErrors: boolean },
) {
  classValidatorUseContainer(appContext, options);
}

// Fonction pour créer l'application
export async function createApp(): Promise<express.Express> {
  const logger = new Logger("Bootstrap");
  const allowedOrigins = getCorsOrigins();

  logger.log(`🚀 Initialisation de l'application...`);

  // Création du serveur Express
  const server = express();

  // ✅ Compression GZIP
  server.use(compression());

  // ✅ Middleware pour parsing JSON
  server.use(express.json({ limit: '10mb' }));
  server.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ✅ Middleware CORS
  server.use((req, res, next) => {
    const origin = req.headers.origin;
    
    if (origin) {
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin === '*') return true;
        return origin === allowedOrigin;
      });

      if (isAllowed) {
        res.header('Access-Control-Allow-Origin', origin);
      }
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Origin, X-Requested-With');
    res.header('Access-Control-Expose-Headers', 'Authorization, Content-Disposition');
    res.header('Access-Control-Max-Age', '86400');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  });

  // ✅ Route racine
  server.get("/", (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      status: "success",
      message: "🚀 API Paname Consulting",
      service: "backend-api",
      version: process.env.npm_package_version || "1.0.0",
      environment: isVercel ? 'vercel' : isProduction ? 'production' : 'development',
      timestamp: new Date().toISOString(),
      documentation: "/api/docs",
      endpoints: {
        api: "/api",
        docs: "/api/docs",
        status: "/api/status"
      }
    });
  });

  // ✅ Route de status système
  server.get("/api/status", (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      status: "online",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      platform: isVercel ? 'vercel' : 'server',
      node: process.version,
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      }
    });
  });

  try {
    // ✅ Création de l'application NestJS
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(server),
      {
        logger: isProduction ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug'],
        bufferLogs: true,
      }
    );

    // ✅ Configuration du container
    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    // ✅ Configuration Helmet - CORRIGÉE
    const helmetOptions: any = {
      contentSecurityPolicy: isVercel ? false : undefined,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { 
        policy: "cross-origin" as const 
      },
      crossOriginOpenerPolicy: { 
        policy: "same-origin" as const 
      },
      referrerPolicy: { 
        policy: "strict-origin-when-cross-origin" as const 
      }
    };

    // Ajouter HSTS seulement hors Vercel
    if (!isVercel) {
      helmetOptions.hsts = {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      };
    }

    app.use(helmet(helmetOptions));

    // ✅ Headers de sécurité
    app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.removeHeader("X-Powered-By");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      next();
    });

    // ✅ Configuration du préfixe global - CORRIGÉE
    app.setGlobalPrefix("api", {
      exclude: [
        '/',
        '/api/status',
        'docs',
        'api-docs'
      ]
    });

    // ✅ Validation globale
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // ✅ Configuration Swagger (optionnel)
    if (!isProduction) {
      try {
        const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
        const config = new DocumentBuilder()
          .setTitle('Paname Consulting API')
          .setDescription('API documentation')
          .setVersion('1.0.0')
          .addBearerAuth()
          .build();
        
        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document);
        
        logger.log('📚 Documentation API disponible sur /api/docs');
      } catch (swaggerError) {
        logger.warn('⚠️ Swagger non initialisé');
      }
    }

    // ✅ Initialisation
    await app.init();
    
    logger.log(`✅ Application initialisée`);
    logger.log(`📁 Préfixe: /api`);
    logger.log(`🌐 CORS: ${allowedOrigins.length} origines`);
    
    return server;
  } catch (error: unknown) {
    logger.error("❌ Erreur d'initialisation", error instanceof Error ? error.message : "Erreur inconnue");
    
    // Serveur de secours
    server.get("*", (_req, res) => {
      res.status(500).json({
        error: "Initialisation échouée",
        timestamp: new Date().toISOString()
      });
    });
    
    return server;
  }
}

// ✅ Export pour Vercel Serverless Functions
let cachedApp: express.Express | null = null;

export default async function handler(req: express.Request, res: express.Response) {
  if (!cachedApp) {
    const logger = new Logger("VercelHandler");
    logger.log("⚡ Cold start");
    cachedApp = await createApp();
  }
  return cachedApp(req, res);
}

// ✅ Démarrage traditionnel
if (!isVercel && require.main === module) {
  (async () => {
    try {
      const logger = new Logger("Server");
      const app = await createApp();
      
      app.listen(PORT, () => {
        logger.log(`🚀 Serveur démarré sur le port ${PORT}`);
        logger.log(`🌐 URL: http://localhost:${PORT}`);
      });
      
    } catch (error) {
      console.error('💥 Erreur de démarrage:', error);
      process.exit(1);
    }
  })();
}

// Export pour CommonJS (nécessaire pour Vercel)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createApp,
    default: handler
  };
}