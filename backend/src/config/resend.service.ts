import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private resend: Resend;
  private isAvailable: boolean = false;
  private fromEmail: string = '';
  private readonly appName: string = 'Paname Consulting';

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  async initManually(): Promise<void> {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    const fromEmailAddress = this.configService.get<string>('EMAIL_USER') || process.env.EMAIL_USER;
    const resendApiKey = this.configService.get<string>('EMAIL_PASS') || process.env.EMAIL_PASS;

    if (!fromEmailAddress || !resendApiKey) {
      this.logger.error('❌ EMAIL_USER (From Email) ou EMAIL_PASS (Resend API Key) manquant');
      this.logger.error('💡 EMAIL_USER = Email expéditeur vérifié sur Resend');
      this.logger.error('💡 EMAIL_PASS = Clé API Resend (re_xxx)');
      this.isAvailable = false;
      return;
    }

    this.fromEmail = `${this.appName} <${fromEmailAddress}>`;

    try {
      this.logger.log('🔄 Initialisation du service Resend...');
      
      this.resend = new Resend(resendApiKey);
      this.isAvailable = true;
      
      this.logger.log('✅ Service Resend opérationnel');
      this.logger.log(`📧 Email expéditeur: ${fromEmailAddress}`);
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur initialisation Resend: ${error.message}`);
      this.isAvailable = false;
    }
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  }): Promise<boolean> {
    if (!this.isAvailable || !this.resend) {
      this.logger.warn(`📧 Email ignoré - service indisponible`);
      return false;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
      });

      this.logger.log(`📧 Email envoyé à: ${this.maskEmail(options.to)}`);
      return true;
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur envoi email: ${error.message}`);
      return false;
    }
  }

  private maskEmail(email: string): string {
    if (!email?.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    const masked = name.length > 2 ? name.substring(0, 2) + '***' : '***';
    return `${masked}@${domain}`;
  }

  getStatus(): { available: boolean; message: string } {
    return {
      available: this.isAvailable,
      message: this.isAvailable 
        ? '✅ Service Resend opérationnel' 
        : '❌ Service indisponible - vérifiez EMAIL_USER (From Email) et EMAIL_PASS (API Key)'
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.resend) {
        await this.initialize();
      }
      
      return {
        success: this.isAvailable,
        message: this.isAvailable 
          ? '✅ Service Resend opérationnel' 
          : '❌ Service indisponible - vérifiez EMAIL_USER et EMAIL_PASS'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  getFromEmail(): string {
    return this.fromEmail;
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }
}
