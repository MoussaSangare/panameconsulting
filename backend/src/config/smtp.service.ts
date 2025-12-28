import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
}

export interface SmtpStatus {
  available: boolean;
  message: string;
  host: string;
  port: number;
  secure: boolean;
  fromEmail: string;
}

@Injectable()
export class SmtpService {
  private transporter: nodemailer.Transporter;
  private logger = new Logger('SMTP');

  constructor(private configService: ConfigService) {
    // Configuration minimale qui marche en production
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER || this.configService.get<string>('EMAIL_USER') || 'panameconsulting906@gmail.com',
        pass: process.env.EMAIL_PASS || this.configService.get<string>('EMAIL_PASS'),
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
    });
  }

  isServiceAvailable(): boolean {
    const emailUser = process.env.EMAIL_USER || this.configService.get<string>('EMAIL_USER');
    const emailPass = process.env.EMAIL_PASS || this.configService.get<string>('EMAIL_PASS');
    
    if (!emailUser || !emailPass) {
      return false;
    }
    return true;
  }

  // Fix: Accept EmailOptions object instead of separate parameters
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
      await this.transporter.sendMail({
        from: `Paname Consulting <${process.env.EMAIL_USER || this.configService.get<string>('EMAIL_USER')}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
        priority: options.priority,
      });
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Erreur email: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Add missing method
  getStatus(): SmtpStatus {
    const emailUser = process.env.EMAIL_USER || this.configService.get<string>('EMAIL_USER');
    
    return {
      available: this.isServiceAvailable(),
      message: this.isServiceAvailable() ? 'Service disponible' : 'Service non configuré',
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      fromEmail: emailUser || 'Non configuré'
    };
  }

  // Add missing method
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const isAvailable = this.isServiceAvailable();
      if (!isAvailable) {
        return {
          success: false,
          message: 'Service non configuré (EMAIL_USER ou EMAIL_PASS manquant)'
        };
      }

      await this.transporter.verify();
      return {
        success: true,
        message: 'Connexion SMTP réussie'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Erreur de connexion SMTP: ${error.message}`
      };
    }
  }
}