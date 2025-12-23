import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private isAvailable: boolean = false;
  private fromEmail: string = '';

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  async initManually(): Promise<void> {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPass = this.configService.get<string>('EMAIL_PASS');

    if (!emailUser || !emailPass) {
      this.logger.error('❌ EMAIL_USER ou EMAIL_PASS manquant');
      this.isAvailable = false;
      return;
    }

    this.fromEmail = `"Paname Consulting" <${emailUser}>`;

    try {
      this.logger.log('🔄 Initialisation service email...');
      
      this.transporter = createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Utilise TLS
        auth: {
          user: emailUser,
          pass: emailPass
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
      });

      await this.transporter.verify();
      this.isAvailable = true;
      this.logger.log('✅ Service email opérationnel');
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur initialisation: ${error.message}`);
      
      // Tentative avec port 465 (SSL)
      try {
        this.logger.log('🔄 Tentative avec port 465 (SSL)...');
        
        this.transporter = createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true, // SSL
          auth: {
            user: emailUser,
            pass: emailPass
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000
        });

        await this.transporter.verify();
        this.isAvailable = true;
        this.logger.log('✅ Service email opérationnel (SSL:465)');
      } catch (sslError: any) {
        this.logger.error(`❌ Erreur SSL: ${sslError.message}`);
        this.isAvailable = false;
      }
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
    attachments?: Array<{
      filename: string;
      content?: Buffer | string;
      path?: string;
      contentType?: string;
    }>;
  }): Promise<boolean> {
    if (!this.isAvailable || !this.transporter) {
      this.logger.warn('📧 Envoi ignoré - service indisponible');
      return false;
    }

    try {
      const mailOptions = {
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`📧 Email envoyé à: ${this.maskEmail(options.to)}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ Erreur envoi: ${error.message}`);
      return false;
    }
  }

  /**
   * Email de réinitialisation de mot de passe
   */
  async sendPasswordReset(
    email: string, 
    resetToken: string, 
    firstName: string = ''
  ): Promise<boolean> {
    const appUrl = this.configService.get<string>('FRONTEND_URL') || 'https://panameconsulting.vercel.app';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation de mot de passe - Paname Consulting</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #f9fafb;
          }
          .container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border: 1px solid #e5e7eb;
          }
          .header { 
            background: linear-gradient(135deg, #0ea5e9, #0369a1); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .content { 
            padding: 40px 30px; 
          }
          .info-box { 
            background: #f8fafc; 
            padding: 25px; 
            border-radius: 8px; 
            border-left: 4px solid #0ea5e9; 
            margin: 25px 0; 
          }
          .button { 
            display: inline-block; 
            padding: 14px 28px; 
            background: linear-gradient(135deg, #0ea5e9, #0369a1); 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600;
            font-size: 15px;
            transition: all 0.2s ease;
          }
          .button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 25px; 
            border-top: 1px solid #e2e8f0; 
            text-align: center; 
            color: #6b7280; 
            font-size: 13px; 
          }
          .warning {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
            padding: 12px;
            border-radius: 6px;
            font-size: 14px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Réinitialisation de mot de passe</h1>
          </div>
          <div class="content">
            <p>Bonjour ${firstName ? `<strong>${firstName}</strong>` : 'Cher client'},</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour procéder :</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
            </div>

            <div class="info-box">
              <p style="margin: 0; color: #374151; font-size: 14px;">
                <strong>Informations importantes :</strong>
              </p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px;">
                <li>Ce lien est valable pendant <strong>1 heure</strong></li>
                <li>Ne partagez jamais ce lien avec personne</li>
                <li>Si vous n'avez pas fait cette demande, ignorez cet email</li>
              </ul>
            </div>

            <p style="color: #6b7280; font-size: 14px; text-align: center;">
              Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
              <code style="background: #f3f4f6; padding: 5px 10px; border-radius: 4px; font-size: 12px; word-break: break-all;">
                ${resetUrl}
              </code>
            </p>
            
            <div class="footer">
              <p>Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
              <p style="margin-top: 10px;">
                <a href="${appUrl}" style="color: #0ea5e9; text-decoration: none; font-weight: 500;">
                  Accéder à notre site
                </a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe - Paname Consulting',
      html,
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
        <title>Bienvenue chez Paname Consulting</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #f0f9ff;
          }
          .container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(14, 165, 233, 0.1);
            border: 1px solid #bae6fd;
          }
          .header { 
            background: linear-gradient(135deg, #0ea5e9, #0369a1); 
            color: white; 
            padding: 50px 30px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .content { 
            padding: 40px 30px; 
          }
          .welcome-box { 
            background: linear-gradient(135deg, #f0f9ff, #e0f2fe); 
            padding: 30px; 
            border-radius: 8px; 
            margin: 25px 0; 
            text-align: center;
            border: 1px solid #bae6fd;
          }
          .features {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin: 30px 0;
          }
          .feature {
            display: flex;
            align-items: flex-start;
            gap: 15px;
          }
          .feature-icon {
            background: #0ea5e9;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .button { 
            display: inline-block; 
            padding: 14px 28px; 
            background: linear-gradient(135deg, #0ea5e9, #0369a1); 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600;
            font-size: 15px;
            transition: all 0.2s ease;
          }
          .button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 25px; 
            border-top: 1px solid #e2e8f0; 
            text-align: center; 
            color: #6b7280; 
            font-size: 13px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bienvenue chez Paname Consulting</h1>
            <p>Votre aventure internationale commence ici</p>
          </div>
          <div class="content">
            <p>Bonjour <strong>${firstName}</strong>,</p>
            <p>Nous sommes ravis de vous accueillir dans la communauté <strong>Paname Consulting</strong> !</p>
            
            <div class="welcome-box">
              <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #0369a1;">
                🎉 Votre compte a été créé avec succès
              </p>
              <p style="margin: 0; font-size: 15px;">
                Vous pouvez maintenant accéder à toutes les fonctionnalités de votre espace personnel.
              </p>
            </div>

            <div class="features">
              <div class="feature">
                <div class="feature-icon">✓</div>
                <div>
                  <strong>Prendre rendez-vous</strong> avec nos conseillers experts
                </div>
              </div>
              <div class="feature">
                <div class="feature-icon">✓</div>
                <div>
                  <strong>Suivre votre procédure</strong> étape par étape
                </div>
              </div>
              <div class="feature">
                <div class="feature-icon">✓</div>
                <div>
                  <strong>Recevoir des notifications</strong> sur l'avancement de votre dossier
                </div>
              </div>
              <div class="feature">
                <div class="feature-icon">✓</div>
                <div>
                  <strong>Gérer vos documents</strong> en toute sécurité
                </div>
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}" class="button">Accéder à mon espace personnel</a>
            </div>

            <p>Nous sommes impatients de vous accompagner dans votre projet d'études à l'international et de vous aider à réaliser vos ambitions.</p>
            
            <div class="footer">
              <p>Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
              <p style="margin-top: 15px;">
                Pour toute question, n'hésitez pas à nous contacter à l'adresse :<br>
                <a href="mailto:support@panameconsulting.com" style="color: #0ea5e9; text-decoration: none;">
                  support@panameconsulting.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Bienvenue chez Paname Consulting',
      html,
    });
  }

  /**
   * Email de vérification d'adresse email
   */
  async sendVerificationEmail(
    email: string, 
    verificationToken: string, 
    firstName: string
  ): Promise<boolean> {
    const appUrl = this.configService.get<string>('FRONTEND_URL') || 'https://panameconsulting.vercel.app';
    const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vérification de votre adresse email - Paname Consulting</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #f0fdf4;
          }
          .container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(5, 150, 105, 0.1);
            border: 1px solid #a7f3d0;
          }
          .header { 
            background: linear-gradient(135deg, #10b981, #059669); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .content { 
            padding: 40px 30px; 
          }
          .button { 
            display: inline-block; 
            padding: 14px 28px; 
            background: linear-gradient(135deg, #10b981, #059669); 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600;
            font-size: 15px;
            transition: all 0.2s ease;
          }
          .button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
          }
          .verification-box {
            background: #f0fdf4;
            padding: 25px;
            border-radius: 8px;
            border: 1px solid #a7f3d0;
            margin: 25px 0;
            text-align: center;
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 25px; 
            border-top: 1px solid #e2e8f0; 
            text-align: center; 
            color: #6b7280; 
            font-size: 13px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Vérification de votre adresse email</h1>
          </div>
          <div class="content">
            <p>Bonjour <strong>${firstName}</strong>,</p>
            <p>Pour finaliser votre inscription et sécuriser votre compte, veuillez vérifier votre adresse email :</p>
            
            <div class="verification-box">
              <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #059669;">
                Cliquez sur le bouton ci-dessous pour vérifier votre email
              </p>
              <a href="${verifyUrl}" class="button">Vérifier mon adresse email</a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              <strong>Pourquoi vérifier votre email ?</strong><br>
              Cela nous permet de :<br>
              • Sécuriser votre compte<br>
              • Vous envoyer des notifications importantes<br>
              • Assurer que nous pouvons vous contacter
            </p>

            <p style="color: #9ca3af; font-size: 14px; text-align: center;">
              Si le bouton ne fonctionne pas, copiez-collez ce lien :<br>
              <code style="background: #f3f4f6; padding: 5px 10px; border-radius: 4px; font-size: 12px; word-break: break-all;">
                ${verifyUrl}
              </code>
            </p>

            <div class="footer">
              <p>Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
              <p style="margin-top: 10px; font-size: 12px; color: #9ca3af;">
                Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Vérification de votre adresse email - Paname Consulting',
      html,
    });
  }

  /**
   * Email d'alerte admin
   */
  async sendAdminAlert(subject: string, message: string): Promise<boolean> {
    const adminEmail = process.env.EMAIL_USER || this.configService.get<string>('EMAIL_USER');
    
    if (!adminEmail) {
      this.logger.warn('📧 Email admin non configuré');
      return false;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alerte Administration - Paname Consulting</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #fef2f2;
          }
          .container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(239, 68, 68, 0.1);
            border: 1px solid #fecaca;
          }
          .header { 
            background: linear-gradient(135deg, #ef4444, #dc2626); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
          }
          .content { 
            padding: 30px; 
          }
          .alert-box { 
            background: #fef2f2; 
            padding: 25px; 
            border-radius: 8px; 
            border-left: 4px solid #ef4444; 
            margin: 20px 0; 
          }
          .alert-details {
            background: #fff;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 20px;
            margin: 15px 0;
          }
          .footer { 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #e2e8f0; 
            text-align: center; 
            color: #6b7280; 
            font-size: 11px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⚠️ Alerte Administration</h2>
          </div>
          <div class="content">
            <div class="alert-box">
              <p style="margin: 0 0 15px 0; font-weight: 600; color: #dc2626;">
                Une alerte nécessitant votre attention a été déclenchée
              </p>
              
              <div class="alert-details">
                <p style="margin: 0 0 10px 0;">
                  <strong>Sujet :</strong> ${subject}
                </p>
                <p style="margin: 0 0 10px 0;">
                  <strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}
                </p>
                <p style="margin: 0 0 10px 0;">
                  <strong>Niveau :</strong> <span style="color: #dc2626; font-weight: 600;">ALERTE</span>
                </p>
              </div>

              <div style="background: #fff; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 15px 0;">
                <p style="margin: 0; white-space: pre-line; font-family: monospace; font-size: 13px; line-height: 1.5;">
                  ${message}
                </p>
              </div>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Action recommandée :</strong> Vérifier immédiatement la cause de cette alerte et prendre les mesures nécessaires.
              </p>
            </div>
            
            <div class="footer">
              <p>Alerte générée automatiquement par le système Paname Consulting</p>
              <p style="margin-top: 5px; font-size: 10px;">
                ID: ${Date.now()}-${Math.random().toString(36).substring(2, 9)}
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: adminEmail,
      subject: `[ALERTE] ${subject}`,
      html,
    });
  }

  /**
   * Masquage d'email pour les logs
   */
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    const maskedName = name.length > 2 
      ? name.substring(0, 2) + '***' + (name.length > 3 ? name.substring(name.length - 1) : '')
      : '***';
    return `${maskedName}@${domain}`;
  }

  /**
   * Vérifie si le service est disponible
   */
  getStatus(): { available: boolean; message: string } {
    return {
      available: this.isAvailable,
      message: this.isAvailable 
        ? '📧 Service email disponible' 
        : '❌ Service email indisponible - configurez EMAIL_USER et EMAIL_PASS dans les variables d\'environnement'
    };
  }

  /**
   * Teste la connexion SMTP
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.transporter) {
        await this.initialize();
      }
      
      if (this.isAvailable) {
        return {
          success: true,
          message: '✅ Service email opérationnel'
        };
      } else {
        return {
          success: false,
          message: '❌ Service email non disponible'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `❌ Erreur de test: ${error.message}`
      };
    }
  }
}