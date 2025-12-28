import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as SMTPTransport from 'nodemailer/lib/smtp-transport';

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
  isServiceAvailable() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return false;
    }
    return true;
  }
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
        user: process.env.EMAIL_USER || 'panameconsulting906@gmail.com' || this.configService.get<string>('EMAIL_USER') || 'moussa.sangare.ma@gmail.com',
        pass: process.env.EMAIL_PASS  || this.configService.get<string>('EMAIL_PASS'),
      },
      // Options critiques pour Docker
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: `Paname Consulting <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      });
      return true;
    } catch (error) {
      this.logger.error(`Erreur email: ${error.message}`);
      return false;
    }
  }
}