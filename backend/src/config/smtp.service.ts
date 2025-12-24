import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);
  private transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;
  private isAvailable: boolean = false;
  private fromEmail: string = '';
  private readonly appName: string = 'Paname Consulting';
  private retryAttempts: number = 3;
  private retryDelay: number = 2000; // 2 secondes

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  async initManually(): Promise<void> {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    const emailUser = this.configService.get<string>('EMAIL_USER') || process.env.EMAIL_USER;
    const emailPass = this.configService.get<string>('EMAIL_PASS') || process.env.EMAIL_PASS;
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'production' || process.env.NODE_ENV ;

    if (!emailUser || !emailPass) {
      this.logger.error('❌ EMAIL_USER ou EMAIL_PASS manquant pour SMTP');
      this.isAvailable = false;
      return;
    }

    this.fromEmail = `${this.appName} <${emailUser}>`;

    try {
      this.logger.log(`🚀 Configuration SMTP Gmail pour ${nodeEnv.toUpperCase()}...`);
      
      // Configuration optimisée production Gmail
      const transporterConfig: SMTPTransport.Options = {
        host: 'smtp.gmail.com',
        port: 465, // Port sécurisé recommandé en production
        secure: true, // SSL obligatoire pour le port 465
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        // Optimisations production
        connectionTimeout: 15000, // 15 secondes
        greetingTimeout: 10000,
        socketTimeout: 30000, // 30 secondes pour les emails longs
        // DKIM et sécurité
        dkim: {
          domainName: this.extractDomain(emailUser),
          keySelector: 'default',
          privateKey: '', // À configurer si vous avez DKIM
        },
        // TLS recommandé
        requireTLS: true,
        tls: {
          rejectUnauthorized: true, // Toujours vérifier le certificat en prod
          minVersion: 'TLSv1.2',
        },
        // Debug seulement en développement
        debug: nodeEnv === 'development',
        logger: nodeEnv === 'development',
      };

      this.transporter = nodemailer.createTransport(transporterConfig);

      // Vérification robuste de la connexion
      await this.transporter.verify();
      this.isAvailable = true;
      
      this.logger.log('✅ Service SMTP Gmail opérationnel (Production)');
      this.logger.log(`📧 Expéditeur: ${this.maskEmail(emailUser)}`);
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur initialisation SMTP: ${error.message}`);
      
      // Tentative avec port alternatif en cas d'échec
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
        host: 'smtp.gmail.com',
        port: 587, // Port alternatif STARTTLS
        secure: false,
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

  async sendEmail(options: {
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
  }): Promise<boolean> {
    if (!this.isAvailable || !this.transporter) {
      this.logger.warn(`📧 Email ignoré - service SMTP indisponible`);
      return false;
    }

    // Limite de débit pour respecter les limites Gmail
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
          // Headers optimisés production
          headers: {
            'X-Priority': options.priority === 'high' ? '1' : '3',
            'X-MSMail-Priority': options.priority === 'high' ? 'High' : 'Normal',
            'Importance': options.priority === 'high' ? 'high' : 'normal',
            'X-Mailer': `${this.appName} Mailer`,
            'X-Auto-Response-Suppress': 'All', // Supprime les réponses automatiques
            'Precedence': 'bulk', // Pour les emails transactionnels
          },
          // Encodage
          encoding: 'utf-8',
          // Priorité
          priority: options.priority || 'normal',
        };

        const info = await this.transporter.sendMail(mailOptions);
        
        this.logger.log(`📧 Email envoyé (tentative ${attempt}/${this.retryAttempts}) à: ${this.maskEmail(options.to)}`);
        this.logger.debug(`Message ID: ${info.messageId}, Response: ${info.response?.substring(0, 100)}`);
        
        // Suivi des envois réussis
        this.trackSuccess();
        
        return true;
        
      } catch (error: any) {
        lastError = error;
        
        // Log détaillé selon le type d'erreur
        this.logEmailError(error, attempt);
        
        // Attente exponentielle avant nouvelle tentative
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          this.logger.warn(`⏳ Nouvelle tentative dans ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Toutes les tentatives ont échoué
    this.logger.error(`❌ Échec après ${this.retryAttempts} tentatives pour: ${options.subject}`);
    this.trackFailure(lastError);
    
    return false;
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
    
    // Log supplémentaire si c'est une erreur Gmail spécifique
    if (error.responseCode && error.responseCode >= 400) {
      this.logger.error(`📊 Code réponse SMTP: ${error.responseCode} - ${error.response}`);
    }
  }

  private async rateLimit(): Promise<void> {
    // Implémentation simple de rate limiting
    // Gmail limite à ~100 emails/jour pour les comptes gratuits
    // Dans une vraie prod, utiliseriez un système plus sophistiqué
    const emailsPerSecond = 0.1; // ~9 emails/minute max
    
    // Petit délai pour éviter le flood
    await new Promise(resolve => setTimeout(resolve, 1000 / emailsPerSecond));
  }

  private trackSuccess(): void {
    // Ici vous pourriez logger les succès dans une base de données
    // ou des métriques pour monitoring
    // this.logger.debug('📈 Email envoyé avec succès - métrique incrémentée');
  }

  private trackFailure(error: any): void {
    // Log des échecs pour monitoring/alerting
    const errorData = {
      timestamp: new Date().toISOString(),
      errorCode: error.code,
      errorMessage: error.message,
      service: 'SMTP',
    };
    
    this.logger.error(`📉 Échec email tracé: ${JSON.stringify(errorData)}`);
    
    // En production, vous pourriez envoyer une alerte
    if (error.code === 'EAUTH' || error.code === 'ECONNECTION') {
      this.logger.warn('🚨 Erreur critique SMTP - vérification requise');
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

  private extractDomain(email: string): string {
    return email.split('@')[1] || 'panameconsulting.com';
  }

  private maskEmail(email: string | string[]): string {
    if (Array.isArray(email)) {
      return email.map(e => this.maskEmail(e)).join(', ');
    }
    
    if (!email?.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    const masked = name.length > 2 ? name.substring(0, 2) + '***' : '***';
    return `${masked}@${domain}`;
  }

  getStatus(): { available: boolean; message: string } {
    const status = this.isAvailable ? '✅' : '❌';
    const details = this.isAvailable 
      ? `SMTP Gmail opérationnel`
      : 'Service SMTP indisponible';
    
    return {
      available: this.isAvailable,
      message: `${status} ${details}`
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.transporter) {
        await this.initialize();
      }
      
      if (this.isAvailable && this.transporter) {
        const verified = await this.transporter.verify();
        const options = this.transporter.options as SMTPTransport.Options;
        
        return {
          success: true,
          message: `✅ SMTP Gmail opérationnel\n` +
                  `📧 Expéditeur: ${this.maskEmail(this.fromEmail)}\n` +
                  `🔌 Hôte: ${options.host}:${options.port}\n` +
                  `🔐 Sécurité: ${options.secure ? 'SSL/TLS' : 'STARTTLS'}`
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

  // Méthode pour monitoring
  getMetrics(): {
    available: boolean;
    host: string;
    port: number;
    secure: boolean;
  } {
    const options = this.transporter?.options as SMTPTransport.Options;
    
    return {
      available: this.isAvailable,
      host: options?.host || 'N/A',
      port: options?.port || 0,
      secure: options?.secure || false,
    };
  }

  // Nettoyage propre
  async close(): Promise<void> {
    if (this.transporter) {
      try {
        this.transporter.close();
        this.logger.log('🔌 Connexions SMTP fermées proprement');
      } catch (error) {
        this.logger.warn('⚠️ Erreur lors de la fermeture SMTP:', error);
      }
    }
  }
}