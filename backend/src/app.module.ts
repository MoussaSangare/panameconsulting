import { Module, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import configuration from "./config/configuration";

// Modules métier
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ContactModule } from "./contact/contact.module";
import { DestinationModule } from "./destination/destination.module";
import { MailModule } from "./mail/mail.module";
import { RendezvousModule } from "./rendez-vous/rendez-vous.module";
import { NotificationModule } from "./notification/notification.module";
import { ProcedureModule } from "./procedure/procedure.module";

@Module({
  imports: [
    // 1. Configuration globale
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: ['.env', `.env.${process.env.NODE_ENV || 'development'}`],
      cache: true,
    }),

    // 2. Base de données - CONFIGURATION AMÉLIORÉE
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('MongooseModule');
        const uri = configService.get<string>("MONGODB_URI");

        // Logs détaillés pour le débogage
        logger.log(`🔗 Configuration MongoDB...`);
        logger.log(`📊 MONGODB_URI: ${uri ? 'Définie' : 'NON DÉFINIE'}`);
        
        if (!uri) {
          logger.error('❌ MONGODB_URI est non définie dans les variables d\'environnement');
          throw new Error('MONGODB_URI is not defined in environment variables');
        }

        // Options optimisées pour la production
        const isProduction = configService.get<string>("NODE_ENV") === 'production';
        
        return {
          uri,
          retryAttempts: isProduction ? 10 : 3,
          retryDelay: 1000,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          connectTimeoutMS: 10000,
          maxPoolSize: isProduction ? 50 : 10,
          minPoolSize: 5,
          heartbeatFrequencyMS: 2000,
          autoIndex: !isProduction, // Désactive les indexes en production
        };
      },
      inject: [ConfigService],
    }),

    // 3. Serveur de fichiers statiques
    ServeStaticModule.forRootAsync({
      useFactory: () => [
        {
          rootPath: join(__dirname, "..", "public"),
          serveRoot: "/public",
          serveStaticOptions: {
            index: false,
            cacheControl: true,
            maxAge: 31536000, // 1 an pour les assets statiques
          },
        },
        {
          rootPath: join(__dirname, "..", "uploads"),
          serveRoot: "/uploads",
          serveStaticOptions: {
            index: false,
            cacheControl: true,
            maxAge: 86400000, // 1 jour pour les uploads
          },
        }
      ],
    }),

    // 4. Modules fonctionnels (triés par ordre d'importance)
    AuthModule,
    UsersModule,
    ContactModule,
    DestinationModule,
    MailModule,
    RendezvousModule,
    NotificationModule,
    ProcedureModule,
  ],
  controllers: [],
  providers: [

     {
      provide: 'APP_INITIALIZER',
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('AppInitializer');
        return async () => {
          const nodeEnv = configService.get<string>('NODE_ENV', 'development');
          logger.log(`Application démarrée en mode: ${nodeEnv}`);
        };
      },
      inject: [ConfigService],
    },

    ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const requiredEnvVars = ['MONGODB_URI'];
    const missingVars = requiredEnvVars.filter(
      varName => !this.configService.get(varName)
    );

    if (missingVars.length > 0) {
      this.logger.error(`Variables d'environnement manquantes: ${missingVars.join(', ')}`);
      this.logger.error('Veuillez configurer ces variables dans Railway/Heroku/Vercel');
    } else {
      this.logger.log('✅ Toutes les variables critiques sont configurées');
    }
  }
}