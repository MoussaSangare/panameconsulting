import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import SMTPTransport from "nodemailer/lib/smtp-transport";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
}

export interface SmtpStatus {
  available: boolean;
  message: string;
  host: string;
  port: number;
  secure: boolean;
  fromEmail: string;
}

@Injectable()
export class SmtpService implements OnModuleDestroy {
  private readonly logger = new Logger(SmtpService.name);
  private transporter!: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;
  private isAvailable: boolean = false;
  private fromEmail: string = '';
  private readonly appName: string = 'Paname Consulting';
  private retryAttempts: number = 3;
  private retryDelay: number = 2000;
  private readonly maxEmailsPerDay: number = 100;
  private emailSentTimestamps: Date[] = [];
  private readonly cleanupInterval: number = 24 * 60 * 60 * 1000; // 24 heures
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    this.initialize().catch(error => {
      this.logger.error(`Erreur d'initialisation SMTP: ${error.message}`);
    });
    
    // Nettoyage périodique des timestamps
    this.cleanupTimer = setInterval(() => this.cleanupOldTimestamps(), this.cleanupInterval);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    await this.close();
  }

  private async initialize(): Promise<void> {
    const emailUser = this.configService.get<string>('EMAIL_USER') || process.env.EMAIL_USER;
    const emailPass = this.configService.get<string>('EMAIL_PASS') || process.env.EMAIL_PASS;
    const nodeEnv = (this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV || 'production').toLowerCase();

    if (!emailUser || !emailPass) {
      this.logger.error('❌ EMAIL_USER ou EMAIL_PASS manquant pour SMTP');
      this.isAvailable = false;
      return;
    }

    this.fromEmail = `${this.appName} <${emailUser}>`;

    try {
      this.logger.log(`🚀 Configuration SMTP Gmail pour ${nodeEnv.toUpperCase()}...`);
      
      const transporterConfig: SMTPTransport.Options = {
       service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
        }
      };

      this.transporter = nodemailer.createTransport(transporterConfig);

      await this.transporter.verify();
      this.isAvailable = true;
      
      this.logger.log('✅ Service SMTP Gmail opérationnel (Production)');
      this.logger.log(`📧 Expéditeur: ${this.maskEmail(emailUser)}`);
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur initialisation SMTP: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        this.logger.warn('🔄 Tentative avec port alternatif (587)...');
        await this.initializeWithFallback(emailUser, emailPass);
      } else {
        this.isAvailable = false;
      }
    }
  }

  private async initializeWithFallback(emailUser: string, emailPass: string): Promise<void> {
    try {
      const transporterConfig: SMTPTransport.Options = {
        service: 'gmail',
        requireTLS: true,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        connectionTimeout: 10000,
        socketTimeout: 20000,
      };

      this.transporter = nodemailer.createTransport(transporterConfig);

      await this.transporter.verify();
      this.isAvailable = true;
      this.logger.log('✅ Service SMTP Gmail opérationnel via port 587 (STARTTLS)');
      
    } catch (fallbackError: any) {
      this.logger.error(`❌ Échec configuration alternative: ${fallbackError.message}`);
      this.isAvailable = false;
    }
  }

  async initManually(): Promise<void> {
    this.logger.log('📧 Initialisation manuelle du service SMTP...');
    await this.initialize();
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isAvailable || !this.transporter) {
      const message = '📧 Email ignoré - service SMTP indisponible';
      this.logger.warn(message);
      return { success: false, error: message };
    }

    // Vérification du rate limiting
    if (!this.canSendEmail()) {
      const message = '📧 Limite quotidienne d\'emails atteinte';
      this.logger.warn(message);
      return { success: false, error: message };
    }

    // Rate limiting pour éviter le flood
    await this.rateLimit();

    let lastError: any;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const mailOptions: nodemailer.SendMailOptions = {
          from: this.fromEmail,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || this.htmlToText(options.html),
          replyTo: options.replyTo,
          cc: options.cc,
          bcc: options.bcc,
          attachments: options.attachments,
          headers: {
            'X-Priority': options.priority === 'high' ? '1' : '3',
            'X-MSMail-Priority': options.priority === 'high' ? 'High' : 'Normal',
            'Importance': options.priority === 'high' ? 'high' : 'normal',
            'X-Mailer': `${this.appName} Mailer`,
            'X-Auto-Response-Suppress': 'All',
            'Precedence': 'bulk',
          },
          encoding: 'utf-8',
          priority: options.priority || 'normal',
        };

        const info = await this.transporter.sendMail(mailOptions);
        
        // Succès : incrémenter les compteurs
        this.emailSentTimestamps.push(new Date());
        
        this.logger.log(`📧 Email envoyé (tentative ${attempt}/${this.retryAttempts}) à: ${this.maskRecipient(options.to)}`);
        this.logger.debug(`Message ID: ${info.messageId}`);
        
        return { 
          success: true, 
          messageId: info.messageId 
        };
        
      } catch (error: any) {
        lastError = error;
        
        this.logEmailError(error, attempt);
        
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          this.logger.warn(`⏳ Nouvelle tentative dans ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(`❌ Échec après ${this.retryAttempts} tentatives pour: ${options.subject}`);
    
    return {
      success: false,
      error: lastError?.message || 'Erreur inconnue lors de l\'envoi de l\'email'
    };
  }

  private logEmailError(error: any, attempt: number): void {
    const errorCode = error.code || 'UNKNOWN';
    const errorMessage = error.message || 'Erreur inconnue';
    
    switch (errorCode) {
      case 'EAUTH':
        this.logger.error(`🔐 Erreur auth (tentative ${attempt}): Vérifiez EMAIL_USER/EMAIL_PASS`);
        break;
      case 'EENVELOPE':
        this.logger.error(`📮 Erreur enveloppe (tentative ${attempt}): ${errorMessage}`);
        break;
      case 'EMESSAGE':
        this.logger.error(`✉️ Erreur message (tentative ${attempt}): ${errorMessage}`);
        break;
      case 'ECONNECTION':
        this.logger.error(`🌐 Erreur connexion (tentative ${attempt}): ${errorMessage}`);
        break;
      case 'ETIMEDOUT':
        this.logger.error(`⏱️ Timeout (tentative ${attempt}): ${errorMessage}`);
        break;
      case 'ESOCKET':
        this.logger.error(`🔌 Erreur socket (tentative ${attempt}): ${errorMessage}`);
        break;
      default:
        this.logger.error(`❌ Erreur SMTP ${errorCode} (tentative ${attempt}): ${errorMessage}`);
    }
    
    if (error.responseCode && error.responseCode >= 400) {
      this.logger.error(`📊 Code réponse SMTP: ${error.responseCode}`);
    }
  }

  private async rateLimit(): Promise<void> {
    const emailsPerSecond = 0.1;
    const delay = Math.floor(1000 / emailsPerSecond);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private canSendEmail(): boolean {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    this.emailSentTimestamps = this.emailSentTimestamps.filter(
      timestamp => timestamp > oneDayAgo
    );
    
    if (this.emailSentTimestamps.length >= this.maxEmailsPerDay) {
      this.logger.warn(`🚫 Limite quotidienne atteinte: ${this.emailSentTimestamps.length}/${this.maxEmailsPerDay} emails`);
      return false;
    }
    
    return true;
  }

  private cleanupOldTimestamps(): void {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const before = this.emailSentTimestamps.length;
    this.emailSentTimestamps = this.emailSentTimestamps.filter(
      timestamp => timestamp > oneDayAgo
    );
    const after = this.emailSentTimestamps.length;
    
    if (before !== after) {
      this.logger.debug(`🧹 Nettoyage timestamps: ${before - after} anciennes entrées supprimées`);
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<div[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }

  private maskEmail(email: string): string {
    if (!email?.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    const masked = name.length > 2 ? name.substring(0, 2) + '***' : '***';
    return `${masked}@${domain}`;
  }

  private maskRecipient(recipient: string | string[]): string {
    if (Array.isArray(recipient)) {
      return recipient.map(e => this.maskEmail(e)).join(', ');
    }
    return this.maskEmail(recipient);
  }

  getStatus(): SmtpStatus {
    const options = this.transporter?.options as SMTPTransport.Options;
    
    return {
      available: this.isAvailable,
      message: this.isAvailable 
        ? '✅ SMTP Gmail opérationnel'
        : '❌ Service SMTP indisponible',
      host: options?.host || 'N/A',
      port: options?.port || 0,
      secure: options?.secure || false,
      fromEmail: this.fromEmail,
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.transporter) {
        await this.initialize();
      }
      
      if (this.isAvailable && this.transporter) {
        await this.transporter.verify();
        const options = this.transporter.options as SMTPTransport.Options;
        
        return {
          success: true,
          message: `✅ SMTP Gmail opérationnel\n` +
                  `📧 Expéditeur: ${this.maskEmail(this.fromEmail)}\n` +
                  `🔌 Hôte: ${options.host}:${options.port}\n` +
                  `🔐 Sécurité: ${options.secure ? 'SSL/TLS' : 'STARTTLS'}\n` +
                  `📊 Emails aujourd'hui: ${this.emailSentTimestamps.length}/${this.maxEmailsPerDay}`
        };
      }
      
      return {
        success: false,
        message: '❌ Service SMTP indisponible. Vérifiez:\n' +
                '1. EMAIL_USER et EMAIL_PASS sont définis\n' +
                '2. Le mot de passe d\'application Google est valide\n' +
                '3. L\'accès SMTP est autorisé dans votre compte Google'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `❌ Erreur de test SMTP: ${error.message}\n` +
                `Code: ${error.code || 'N/A'}\n` +
                `Conseil: ${this.getErrorAdvice(error)}`
      };
    }
  }

  private getErrorAdvice(error: any): string {
    if (error.code === 'EAUTH') {
      return 'Générez un nouveau mot de passe d\'application sur https://myaccount.google.com/apppasswords';
    }
    if (error.code === 'ECONNECTION') {
      return 'Vérifiez votre connexion internet et les pare-feux';
    }
    if (error.code === 'ETIMEDOUT') {
      return 'Le serveur SMTP ne répond pas. Essayez le port 587 comme alternative';
    }
    return 'Consultez les logs pour plus de détails';
  }

  getFromEmail(): string {
    return this.fromEmail;
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  getEmailStats(): {
    totalToday: number;
    limit: number;
    available: number;
    isAvailable: boolean;
  } {
    return {
      totalToday: this.emailSentTimestamps.length,
      limit: this.maxEmailsPerDay,
      available: Math.max(0, this.maxEmailsPerDay - this.emailSentTimestamps.length),
      isAvailable: this.isAvailable,
    };
  }

  async close(): Promise<void> {
    if (this.transporter) {
      try {
        await this.transporter.close();
        this.logger.log('🔌 Connexions SMTP fermées proprement');
      } catch (error: any) {
        this.logger.warn(`⚠️ Erreur lors de la fermeture SMTP: ${error.message}`);
      }
    }
  }
}