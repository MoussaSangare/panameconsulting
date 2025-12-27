import { Module, Logger } from "@nestjs/common";
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
import { SmtpService } from "./config/smtp.service";

@Module({
  imports: [
    // 1. Configuration globale
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. Base de données - CONFIGURATION AMÉLIORÉE
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('MongooseModule');
        const uri = configService.get<string>("MONGODB_URI");

        if (!uri) {
          logger.error('MONGODB_URI est non définie dans les variables d\'environnement');
          throw new Error('MONGODB_URI is not defined in environment variables');
        }

        return {
          uri,
          retryAttempts: 5,
          retryDelay: 3000,
          serverSelectionTimeoutMS: 30000,
          socketTimeoutMS: 45000,
          bufferCommands: false,
          connectTimeoutMS: 30000,
          maxPoolSize: 10,
          minPoolSize: 1,
          heartbeatFrequencyMS: 10000,
        };
      },
      inject: [ConfigService],
    }),

    // 3. Serveur de fichiers statiques
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "uploads"),
      serveRoot: "/uploads",
      serveStaticOptions: {
        index: false,
        dotfiles: 'deny',
        cacheControl: true,
        maxAge: 2592000000,
      },
    }),

    // 4. Modules fonctionnels
    AuthModule,
    UsersModule,
    DestinationModule,
    ContactModule,
    MailModule,
    ProcedureModule,
    RendezvousModule,
    NotificationModule,
  ],
  controllers: [],
  providers: [
    SmtpService, // ← CORRECTION : pas besoin de configuration spéciale
    {
      provide: 'INITIALIZE_DATABASE',
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('DatabaseInit');
        const uri = configService.get<string>("MONGODB_URI");
        
        if (!uri) {
          logger.error('MONGODB_URI manquante au démarrage');
        } else {
          logger.log('Configuration MongoDB chargée');
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    SmtpService,
  ],
})
export class AppModule {}