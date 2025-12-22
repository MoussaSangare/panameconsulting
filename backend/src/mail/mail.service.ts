import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailConfigService } from "../config/email-config.service";
import { AppConfig } from "../config/configuration";

interface EmailTemplate {
  subject: string;
  html: string;
}

interface EmailContext {
  [key: string]: any;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly appName: string;
  private readonly frontendUrl: string;
  private readonly supportEmail: string;

  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly emailService: EmailConfigService
  ) {
    const config = this.configService.get<AppConfig>('app', { infer: true });
    this.appName = config.appName;
    this.frontendUrl = config.frontendUrl;
    this.supportEmail = config.emailFrom;
  }

  async sendEmail(
    to: string | string[],
    template: EmailTemplate,
    context?: EmailContext
  ): Promise<boolean> {
    const html = context ? this.renderTemplate(template.html, context) : template.html;
    
    return await this.emailService.sendEmail(to, template.subject, html, 'mail-service');
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;
    
    const template = this.getPasswordResetTemplate(resetUrl);
    const success = await this.sendEmail(email, template, { resetUrl });
    
    if (success) {
      this.logger.log(`✅ Email de réinitialisation envoyé à: ${this.emailService.maskEmail(email)}`);
    } else {
      this.logger.error(`❌ Échec d'envoi d'email de réinitialisation à: ${this.emailService.maskEmail(email)}`);
    }
    
    return success;
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    const template = this.getWelcomeTemplate(firstName);
    const success = await this.sendEmail(email, template, { firstName });
    
    if (success) {
      this.logger.log(`✅ Email de bienvenue envoyé à: ${this.emailService.maskEmail(email)}`);
    } else {
      this.logger.error(`❌ Échec d'envoi d'email de bienvenue à: ${this.emailService.maskEmail(email)}`);
    }
    
    return success;
  }

  async sendAccountVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
    const verificationUrl = `${this.frontendUrl}/verify-account?token=${verificationToken}`;
    
    const template = this.getVerificationTemplate(verificationUrl);
    const success = await this.sendEmail(email, template, { verificationUrl });
    
    if (success) {
      this.logger.log(`✅ Email de vérification envoyé à: ${this.emailService.maskEmail(email)}`);
    }
    
    return success;
  }

  async sendAdminNotification(subject: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<boolean> {
    const adminEmail = this.configService.get<string>('app.adminEmail', { infer: true });
    
    if (!adminEmail) {
      this.logger.warn('Email admin non configuré - notification ignorée');
      return false;
    }

    const template = this.getAdminNotificationTemplate(subject, message, priority);
    return await this.sendEmail(adminEmail, template, { subject, message, priority });
  }

  private getPasswordResetTemplate(resetUrl: string): EmailTemplate {
    return {
      subject: `Réinitialisation de mot de passe - ${this.appName}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Réinitialisation de mot de passe</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${this.appName}</p>
          </div>
          
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; margin-bottom: 25px; color: #1e293b;">
              Bonjour,
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 25px;">
              Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour procéder :
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{resetUrl}}" 
                 style="display: inline-block; padding: 16px 32px; 
                        background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); 
                        color: white; text-decoration: none; border-radius: 8px; 
                        font-weight: 600; font-size: 16px; letter-spacing: 0.5px;">
                Réinitialiser mon mot de passe
              </a>
            </div>

            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #0ea5e9; margin: 25px 0;">
              <p style="color: #64748b; font-size: 14px; margin: 0;">
                <strong>⏰ Important :</strong> Ce lien est valable pendant 1 heure seulement.
              </p>
            </div>
            
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin-top: 30px;">
              Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email ou 
              <a href="mailto:${this.supportEmail}" style="color: #0ea5e9; text-decoration: none;">contacter notre support</a> 
              immédiatement.
            </p>
            
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;">
                Cordialement,<br>
                <strong style="color: #0ea5e9;">L'équipe ${this.appName}</strong><br>
                <a href="mailto:${this.supportEmail}" style="color: #64748b; text-decoration: none;">${this.supportEmail}</a>
              </p>
            </div>
          </div>
        </div>
      `,
    };
  }

  private getWelcomeTemplate(firstName: string): EmailTemplate {
    return {
      subject: `Bienvenue chez ${this.appName} !`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Bienvenue !</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${this.appName} - Votre avenir commence ici</p>
          </div>
          
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; margin-bottom: 25px; color: #1e293b;">
              Bonjour <strong>{{firstName}}</strong>,
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 25px;">
              Nous sommes ravis de vous accueillir chez <strong>${this.appName}</strong> !
              Votre compte a été créé avec succès.
            </p>
            
            <div style="background: #d1fae5; padding: 25px; border-radius: 8px; margin: 25px 0;">
              <p style="margin: 0 0 15px 0; color: #065f46; font-weight: 600;">
                🎉 Votre compte est maintenant actif !
              </p>
              <p style="margin: 0; color: #047857;">
                Vous pouvez dès maintenant accéder à votre espace personnel, prendre rendez-vous avec nos conseillers et suivre vos procédures d'admission.
              </p>
            </div>

            <p style="color: #475569; line-height: 1.6; margin-bottom: 25px;">
              Nous sommes impatients de vous accompagner dans votre projet d'études à l'international.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${this.frontendUrl}/dashboard" 
                 style="display: inline-block; padding: 16px 32px; 
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                        color: white; text-decoration: none; border-radius: 8px; 
                        font-weight: 600; font-size: 16px;">
                Accéder à mon espace
              </a>
            </div>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="margin: 0 0 15px 0; color: #0369a1; font-weight: 600;">
                📋 Pour commencer :
              </p>
              <ul style="margin: 0; padding-left: 20px; color: #475569;">
                <li>Complétez votre profil</li>
                <li>Prenez rendez-vous avec un conseiller</li>
                <li>Explorez nos destinations et programmes</li>
                <li>Consultez nos guides et ressources</li>
              </ul>
            </div>
            
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;">
                À très bientôt,<br>
                <strong style="color: #10b981;">L'équipe ${this.appName}</strong><br>
                <a href="${this.frontendUrl}" style="color: #64748b; text-decoration: none;">${this.frontendUrl.replace('https://', '')}</a>
              </p>
            </div>
          </div>
        </div>
      `,
    };
  }

  private getVerificationTemplate(verificationUrl: string): EmailTemplate {
    return {
      subject: `Vérification de votre compte - ${this.appName}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Vérifiez votre compte</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${this.appName}</p>
          </div>
          
          <div style="padding: 40px 30px;">
            <p style="font-size: 18px; margin-bottom: 25px; color: #1e293b;">
              Bonjour,
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 25px;">
              Merci de vous être inscrit sur ${this.appName}. Pour activer votre compte et accéder à toutes les fonctionnalités, veuillez vérifier votre adresse email.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{verificationUrl}}" 
                 style="display: inline-block; padding: 16px 32px; 
                        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); 
                        color: white; text-decoration: none; border-radius: 8px; 
                        font-weight: 600; font-size: 16px;">
                Vérifier mon email
              </a>
            </div>

            <div style="background: #faf5ff; padding: 20px; border-radius: 8px; border-left: 4px solid #8b5cf6; margin: 25px 0;">
              <p style="color: #7c3aed; font-size: 14px; margin: 0;">
                <strong>💡 Pourquoi vérifier ?</strong><br>
                La vérification de votre email vous permet de recevoir des notifications importantes concernant vos rendez-vous et procédures.
              </p>
            </div>
            
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin-top: 30px;">
              Si vous n'avez pas créé de compte sur ${this.appName}, vous pouvez ignorer cet email en toute sécurité.
            </p>
            
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;">
                Cordialement,<br>
                <strong style="color: #8b5cf6;">L'équipe ${this.appName}</strong><br>
                <a href="mailto:${this.supportEmail}" style="color: #64748b; text-decoration: none;">${this.supportEmail}</a>
              </p>
            </div>
          </div>
        </div>
      `,
    };
  }

  private getAdminNotificationTemplate(subject: string, message: string, priority: string): EmailTemplate {
    const priorityColors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444'
    };

    const priorityLabels = {
      low: '🟢 Faible',
      medium: '🟡 Moyenne',
      high: '🔴 Haute'
    };

    return {
      subject: `[${priority.toUpperCase()}] ${subject} - ${this.appName}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, ${priorityColors[priority]} 0%, ${priorityColors[priority]}77 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Notification Admin</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${priorityLabels[priority]}</p>
          </div>
          
          <div style="padding: 40px 30px;">
            <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid ${priorityColors[priority]};">
              <h2 style="margin: 0 0 15px 0; color: #1e293b;">{{subject}}</h2>
              <p style="color: #475569; white-space: pre-line; line-height: 1.6; margin: 0;">
                {{message}}
              </p>
            </div>
            
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="margin: 0 0 10px 0; color: #475569; font-weight: 600;">
                📊 Informations système :
              </p>
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                <strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}<br>
                <strong>Environnement :</strong> ${process.env.NODE_ENV || 'production'}<br>
                <strong>Application :</strong> ${this.appName}
              </p>
            </div>
            
            <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;">
                Ceci est une notification automatique du système ${this.appName}.<br>
                <a href="${this.frontendUrl}/admin" style="color: ${priorityColors[priority]}; text-decoration: none;">Accéder à l'administration</a>
              </p>
            </div>
          </div>
        </div>
      `,
    };
  }

  private renderTemplate(html: string, context?: EmailContext): string {
    if (!context) return html;
    
    let rendered = html;
    Object.entries(context).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(placeholder, value);
    });
    return rendered;
  }

  getServiceStatus(): { available: boolean; config: any } {
    const emailStatus = this.emailService.getStatus();
    const config = this.configService.get<AppConfig>('app', { infer: true });
    
    return {
      available: emailStatus.available,
      config: {
        appName: config.appName,
        fromEmail: config.emailFrom,
        frontendUrl: config.frontendUrl,
        emailConfigured: !!config.emailUser,
      }
    };
  }
}