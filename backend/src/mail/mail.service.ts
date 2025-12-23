import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private isAvailable: boolean = false;
  private fromEmail: string = '';

  constructor(private readonly configService: ConfigService) {
  
  }

  async initManually(): Promise<void> {
    await this.initialize();
  }

  private async initialize() {
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPass = this.configService.get<string>('EMAIL_PASS');

    if (!emailUser || !emailPass) {
      this.logger.warn('❌ Service email désactivé - EMAIL_USER ou EMAIL_PASS manquant');
      return;
    }

    this.fromEmail = `"Paname Consulting" <${emailUser}>`;

    try {
      this.logger.log('🔄 Initialisation du service email Gmail...');
      
      // Configuration simplifiée utilisant 'service'
      this.transporter = nodemailer.createTransport({
        service: 'gmail', // Configuration Gmail prédéfinie
        auth: {            
           user: process.env.EMAIL_USER || this.configService.get<string>('EMAIL_USER'), 
           pass: process.env.EMAIL_PASS || this.configService.get<string>('EMAIL_PASS')           
        },
        // Options de connexion flexibles
        tls: {
          rejectUnauthorized: false
        }
      });

      // Test de connexion avec timeout
      const testPromise = this.transporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout après 15s')), 15000)
      );

      await Promise.race([testPromise, timeoutPromise]);
      
      this.isAvailable = true;
      this.logger.log('✅ Service email Gmail initialisé avec succès');
      this.logger.log(`📧 Envoi depuis: ${this.maskEmail(emailUser)}`);
      
    } catch (error) {
      this.logger.error(`❌ Échec connexion Gmail: ${error.message}`);
      this.isAvailable = false;
    }
  }

  /**
   * Envoi d'email générique
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    cc?: string[];
    bcc?: string[];
  }): Promise<boolean> {
    if (!this.isAvailable) {
      this.logger.warn(`📧 Envoi ignoré - service email indisponible`);
      return false;
    }

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
      };

      if (options.replyTo) mailOptions.replyTo = options.replyTo;
      if (options.cc) mailOptions.cc = options.cc;
      if (options.bcc) mailOptions.bcc = options.bcc;

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`📧 Email envoyé à: ${this.maskEmail(options.to)}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Erreur envoi email: ${error.message}`);
      return false;
    }
  }

  /**
   * Email de réinitialisation de mot de passe
   */
  async sendPasswordReset(email: string, resetToken: string, firstName: string = ''): Promise<boolean> {
    const appUrl = this.configService.get<string>('FRONTEND_URL') || 'https://panameconsulting.vercel.app';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
          .info-box { background: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #0ea5e9; margin: 20px 0; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">Réinitialisation de mot de passe</h1>
        </div>
        <div class="content">
          <p>Bonjour ${firstName ? `<strong>${firstName}</strong>` : ''},</p>
          <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
          </div>

          <div class="info-box">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              <strong>Important :</strong> Ce lien expirera dans 1 heure.
            </p>
          </div>
          
          <p style="color: #94a3b8; font-size: 14px;">
            Si vous n'avez pas fait cette demande, ignorez cet email.
          </p>
          
          <div class="footer">
            <p>Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe - Paname Consulting',
      html: html,
    });
  }

  /**
   * Email de bienvenue
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    const appUrl = this.configService.get<string>('FRONTEND_URL') || 'https://panameconsulting.vercel.app';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
          .welcome-box { background: #f0f9ff; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">Bienvenue chez Paname Consulting</h1>
        </div>
        <div class="content">
          <p>Bonjour <strong>${firstName}</strong>,</p>
          <p>Nous sommes ravis de vous accueillir chez <strong>Paname Consulting</strong> !</p>
          
          <div class="welcome-box">
            <p style="margin: 0 0 15px 0;"><strong>Votre compte a été créé avec succès.</strong></p>
            <p style="margin: 0;">Vous pouvez maintenant accéder à votre espace personnel et prendre rendez-vous avec nos conseillers.</p>
          </div>

          <p>Nous sommes impatients de vous accompagner dans votre projet d'études à l'international.</p>
          
          <div class="footer">
            <p>Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
            <p>
              <a href="${appUrl}" style="color: #0ea5e9; text-decoration: none;">Accéder à votre espace</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Bienvenue chez Paname Consulting',
      html: html,
    });
  }

  /**
   * Email de vérification d'adresse email
   */
  async sendVerificationEmail(email: string, verificationToken: string, firstName: string): Promise<boolean> {
    const appUrl = this.configService.get<string>('FRONTEND_URL') || 'https://panameconsulting.vercel.app';
    const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">Vérification de votre adresse email</h1>
        </div>
        <div class="content">
          <p>Bonjour <strong>${firstName}</strong>,</p>
          <p>Pour finaliser votre inscription, veuillez vérifier votre adresse email :</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" class="button">Vérifier mon adresse email</a>
          </div>

          <p style="color: #94a3b8; font-size: 14px;">
            Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
          </p>
          
          <div class="footer">
            <p>Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Vérification de votre adresse email - Paname Consulting',
      html: html,
    });
  }

  /**
   * Email d'alerte admin
   */
  async sendAdminAlert(subject: string, message: string): Promise<boolean> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || this.configService.get<string>('EMAIL_USER');
    
    if (!adminEmail) {
      this.logger.warn('📧 Email admin non configuré - alerte ignorée');
      return false;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 25px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
          .alert-box { background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 4px solid #ef4444; margin: 15px 0; }
          .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0; font-size: 20px;">⚠️ Alerte Administration</h2>
        </div>
        <div class="content">
          <p><strong>Sujet :</strong> ${subject}</p>
          <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>
          
          <div class="alert-box">
            <p style="white-space: pre-line; margin: 0;">${message}</p>
          </div>
          
          <div class="footer">
            <p>Alerte générée automatiquement par le système</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: adminEmail,
      subject: `[ALERTE] ${subject}`,
      html: html,
    });
  }

  /**
   * Masquage d'email pour les logs
   */
  private maskEmail(email: string): string {
    if (!email?.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    return `${name.substring(0, 2)}***@${domain}`;
  }

  /**
   * Vérifie si le service est disponible
   */
  getStatus(): { available: boolean; message: string } {
    return {
      available: this.isAvailable,
      message: this.isAvailable 
        ? '📧 Service email disponible' 
        : '❌ Service email indisponible - configurez EMAIL_USER et EMAIL_PASS'
    };
  }
}