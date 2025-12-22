import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly appName = "Paname Consulting";
  private readonly fromEmail: string;
  private readonly supportEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = `"${this.appName}" <${this.configService.get("EMAIL_USER")}>`;
    this.supportEmail = this.configService.get("EMAIL_USER") || this.configService.get("EMAIL_USER");
  }

  async onModuleInit() {
    await this.initializeTransporter();
  }
  private async initializeTransporter(): Promise<void> {
  const config = this.getEmailConfig();
  
  // Log de la config (sans le mot de passe)
  this.logger.log(`Config email: ${config.host}:${config.port} user:${config.user}`);
  
  try {
    // Configuration pour Railway (offre souvent un réseau restreint)
    const transporterOptions: any = {
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      // Configuration optimisée pour Railway
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      pool: true,
      maxConnections: 1, // Réduit le nombre de connexions simultanées
      maxMessages: 10,
    };

    // Désactiver complètement les vérifications TLS si nécessaire
    if (config.port === 587) {
      transporterOptions.tls = {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      };
      transporterOptions.requireTLS = true;
      transporterOptions.ignoreTLS = false;
    }

    this.transporter = nodemailer.createTransport(transporterOptions);

    // Vérification avec retry
    let verified = false;
    for (let i = 0; i < 3 && !verified; i++) {
      try {
        await this.transporter.verify();
        verified = true;
        this.logger.log('✅ Connexion SMTP réussie');
      } catch (verifyError) {
        this.logger.warn(`Tentative ${i + 1}/3 échouée: ${verifyError.message}`);
        if (i < 2) await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
  } catch (error) {
    this.logger.error(`❌ Impossible d'initialiser le service email: ${error.message}`);    
    // En production, continuer sans email
    if (this.isProduction()) {
      this.logger.warn('L\'application continue sans service email');
    }
  }
}
  private getEmailConfig(): Partial<EmailConfig> {
    return {
      host: this.configService.get('EMAIL_HOST'),
      port: parseInt(this.configService.get('EMAIL_PORT')),
      secure: this.configService.get('EMAIL_SECURE'),
      user: this.configService.get('EMAIL_USER'),
      pass: this.configService.get('EMAIL_PASS'),
    };
  }


  private isProduction(): boolean {
    return this.configService.get('NODE_ENV') === 'production';
  }

  async sendEmail(to: string, template: EmailTemplate, context?: Record<string, any>): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Tentative d'envoi email - service indisponible`);
      return false;
    }

    // Validation de l'adresse email
    if (!to || !to.includes('@')) {
      this.logger.error(`Adresse email invalide: ${to}`);
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
      this.logger.log(`✅ Email envoyé à: ${this.maskEmail(to)}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Erreur envoi email à ${this.maskEmail(to)}: ${error.message}`);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const template = this.getPasswordResetTemplate(resetUrl);
    const success = await this.sendEmail(email, template);
    
    if (success) {
      this.logger.log(`✅ Email de réinitialisation envoyé à: ${this.maskEmail(email)}`);
    } else {
      this.logger.error(`❌ Échec d'envoi d'email de réinitialisation à: ${this.maskEmail(email)}`);
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const template = this.getWelcomeTemplate(firstName);
    const success = await this.sendEmail(email, template);
    
    if (success) {
      this.logger.log(`✅ Email de bienvenue envoyé à: ${this.maskEmail(email)}`);
    } else {
      this.logger.error(`❌ Échec d'envoi d'email de bienvenue à: ${this.maskEmail(email)}`);
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
          <div style="background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Réinitialisation de mot de passe</h1>
          </div>
          
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
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #64748b; font-size: 12px; line-height: 1.4;">
                Cordialement,<br>
                <strong style="color: #0ea5e9;">L'équipe Paname Consulting</strong><br>
                <a href="mailto:${this.supportEmail}" style="color: #64748b; text-decoration: none;">${this.supportEmail}</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  private getWelcomeTemplate(firstName: string): EmailTemplate {
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
          <div style="background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Bienvenue chez Paname Consulting</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <p>Bonjour <strong>${firstName}</strong>,</p>
            <p>Nous sommes ravis de vous accueillir chez <strong>Paname Consulting</strong> !</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0 0 15px 0;"><strong>Votre compte a été créé avec succès.</strong></p>
              <p style="margin: 0;">Vous pouvez maintenant accéder à votre espace personnel et prendre rendez-vous avec nos conseillers.</p>
            </div>

            <p>Nous sommes impatients de vous accompagner dans votre projet d'études à l'international.</p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #64748b; font-size: 12px; line-height: 1.4;">
                Cordialement,<br>
                <strong style="color: #0ea5e9;">L'équipe Paname Consulting</strong><br>
                <a href="mailto:${this.supportEmail}" style="color: #64748b; text-decoration: none;">${this.supportEmail}</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
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

  getServiceStatus(): { available: boolean; config: any } {
    return {
      available: !!this.transporter,
      config: {
        user: process.env.EMAIL_USER,
        fromEmail: this.fromEmail,
      }
    };
  }
}