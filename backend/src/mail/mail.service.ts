import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// Définition de l'interface avant la classe
interface EmailTemplate {
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly isServiceAvailable: boolean;
  private readonly fromEmail: string;
  private readonly supportEmail: string;

  constructor(private readonly configService: ConfigService) {
    // Initialisation des propriétés
    const emailUser = this.configService.get('EMAIL_USER');
    const emailPass = this.configService.get('EMAIL_PASS');
    
    this.isServiceAvailable = !!(emailUser && emailPass);
    this.fromEmail = `"Paname Consulting" <${emailUser}>`;
    this.supportEmail = emailUser;
    
    this.initializeTransporter();
  }

 private initializeTransporter() {
  if (!this.isServiceAvailable) {
    this.logger.warn('Service email non configuré - transporter non initialisé');
    return;
  }

  const emailHost = this.configService.get('EMAIL_HOST') || 'smtp.gmail.com';
  const emailPort = parseInt(this.configService.get('EMAIL_PORT') || '587');
  const isSecure = this.configService.get('EMAIL_SECURE') === 'true';
  const isProduction = this.configService.get('NODE_ENV') === 'production';

  // Configuration SMTP optimisée pour la production
  const smtpConfig: any = {
    host: emailHost,
    port: emailPort,
    secure: isSecure,
    auth: {
      user: this.configService.get('EMAIL_USER'),
      pass: this.configService.get('EMAIL_PASS'),
    },
    // Options de connexion robustes pour la production
    connectionTimeout: 15000, // 15 secondes
    socketTimeout: 15000,     // 15 secondes
    greetingTimeout: 10000,   // 10 secondes
    pool: true,               // Utiliser le pooling pour les performances
    maxConnections: 3,        // Nombre maximal de connexions simultanées
    maxMessages: 100,         // Messages par connexion avant recyclage
  };

  // Configuration TLS adaptée au port et à l'environnement
  if (emailPort === 587 && !isSecure) {
    // STARTTLS pour le port 587
    smtpConfig.tls = {
      ciphers: 'SSLv3',
      rejectUnauthorized: isProduction // Ne rejeter que si le certificat est invalide en production
    };
  } else if (isSecure) {
    // TLS direct pour les ports sécurisés (465)
    smtpConfig.tls = {
      rejectUnauthorized: isProduction
    };
  }

  // Désactiver temporairement la vérification TLS pour debug si nécessaire
  if (this.configService.get('EMAIL_DISABLE_TLS_CHECK') === 'true') {
    smtpConfig.tls = { rejectUnauthorized: false };
    this.logger.warn('⚠️ Vérification TLS désactivée - pour le debug uniquement');
  }

  this.transporter = nodemailer.createTransport(smtpConfig);

  // Vérification automatique de la connexion au démarrage
  this.checkConnection().then(isConnected => {
    if (isConnected) {
      this.logger.log(`✅ Service email connecté: ${emailHost}:${emailPort}`);
    } else {
      this.logger.error(`❌ Échec de connexion SMTP: ${emailHost}:${emailPort}`);
      this.logger.debug(`Configuration utilisée: ${JSON.stringify({
        host: emailHost,
        port: emailPort,
        secure: isSecure,
        authUser: this.maskEmail(this.configService.get('EMAIL_USER') || '')
      })}`);
    }
  });
}

async checkConnection(): Promise<boolean> {
  if (!this.isServiceAvailable) {
    this.logger.warn('Service email non disponible - EMAIL_USER ou EMAIL_PASS manquant');
    return false;
  }

  if (!this.transporter) {
    this.logger.error('Transporter non initialisé');
    return false;
  }

  try {
    // Utiliser Promise.race pour éviter les timeouts infinis
    const verifyPromise = this.transporter.verify();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout de vérification SMTP (10s)')), 10000);
    });

    await Promise.race([verifyPromise, timeoutPromise]);
    
    this.logger.log('✅ Service email connecté avec succès');
    return true;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    
    // Log adapté selon le type d'erreur
    if (errorMessage.includes('Timeout')) {
      this.logger.error(`⌛ Timeout SMTP: Vérifiez votre réseau/firewall`);
    } else if (errorMessage.includes('Invalid login') || errorMessage.includes('535')) {
      this.logger.error(`🔐 Erreur d'authentification: Vérifiez EMAIL_USER/EMAIL_PASS`);
      this.logger.warn(`💡 Astuce Gmail: Utilisez un "mot de passe d'application" si 2FA est activé`);
    } else if (errorMessage.includes('ECONNREFUSED')) {
      this.logger.error(`🔌 Connexion refusée: Vérifiez host/port ou firewall`);
    } else if (errorMessage.includes('self signed certificate')) {
      this.logger.warn(`⚠️ Certificat auto-signé: Ajoutez "EMAIL_DISABLE_TLS_CHECK=true" temporairement`);
    } else {
      this.logger.error(`❌ Erreur de connexion SMTP: ${errorMessage}`);
    }
    
    // Log détaillé en debug
    this.logger.debug(`Détails de l'erreur: ${JSON.stringify(error, null, 2)}`);
    
    return false;
  }
}

  async sendEmail(to: string, template: EmailTemplate, context?: Record<string, any>): Promise<boolean> {
    if (!this.isServiceAvailable) {
      this.logger.warn(`Tentative d'envoi email - service indisponible`);
      return false;
    }

    const mailOptions = {
      from: this.fromEmail,
      to: to,
      replyTo: this.supportEmail,
      subject: template.subject,
      html: context ? this.renderTemplate(template.html, context) : template.html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.debug(`Email envoyé à: ${this.maskEmail(to)}`);
      return true;
    } catch (error) {
      this.logger.error(`Erreur envoi email: ${error.message}`);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const template = this.getPasswordResetTemplate(resetUrl);
    const success = await this.sendEmail(email, template);
    
    if (success) {
      this.logger.log(`Email de réinitialisation envoyé à: ${this.maskEmail(email)}`);
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const template = this.getWelcomeTemplate(firstName);
    const success = await this.sendEmail(email, template);
    
    if (success) {
      this.logger.log(`Email de bienvenue envoyé à: ${this.maskEmail(email)}`);
    }
  }

  private getPasswordResetTemplate(resetUrl: string): EmailTemplate {
    return {
      subject: 'Réinitialisation de votre mot de passe - Paname Consulting',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Réinitialisation de mot de passe</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${this.getEmailHeader('Réinitialisation de mot de passe')}
          
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <p>Bonjour,</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour procéder :</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0ea5e9, #0369a1); 
                        color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Réinitialiser mon mot de passe
              </a>
            </div>

            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
              <p style="color: #64748b; font-size: 14px; margin: 0;">
                <strong>Important :</strong> Ce lien expirera dans 1 heure.
              </p>
            </div>
            
            <p style="color: #94a3b8; font-size: 14px; margin-top: 30px;">
              Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email ou 
              <a href="mailto:${this.supportEmail}" style="color: #0ea5e9;">contacter notre support</a>.
            </p>
            
            ${this.getEmailFooter()}
          </div>
        </body>
        </html>
      `,
    };
  }

  private getWelcomeTemplate(firstName: string): EmailTemplate {
    const appUrl = this.configService.get('APP_URL') || this.configService.get('FRONTEND_URL') || '#';
    
    return {
      subject: 'Bienvenue chez Paname Consulting',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bienvenue</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${this.getEmailHeader('Bienvenue chez Paname Consulting')}
          
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <p>Bonjour <strong>${firstName}</strong>,</p>
            <p>Nous sommes ravis de vous accueillir chez <strong>Paname Consulting</strong> !</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0 0 15px 0;"><strong>Votre compte a été créé avec succès.</strong></p>
              <p style="margin: 0;">Vous pouvez maintenant accéder à votre espace personnel et prendre rendez-vous avec nos conseillers.</p>
            </div>

            <p>Nous sommes impatients de vous accompagner dans votre projet d'études à l'international.</p>
            
            ${this.getEmailFooter()}
          </div>
        </body>
        </html>
      `,
    };
  }

  private getEmailHeader(title: string): string {
    return `
      <div style="background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${title}</h1>
      </div>
    `;
  }

  private getEmailFooter(): string {
    return `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="color: #64748b; font-size: 12px; line-height: 1.4;">
          Cordialement,<br>
          <strong style="color: #0ea5e9;">L'équipe Paname Consulting</strong><br>
          <a href="mailto:${this.supportEmail}" style="color: #64748b; text-decoration: none;">${this.supportEmail}</a>
        </p>
      </div>
    `;
  }

  private renderTemplate(html: string, context?: Record<string, any>): string {
    if (!context) return html;
    
    let rendered = html;
    Object.entries(context).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(placeholder, value);
    });
    return rendered;
  }

  private maskEmail(email: string): string {
    if (!email?.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    return `${name.substring(0, 2)}***@${domain}`;
  }

  getServiceStatus(): { available: boolean; reason?: string } {
    return {
      available: this.isServiceAvailable,
      reason: this.isServiceAvailable ? undefined : 'Service email non configuré ou indisponible'
    };
  }
}