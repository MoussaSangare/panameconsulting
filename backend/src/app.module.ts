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

@Module({
  imports: [
    // 1. Configuration globale
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. Base de données
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('MongooseModule');
        const uri = configService.get<string>("MONGODB_URI");

        logger.log(`🔗 Configuration MongoDB...`);
        logger.log(`📊 MONGODB_URI: ${uri ? 'Définie' : 'NON DÉFINIE'}`);
        
        if (!uri) {
          logger.error('❌ MONGODB_URI est non définie dans les variables d\'environnement');
          logger.error('💡 Vérifiez les variables dans Railway: MONGODB_URI, NODE_ENV, PORT');
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
    {
      provide: 'INITIALIZE_DATABASE',
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('DatabaseInit');
        const uri = configService.get<string>("MONGODB_URI");
        
        if (!uri) {
          logger.error('🚨 MONGODB_URI manquante au démarrage');
        } else {
          logger.log('✅ Configuration MongoDB chargée');
        }
      },
      inject: [ConfigService],
    },
    {
      provide: 'VERIFY_EMAIL_CONFIG',
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('EmailConfig');
        
        // Vérification directe des variables d'environnement
        const emailUser = configService.get<string>('EMAIL_USER');
        const emailPass = configService.get<string>('EMAIL_PASS');
        const emailHost = configService.get<string>('EMAIL_HOST');
        const emailSecure = configService.get<string>('EMAIL_SECURE');
        const emailPort = configService.get<string>('EMAIL_PORT') || '465';
        
        logger.log('📧 VÉRIFICATION CONFIGURATION EMAIL');
        logger.log('====================================');
        logger.log(`EMAIL_HOST: ${emailHost || '❌ NON DÉFINI'}`);
        logger.log(`EMAIL_USER: ${emailUser ? '✓ Défini' : '❌ NON DÉFINI'}`);
        logger.log(`EMAIL_PASS: ${emailPass ? '✓ Défini' : '❌ NON DÉFINI'}`);
        logger.log(`EMAIL_SECURE: ${emailSecure || 'true'} (recommandé: true)`);
        logger.log(`EMAIL_PORT: ${emailPort} (recommandé: 465)`);
        
        // Configuration recommandée pour Gmail/OVH/etc.
        if (emailPort === '465' && emailSecure === 'true') {
          logger.log('✅ Configuration email optimale pour TLS');
        }
        
        if (!emailUser || !emailPass || !emailHost) {
          logger.warn('⚠️  Configuration email incomplète - L\'envoi d\'emails sera désactivé');
        } else {
          logger.log('✅ Configuration email prête');
        }
        
        logger.log('====================================\n');
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}