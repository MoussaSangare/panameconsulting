import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private emailServiceAvailable: boolean = false;
  private fromEmail: string = '';

  constructor() {
    this.initializeEmailService();
  }

  private async initializeEmailService() {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      this.logger.warn('❌ Service email désactivé - EMAIL_USER ou EMAIL_PASS manquants');
      return;
    }

    this.fromEmail = `"Paname Consulting" <${emailUser}>`;

    try {
      this.logger.log('🔄 Initialisation du service email Gmail...');
      
      // Configuration simplifiée - nodemailer gère automatiquement port/secure pour Gmail
      this.transporter = nodemailer.createTransport({
        service: 'gmail', // Utilise la configuration prédéfinie pour Gmail
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });

      // Vérification de la connexion
      await this.transporter.verify();
      this.emailServiceAvailable = true;
      this.logger.log('✅ Service email Gmail initialisé avec succès');
      
    } catch (error) {
      this.logger.error(`❌ Échec initialisation email: ${error.message}`);
      this.emailServiceAvailable = false;
    }
  }

  async initManually(): Promise<void> {
    await this.initializeEmailService();
  }

  async sendEmail(
    to: string, 
    subject: string, 
    html: string,
    text?: string,
    context?: string
  ): Promise<boolean> {
    if (!this.emailServiceAvailable) {
      this.logger.warn(`📧 Email "${context || subject}" ignoré - service indisponible`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: to,
        subject: subject,
        html: html,
        text: text
      });
      
      this.logger.log(`📧 Email envoyé (${context || subject}) à: ${this.maskEmail(to)}`);
      return true;
      
    } catch (error) {
      this.logger.error(`❌ Erreur envoi email (${context || subject}): ${error.message}`);
      return false;
    }
  }

  async sendTemplateEmail(
    to: string,
    subject: string,
    templateName: string,
    templateData: Record<string, any>,
    context?: string
  ): Promise<boolean> {
    // Générer le HTML à partir du template et des données
    const html = this.generateTemplate(templateName, templateData);
    
    return await this.sendEmail(to, subject, html, undefined, context);
  }

  private generateTemplate(templateName: string, data: Record<string, any>): string {
    // Templates HTML de base
    const templates: Record<string, (data: any) => string> = {
      'base': (data) => `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Paname Consulting - ${data.title || 'Notification'}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; }
            .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 30px 20px; text-align: center; }
            .content { background: white; padding: 30px; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
            .info-box { background: #f8fafc; padding: 20px; border-radius: 6px; border-left: 4px solid #0ea5e9; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 4px; }
            .website-link { color: #0284c7; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">Paname Consulting</h1>
            <p style="margin: 5px 0 0 0;">${data.header || 'Notification'}</p>
          </div>
          <div class="content">
            ${data.greeting ? `<p>${data.greeting},</p>` : ''}
            ${data.content || ''}
            <div class="footer">
              <p>Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
              <p>
                <a href="https://panameconsulting.vercel.app" class="website-link">panameconsulting.vercel.app</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      
      'simple': (data) => `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <p>${data.message || ''}</p>
          ${data.signature ? `<p>${data.signature}</p>` : ''}
        </body>
        </html>
      `
    };

    const template = templates[templateName] || templates['base'];
    return template(data);
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    const maskedName = name.length > 2 
      ? name.substring(0, 2) + '***' + name.substring(name.length - 1)
      : '***';
    return `${maskedName}@${domain}`;
  }

  getEmailStatus(): { available: boolean; message: string; fromEmail: string } {
    return {
      available: this.emailServiceAvailable,
      message: this.emailServiceAvailable 
        ? '📧 Service email disponible' 
        : '❌ Service email indisponible - vérifiez EMAIL_USER et EMAIL_PASS',
      fromEmail: this.fromEmail
    };
  }

  async testConnection(): Promise<boolean> {
    if (!this.emailServiceAvailable) {
      await this.initializeEmailService();
    }
    return this.emailServiceAvailable;
  }
}