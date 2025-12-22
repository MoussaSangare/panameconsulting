import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppConfig } from './configuration';

export interface EmailConnectionConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  appName: string;
  frontendUrl: string;
  connectionTimeout: number;
}

export interface EmailTestResult {
  success: boolean;
  message: string;
  error?: string;
  timestamp: string;
  responseTime?: number;
}

export interface EmailStatus {
  available: boolean;
  lastCheck: string;
  uptime: number;
  sentCount: number;
  failedCount: number;
  config: {
    host: string;
    port: number;
    userMasked: string;
    fromEmail: string;
  };
}

@Injectable()
export class EmailConfigService implements OnModuleInit {
  private readonly logger = new Logger(EmailConfigService.name);
  private transporter: nodemailer.Transporter;
  private config: EmailConnectionConfig;
  private isServiceAvailable = false;
  private initialized = false;
  
  // Statistiques
  private sentCount = 0;
  private failedCount = 0;
  private startTime = Date.now();
  private lastCheckTime: Date;

  constructor(private configService: ConfigService<AppConfig>) {}

  async onModuleInit(): Promise<void> {
    await this.initializeWithRetry();
  }

  async initializeWithRetry(maxRetries = 3, delay = 10000): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Tentative d'initialisation email (${attempt}/${maxRetries})...`);
        
        this.config = this.loadConfig();
        
        if (!this.isConfigValid(this.config)) {
          this.logger.warn('Configuration email incomplète');
          this.isServiceAvailable = false;
          return;
        }

        this.transporter = this.createTransporter();
        await this.testConnection();
        
        this.isServiceAvailable = true;
        this.initialized = true;
        this.lastCheckTime = new Date();
        
        this.logger.log(`✅ Service email initialisé avec succès`);
        this.logger.log(`📧 Serveur: ${this.config.host}:${this.config.port}`);
        this.logger.log(`👤 Compte: ${this.maskEmail(this.config.user)}`);
        
        return;
        
      } catch (error) {
        this.logger.error(`❌ Échec tentative ${attempt}: ${error.message}`);
        
        if (attempt < maxRetries) {
          this.logger.log(`⏳ Nouvelle tentative dans ${delay / 1000}s...`);
          await this.delay(delay);
        } else {
          this.logger.error('❌ Échec final de l\'initialisation du service email');
          this.isServiceAvailable = false;
          throw error;
        }
      }
    }
  }

  private loadConfig(): EmailConnectionConfig {
    const appConfig = this.configService.get<AppConfig>('app', { infer: true });
    
    return {
      host: appConfig.emailHost,
      port: appConfig.emailPort,
      secure: appConfig.emailSecure,
      user: appConfig.emailUser,
      pass: appConfig.emailPass,
      fromEmail: `"${appConfig.appName}" <${appConfig.emailFrom}>`,
      appName: appConfig.appName,
      frontendUrl: appConfig.frontendUrl,
      connectionTimeout: appConfig.emailConnectionTimeout,
    };
  }

  private isConfigValid(config: EmailConnectionConfig): boolean {
    const required = ['host', 'port', 'user', 'pass'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      this.logger.warn(`Configuration manquante: ${missing.join(', ')}`);
      return false;
    }
    
    if (!config.user.includes('@')) {
      this.logger.warn('Email utilisateur invalide');
      return false;
    }
    
    return true;
  }

  private createTransporter(): nodemailer.Transporter {
    const isPort587 = this.config.port === 587;
    
    const transporterConfig: any = {
      host: this.config.host,
      port: this.config.port,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
      pool: true,
      maxConnections: 10,
      maxMessages: 50,
      connectionTimeout: this.config.connectionTimeout,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      dnsTimeout: 10000,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
        minVersion: 'TLSv1.2',
      },
      debug: process.env.NODE_ENV !== 'production',
      logger: process.env.NODE_ENV !== 'production',
    };

    // Configuration spécifique pour STARTTLS (port 587)
    if (isPort587) {
      transporterConfig.secure = false;
      transporterConfig.requireTLS = true;
      transporterConfig.ignoreTLS = false;
    } else {
      transporterConfig.secure = this.config.secure;
      transporterConfig.requireTLS = !this.config.secure;
    }

    // Pour Gmail spécifiquement
    if (this.config.host.includes('gmail.com')) {
      transporterConfig.service = 'gmail';
      // Configuration supplémentaire pour éviter les blocages
      transporterConfig.pool = false;
    }

    return nodemailer.createTransport(transporterConfig);
  }

  private async testConnection(): Promise<void> {
    if (!this.transporter) {
      throw new Error('Transporter non initialisé');
    }

    const start = Date.now();
    
    try {
      await this.transporter.verify();
      const responseTime = Date.now() - start;
      
      this.logger.log(`✅ Connexion SMTP vérifiée (${responseTime}ms)`);
      this.lastCheckTime = new Date();
      
    } catch (error) {
      this.logger.error(`❌ Échec de vérification SMTP: ${error.message}`);
      
      if (error.code === 'EAUTH') {
        this.logger.error('Erreur d\'authentification - vérifiez EMAIL_USER/EMAIL_PASS');
      } else if (error.code === 'ECONNECTION') {
        this.logger.error('Erreur de connexion - vérifiez EMAIL_HOST/EMAIL_PORT');
      } else if (error.code === 'ETIMEDOUT') {
        this.logger.error('Timeout de connexion - augmentez EMAIL_CONNECTION_TIMEOUT');
      }
      
      throw error;
    }
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    html: string,
    context?: string
  ): Promise<boolean> {
    if (!this.isServiceAvailable) {
      this.logger.warn(`Tentative d'envoi email ignorée - service indisponible`);
      return false;
    }

    const recipients = Array.isArray(to) ? to : [to];
    const maskedTo = recipients.map(email => this.maskEmail(email)).join(', ');
    
    try {
      await this.transporter.sendMail({
        from: this.config.fromEmail,
        to: recipients,
        subject: subject,
        html: html,
        headers: {
          'X-Mailer': this.config.appName,
          'X-Context': context || 'general',
          'X-Sent-At': new Date().toISOString(),
        },
        // Priorité pour les emails transactionnels
        priority: 'high',
      });

      this.sentCount++;
      this.logger.log(`✅ Email envoyé à: ${maskedTo} (${subject})`);
      return true;
      
    } catch (error) {
      this.failedCount++;
      this.logger.error(`❌ Erreur envoi email à ${maskedTo}: ${error.message}`);
      
      // Tentative de reprise pour certains types d'erreurs
      if (this.shouldRetry(error)) {
        this.logger.log(`🔄 Nouvelle tentative dans 5s...`);
        await this.delay(5000);
        
        try {
          await this.transporter.sendMail({
            from: this.config.fromEmail,
            to: recipients,
            subject: subject,
            html: html,
          });
          
          this.sentCount++;
          this.logger.log(`✅ Email envoyé après retry à: ${maskedTo}`);
          return true;
        } catch (retryError) {
          this.logger.error(`❌ Échec retry: ${retryError.message}`);
        }
      }
      
      return false;
    }
  }

  async testEmailService(): Promise<EmailTestResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isServiceAvailable) {
        await this.initializeWithRetry(1);
      }

      if (!this.isServiceAvailable) {
        return {
          success: false,
          message: 'Service non disponible',
          error: 'Configuration incomplète ou erreur d\'initialisation',
          timestamp: new Date().toISOString(),
        };
      }

      // Test d'envoi
      const testResult = await this.transporter.sendMail({
        from: this.config.fromEmail,
        to: this.config.user,
        subject: `Test SMTP - ${this.config.appName}`,
        text: `Ceci est un email de test envoyé le ${new Date().toLocaleString('fr-FR')}`,
        html: `
          <h3>Test de service email</h3>
          <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
          <p>Service: ${this.config.appName}</p>
          <p>Statut: ✅ Opérationnel</p>
        `,
      });

      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        message: `Email de test envoyé avec succès en ${responseTime}ms`,
        timestamp: new Date().toISOString(),
        responseTime,
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        message: `Échec du test: ${error.message}`,
        error: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
        responseTime,
      };
    }
  }

  getTransporter(): nodemailer.Transporter {
    if (!this.isServiceAvailable) {
      throw new Error('Service email non disponible');
    }
    return this.transporter;
  }

  getConfig(): EmailConnectionConfig {
    return { ...this.config };
  }

  getStatus(): EmailStatus {
    const uptime = Date.now() - this.startTime;
    
    return {
      available: this.isServiceAvailable,
      lastCheck: this.lastCheckTime?.toISOString() || null,
      uptime,
      sentCount: this.sentCount,
      failedCount: this.failedCount,
      config: {
        host: this.config?.host || 'non configuré',
        port: this.config?.port || 0,
        userMasked: this.maskEmail(this.config?.user || ''),
        fromEmail: this.config?.fromEmail || 'non configuré',
      },
    };
  }

  maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    
    const [name, domain] = email.split('@');
    const nameLength = name.length;
    
    if (nameLength <= 3) {
      return '***@' + domain;
    }
    
    const first = name.substring(0, 2);
    const last = name.substring(nameLength - 1);
    const masked = first + '*'.repeat(3) + last;
    
    return masked + '@' + domain;
  }

  isAvailable(): boolean {
    return this.isServiceAvailable;
  }

  private shouldRetry(error: any): boolean {
    const retryableErrors = [
      'ECONNECTION',
      'ETIMEDOUT',
      'EENVELOPE',
      'EMESSAGE',
    ];
    
    return retryableErrors.includes(error.code);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}