import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('EMAIL_HOST') || 'smtp.gmail.com',
      port: this.configService.get('EMAIL_PORT') || 587,
      secure: this.configService.get('EMAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASS'),
      },
      tls: {
        rejectUnauthorized: this.configService.get('NODE_ENV') === 'production',
      },
    });
  }

  async checkConnection() {
      try {
      await this.transporter.verify();
      this.logger.log('Email service is connected');
      return true;
    } catch (error) {
      this.logger.error('Email service is not connected', error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const mailOptions = {
      from: `"${this.configService.get('EMAIL_USER')}" <${this.configService.get('EMAIL_USER')}>`,
      to: email,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Réinitialisation de mot de passe</h2>
          <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous pour procéder :</p>
          
          <p>
            <a href="${resetUrl}" 
               style="display: inline-block; padding: 10px 20px; background-color: #2563eb; 
                      color: white; text-decoration: none; border-radius: 4px;">
              Réinitialiser mon mot de passe
            </a>
          </p>

          <p>Ce lien expirera dans 1 heure.</p>
          <p style="font-size: 12px; color: #666;">
            Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.
          </p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error.stack);
      throw new Error('Failed to send password reset email');
    }
  }
  
}