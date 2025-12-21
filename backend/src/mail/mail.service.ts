import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly appName = 'Paname Consulting';

  constructor(private readonly configService: ConfigService) {
    const emailUser = this.configService.get('EMAIL_USER');
    this.fromEmail = `"${this.appName}" <${emailUser}>`;
    // Pas d'initialisation automatique
  }

  private async getTransporter(): Promise<nodemailer.Transporter | null> {
    if (this.transporter) {
      return this.transporter;
    }

    const emailUser = this.configService.get('EMAIL_USER');
    const emailPass = this.configService.get('EMAIL_PASS');

    if (!emailUser || !emailPass) {
      this.logger.warn('Email non configuré - service désactivé');
      return null;
    }

    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        connectionTimeout: 3000,
        greetingTimeout: 3000,
        socketTimeout: 5000,
      });

      this.logger.log(`Service email initialisé pour ${this.maskEmail(emailUser)}`);
      return this.transporter;
    } catch (error) {
      this.logger.error(`Erreur initialisation email: ${error.message}`);
      return null;
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const transporter = await this.getTransporter();
    if (!transporter) {
      this.logger.warn(`Impossible d'envoyer l'email - service non disponible`);
      return false;
    }

    const mailOptions = {
      from: this.fromEmail,
      to: to,
      subject: subject,
      html: html,
    };

    try {
      await transporter.sendMail(mailOptions);
      this.logger.debug(`Email envoyé à: ${this.maskEmail(to)}`);
      return true;
    } catch (error) {
      this.logger.error(`Erreur envoi email à ${this.maskEmail(to)}: ${error.message}`);
      
      // Réinitialiser le transporteur en cas d'erreur de connexion
      if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        this.logger.warn('Réinitialisation du transporteur...');
        this.transporter = null;
      }
      
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const subject = 'Réinitialisation de votre mot de passe - Paname Consulting';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${this.appName}</h2>
        <p>Bonjour,</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <p>Cliquez sur le lien ci-dessous pour procéder :</p>
        <p style="margin: 30px 0;">
          <a href="${resetUrl}" style="padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Ce lien expire dans 20 minutes.<br>
          Si vous n'avez pas fait cette demande, ignorez cet email.
        </p>
        <p style="margin-top: 30px;">
          Cordialement,<br>
          L'équipe ${this.appName}
        </p>
      </div>
    `;

    const success = await this.sendEmail(email, subject, html);
    if (success) {
      this.logger.log(`Email de réinitialisation envoyé à: ${this.maskEmail(email)}`);
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const subject = 'Bienvenue chez Paname Consulting';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${this.appName}</h2>
        <p>Bonjour ${firstName},</p>
        <p>Bienvenue chez ${this.appName} !</p>
        <p>Votre compte a été créé avec succès.</p>
        <p>Vous pouvez maintenant accéder à votre espace personnel et prendre rendez-vous avec nos conseillers.</p>
        <p style="margin-top: 30px;">
          Cordialement,<br>
          L'équipe ${this.appName}
        </p>
      </div>
    `;

    const success = await this.sendEmail(email, subject, html);
    if (success) {
      this.logger.log(`Email de bienvenue envoyé à: ${this.maskEmail(email)}`);
    }
  }

  async checkConnection(): Promise<boolean> {
    const transporter = await this.getTransporter();
    if (!transporter) {
      return false;
    }

    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000)
      );
      
      await Promise.race([transporter.verify(), timeoutPromise]);
      this.logger.log('Connexion email vérifiée');
      return true;
    } catch (error) {
      this.logger.error(`Connexion email échouée: ${error.message}`);
      return false;
    }
  }

  private maskEmail(email: string): string {
    if (!email || typeof email !== 'string') return '***';
    if (!email.includes('@')) return '***@***';
    
    const [name, domain] = email.split('@');
    if (!name || !domain) return '***@***';
    
    const maskedName = name.length <= 2 
      ? name.charAt(0) + '*'
      : name.charAt(0) + '***' + (name.length > 1 ? name.charAt(name.length - 1) : '');
    
    return `${maskedName}@${domain}`;
  }

  getStatus(): { available: boolean; configured: boolean; fromEmail: string } {
    const emailUser = this.configService.get('EMAIL_USER');
    const emailPass = this.configService.get('EMAIL_PASS');
    
    return {
      available: !!this.transporter,
      configured: !!(emailUser && emailPass),
      fromEmail: this.maskEmail(emailUser || 'non configuré')
    };
  }
}