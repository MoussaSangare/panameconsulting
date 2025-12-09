import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private emailServiceAvailable: boolean = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

 private initializeTransporter() {
     if(!this.configService.get('EMAIL_HOST') || !this.configService.get('EMAIL_USER') || !this.configService.get('EMAIL_PASS')) {
       this.logger.warn('Configuration email incomplète - service email désactivé');
       this.emailServiceAvailable = false;
       return;
     }
 
     try {
       this.transporter = nodemailer.createTransport({
         host: this.configService.get('EMAIL_HOST'),
         port: this.configService.get('EMAIL_PORT'),
         secure: this.configService.get('EMAIL_SECURE') === 'true',
         auth: {
           user: this.configService.get('EMAIL_USER'),
           pass: this.configService.get('EMAIL_PASS'),
         },
         tls: {
           rejectUnauthorized: this.configService.get('NODE_ENV') === 'production',
           ciphers: 'SSLv3'
         },
         connectionTimeout: 30000,
         greetingTimeout: 15000,
         socketTimeout: 30000,
       });
 
       this.testConnection().then(success => {
           this.emailServiceAvailable = success;
           }).catch(() => {
             this.emailServiceAvailable = false;
         });
 
     } catch (error) {
       this.logger.error('Erreur initialisation service email', error.stack);
       this.emailServiceAvailable = false;
     }
   }
 
   private async testConnection(): Promise<boolean> {
     if (!this.transporter) {
       return false;
     }
 
     try {
       await this.transporter.verify();
       this.logger.log('Service email initialisé avec succès');
       return true;
     } catch (error) {
       this.logger.error(`Test connexion service email échoué: ${error.message}`);
       return false;
     }
   }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const maskedEmail = this.maskEmail(email);

    if (!this.emailServiceAvailable || !this.transporter) {
      this.logger.log(`Envoi lien réinitialisation à: ${maskedEmail} (service email indisponible)`);
      return;
    }

    const mailOptions = {
      from: `"Paname Consulting" <${this.configService.get("EMAIL_USER")}>`,
      to: email,
      subject: "Réinitialisation de votre mot de passe - Paname Consulting",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Réinitialisation de mot de passe</h1>
          </div>
          <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
            <p>Bonjour,</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour procéder :</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; padding: 12px 24px; background: #0ea5e9; 
                        color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Réinitialiser mon mot de passe
              </a>
            </div>

            <p style="color: #666; font-size: 14px;">
              <strong>Ce lien expirera dans 1 heure.</strong>
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #64748b; font-size: 12px;">
                Cordialement,<br>
                <strong>L'équipe Paname Consulting</strong>
              </p>
            </div>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email réinitialisation envoyé à: ${maskedEmail}`);
    } catch (error) {
      this.logger.error(`Erreur envoi email réinitialisation: ${error.message}`);
      
      if (
        error.message.includes("BadCredentials") ||
        error.message.includes("Invalid login")
      ) {
        this.emailServiceAvailable = false;
        this.logger.warn("Service email désactivé - erreur authentification");
      }
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const maskedEmail = this.maskEmail(email);

    if (!this.emailServiceAvailable || !this.transporter) {
      this.logger.log(`Email bienvenue pour: ${maskedEmail} (service email indisponible)`);
      return;
    }

    const mailOptions = {
      from: `"Paname Consulting" <${this.configService.get("EMAIL_USER")}>`,
      to: email,
      subject: "Bienvenue chez Paname Consulting",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Bienvenue chez Paname Consulting</h1>
          </div>
          <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0;">
            <p>Bonjour <strong>${firstName}</strong>,</p>
            <p>Nous sommes ravis de vous accueillir chez Paname Consulting !</p>
            
            <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #0ea5e9; margin: 15px 0;">
              <p><strong>Votre compte a été créé avec succès.</strong></p>
              <p>Vous pouvez maintenant accéder à votre espace personnel et prendre rendez-vous avec nos conseillers.</p>
            </div>

            <p>Nous sommes impatients de vous accompagner dans votre projet d'études à l'international.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #64748b; font-size: 12px;">
                Cordialement,<br>
                <strong>L'équipe Paname Consulting</strong>
              </p>
            </div>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email bienvenue envoyé à: ${maskedEmail}`);
    } catch (error) {
      this.logger.error(`Erreur envoi email bienvenue: ${error.message}`);
    }
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `***@${domain}`;
    return `${name.substring(0, 2)}***@${domain}`;
  }
}