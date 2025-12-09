import {
  ValidationPipe,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import helmet from "helmet";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  try {
    // ✅ CRÉATION DE L'APPLICATION AVEC NEST FACTORY
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ["error", "warn", "log"],
      bufferLogs: true,
      cors: {
        origin: [
          "https://panameconsulting.com",
          "https://www.panameconsulting.com",
          "https://panameconsulting.vercel.app",
          "https://admin.panameconsulting.com",
          "https://panameconsulting.netlify.app",
          "https://panbameconsulting.vercel.app",
          "https://vercel.live",
        ],
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
      },
    });

    // ✅ NESTJS NATIF - PRÉFIXE GLOBAL
    app.setGlobalPrefix("api", {
      exclude: ["/", "/health"],
    });

    // ✅ NESTJS NATIF - VALIDATION GLOBALE
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: (errors) => {
          const messages = errors.map(error => ({
            field: error.property,
            errors: error.constraints ? Object.values(error.constraints) : [],
          }));
          return new BadRequestException({
            message: 'Validation failed',
            errors: messages,
            timestamp: new Date().toISOString()
          });
        }
      }),
    );

    // ✅ NESTJS NATIF - MIDDLEWARE DE SÉCURITÉ
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }));

    // ✅ NESTJS NATIF - COMPRESSION GZIP
    app.use(compression());

    // ✅ NESTJS NATIF - PARSING DE COOKIES
    app.use(cookieParser());

    // ✅ NESTJS NATIF - LOGGER GLOBAL
    app.useLogger(app.get(Logger));

    // ✅ NESTJS NATIF - SHUTDOWN HOOKS
    app.enableShutdownHooks();

    // ✅ NESTJS NATIF - DOCUMENTATION (Swagger optionnel)
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('Paname Consulting API')
        .setDescription('API documentation')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
    }

    // ✅ ROUTES NESTJS NATIVES
   

    const port = process.env.PORT || 10000;
    const host = "0.0.0.0";

    // ✅ DÉMARRAGE DU SERVEUR NESTJS
    await app.listen(port, host);

    // ✅ LOG DE DÉMARRAGE
    logger.log(`========================================`);
    logger.log(`🚀 Paname Consulting API démarrée`);
    logger.log(`📍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`🌐 URL: http://${host}:${port}`);
    logger.log(`📚 API: http://${host}:${port}/api`);
    logger.log(`🩺 Health: http://${host}:${port}/health`);
    logger.log(`========================================`);

  } catch (error: unknown) {
    logger.error("❌ Erreur au démarrage", {
      message: error instanceof Error ? error.message : "Erreur inconnue",
      timestamp: new Date().toISOString(),
    });
    process.exit(1);
  }
}

// ✅ GESTION NATIVE DES ERREURS GLOBALES
process.on("uncaughtException", (error: Error) => {
  const logger = new Logger("UncaughtException");
  logger.error(`Erreur non gérée: ${error.message}`, error.stack);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  const logger = new Logger("UnhandledRejection");
  logger.error(`Promise rejetée non gérée: ${reason}`);
});

// ✅ DÉMARRAGE DE L'APPLICATION
bootstrap();