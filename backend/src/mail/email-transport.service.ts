// src/mail/email-transport.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Logger } from '@nestjs/common';

@Injectable()
export class EmailTransportService implements OnModuleInit {
  private readonly logger = new Logger(EmailTransportService.name);
  private transporter: nodemailer.Transporter;
  private isAvailable = false;
  private fromEmail: string = '';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    const emailUser = this.configService.get('EMAIL_USER');
    const emailPass = this.configService.get('EMAIL_PASS');
    
    if (!emailUser || !emailPass) {
      this.logger.warn('Email service not configured - EMAIL_USER or EMAIL_PASS missing');
      this.isAvailable = false;
      return;
    }

    this.fromEmail = `"Paname Consulting" <${emailUser}>`;
    
    const host = this.configService.get<string>('EMAIL_HOST') || 'smtp.gmail.com';
    const port = parseInt(this.configService.get<string>('EMAIL_PORT') || '587');
    const secure = this.configService.get<string>('EMAIL_SECURE') === 'true';

    this.logger.log(`Initializing email transport to ${host}:${port} (secure: ${secure})`);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      socketTimeout: 30000,
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      debug: process.env.NODE_ENV === 'production',
    });

    try {
      this.logger.log('Verifying email connection...');
      await this.transporter.verify();
      this.isAvailable = true;
      this.logger.log(`Email transport service initialized successfully (${host}:${port})`);
    } catch (error) {
      this.logger.error(`Failed to initialize email transport: ${error.message}`);
      this.logger.error('Check your email credentials and network connection');
      this.isAvailable = false;
    }
  }

  async sendEmail(options: nodemailer.SendMailOptions): Promise<boolean> {
    if (!this.isAvailable) {
      this.logger.warn('Email service is not available');
      return false;
    }

    const emailUser = this.configService.get('EMAIL_USER');
    
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.fromEmail,
      replyTo: emailUser,
      ...options,
    };

    try {
      const sendPromise = this.transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Email sending timeout after 30s')), 30000)
      );
      
      await Promise.race([sendPromise, timeoutPromise]);
      this.logger.debug(`Email sent successfully to: ${this.maskEmail(options.to as string)}`);
      return true;
    } catch (error) {
      this.logger.error(`Email sending error: ${error.message}`);
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      return false;
    }
  }

  getTransporter(): nodemailer.Transporter | null {
    return this.isAvailable ? this.transporter : null;
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  getFromEmail(): string {
    return this.fromEmail;
  }

  getSupportEmail(): string {
    return this.configService.get('EMAIL_USER');
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    return `${name.substring(0, 2)}***@${domain}`;
  }

  async checkConnection(): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('Email connection verified successfully');
      return true;
    } catch (error) {
      this.logger.error('Email connection verification failed:', error.message);
      return false;
    }
  }
}