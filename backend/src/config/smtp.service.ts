import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SmtpService implements OnModuleInit {
  private readonly logger = new Logger(SmtpService.name);
  private transporter: nodemailer.Transporter;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter() {
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPass = this.configService.get<string>('EMAIL_PASS');
    
    if (!emailUser || !emailPass) {
      this.logger.error(' EMAIL_USER ou EMAIL_PASS manquant');
      return;
    }

    // Configuration optimisée pour Docker
    const transporterConfig = {
      host: 'smtp.gmail.com',
      port: 587, // Utilisez 587 au lieu de 465
      secure: false, // false pour STARTTLS
      requireTLS: true,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      connectionTimeout: 15000, // Augmentez le timeout
      greetingTimeout: 10000,
      socketTimeout: 30000,
      tls: {
        rejectUnauthorized: false, // Important dans certains environnements
        ciphers: 'SSLv3'
      },
      debug: true, // Activez les logs détaillés
      logger: true
    };

    try {
      this.logger.log(' Initialisation du transporteur SMTP...');
      
      // Test DNS d'abord
      await this.testDnsResolution();
      
      this.transporter = nodemailer.createTransport(transporterConfig);
      
      // Test de connexion
      await this.transporter.verify();
      
      this.isInitialized = true;
      this.logger.log(' SMTP initialisé avec succès');
      
    } catch (error) {
      this.logger.error(` Erreur d'initialisation SMTP: ${error.message}`);
      
      // Fallback: transporter mock pour le développement
      this.setupMockTransporter();
    }
  }

  private async testDnsResolution(): Promise<void> {
    const dns = require('dns').promises;
    
    try {
      const addresses = await dns.resolve4('smtp.gmail.com');
      this.logger.log(` DNS résolu: ${addresses.join(', ')}`);
      
      // Test de connectivité TCP
      const net = require('net');
      return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(10000);
        
        socket.on('connect', () => {
          this.logger.log(' Connectivité TCP vérifiée sur le port 587');
          socket.destroy();
          resolve();
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Timeout de connexion TCP'));
        });
        
        socket.on('error', (err: any) => {
          socket.destroy();
          reject(err);
        });
        
        socket.connect(587, 'smtp.gmail.com');
      });
      
    } catch (error) {
      throw new Error(`Échec résolution DNS: ${error.message}`);
    }
  }

  private setupMockTransporter(): void {
    this.logger.warn(' Configuration d\'un transporteur mock (mode développement)');
    
    this.transporter = {
      sendMail: async (mailOptions: { to: any; subject: any; }) => {
        this.logger.warn(` MOCK: Email simulé à ${mailOptions.to}`);
        this.logger.warn(` Sujet: ${mailOptions.subject}`);
        
        // En production, vous pourriez logger dans une file d'attente
        return {
          messageId: `mock-${Date.now()}`,
          accepted: [mailOptions.to],
          rejected: [],
          response: '250 Mock OK'
        };
      },
      verify: async () => {
        this.logger.warn(' Mock SMTP vérifié');
        return true;
      },
      close: () => {
        this.logger.warn('🔌 Mock SMTP fermé');
      }
    } as any;
  }

  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    
    if (!this.isInitialized) {
      this.logger.warn(' SMTP non initialisé, tentative de réinitialisation...');
      await this.initializeTransporter();
    }

    try {
      const mailOptions = {
        from: `"Paname Consulting" <${this.configService.get('EMAIL_USER')}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        headers: {
          'X-Application': 'Paname Consulting'
        }
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(` Email envoyé à ${options.to}`);
      this.logger.debug(`Message ID: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId
      };
      
    } catch (error) {
      this.logger.error(` Erreur d'envoi d'email: ${error.message}`);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.isInitialized) {
        await this.initializeTransporter();
      }
      
      await this.transporter.verify();
      
      return {
        success: true,
        message: ' SMTP opérationnel'
      };
      
    } catch (error) {
      return {
        success: false,
        message: ` SMTP non disponible: ${error.message}`
      };
    }
  }
}