import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Rendezvous } from "../schemas/rendezvous.schema";
import { Procedure, StepStatus } from "../schemas/procedure.schema";
import { Contact } from "../schemas/contact.schema";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;
  private emailServiceAvailable: boolean = false;
  private readonly appName = "Paname Consulting";
  private fromEmail: string;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

private async initializeTransporter(): Promise<void> {
  const emailUser = this.configService.get("EMAIL_USER");
  
  if (!this.configService.get("EMAIL_HOST") || !emailUser || !this.configService.get("EMAIL_PASS")) {
    this.logger.warn('Configuration email incomplète - notifications désactivées');
    this.emailServiceAvailable = false;
    return;
  }

  try {
    this.fromEmail = `"${this.appName}" <${emailUser}>`;
    
    const port = parseInt(this.configService.get("EMAIL_PORT"));
    const secure = false; // Toujours false pour port 587
    const useTls = port === 587; // STARTTLS pour le port 587
    
    this.transporter = nodemailer.createTransport({
      host: this.configService.get("EMAIL_HOST"),
      port: port,
      secure: secure, // false pour port 587
      requireTLS: useTls, // true pour port 587
      ignoreTLS: !useTls, // false pour port 587
      auth: {
        user: emailUser,
        pass: this.configService.get("EMAIL_PASS"),
      },
      tls: {
        rejectUnauthorized: true,
        ciphers: 'SSLv3'
      },
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 60000,
    });

    await this.testConnection();
    this.emailServiceAvailable = true;
    this.logger.log('Service notification email initialisé avec succès');
    
  } catch (error) {
    this.logger.error(`Erreur initialisation service notification: ${error.message}`, error.stack);
    this.emailServiceAvailable = false;
  }
}

  private async testConnection(): Promise<void> {
    if (!this.transporter) {
      throw new Error('Transporter non initialisé');
    }
    await this.transporter.verify();
  }

  private async sendEmail(
    to: string, 
    subject: string, 
    html: string, 
    context: string,
    replyTo?: string
  ): Promise<boolean> {
    const maskedEmail = this.maskEmail(to);
    
    if (!this.emailServiceAvailable || !this.transporter) {
      this.logger.warn(`Notification "${context}" pour ${maskedEmail} - service indisponible`);
      return false;
    }

    try {
      const mailOptions: any = {
        from: this.fromEmail,
        to: to,
        subject: subject,
        html: html
      };

      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email ${context} envoyé à: ${maskedEmail}`);
      return true;
      
    } catch (error) {
      this.logger.error(`Erreur envoi ${context}: ${error.message}`);
      if (error.message.includes('BadCredentials') || error.message.includes('Invalid login')) {
        this.emailServiceAvailable = false;
        this.logger.warn('Service notification email désactivé - erreur authentification');
      }
      return false;
    }
  }

  private getBaseTemplate(header: string, content: string, firstName: string): string {
    const emailUser = this.configService.get("EMAIL_USER");
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #334155; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
          }
          .header { 
            background: linear-gradient(135deg, #0ea5e9, #0369a1); 
            color: white; 
            padding: 25px 20px; 
            text-align: center; 
            border-radius: 10px 10px 0 0;
          }
          .content { 
            background: #f8fafc; 
            padding: 30px; 
            border-radius: 0 0 10px 10px; 
            border: 1px solid #e2e8f0;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #e2e8f0; 
            color: #64748b; 
            font-size: 12px; 
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: linear-gradient(135deg, #0ea5e9, #0369a1); 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 15px 0;
            font-weight: bold;
          }
          .info-box { 
            background: white; 
            padding: 18px; 
            border-radius: 8px; 
            border-left: 4px solid #0ea5e9; 
            margin: 20px 0;
            border: 1px solid #e2e8f0;
          }
          .highlight { 
            color: #0369a1; 
            font-weight: 600;
          }
          @media (max-width: 600px) {
            body { padding: 10px; }
            .content { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">${header}</h1>
        </div>
        <div class="content">
          <p>Bonjour <span class="highlight">${firstName}</span>,</p>
          ${content}
          <div class="footer">
            <p>Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
            <p style="margin-top: 10px; font-size: 11px;">
              ${emailUser}<br>
              <a href="https://www.panameconsulting.vercel.app" style="color: #64748b;">
                www.panameconsulting.com
              </a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendConfirmation(rendezvous: Rendezvous): Promise<void> {
    const dateFormatted = new Date(rendezvous.date).toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const content = `
      <p>Votre rendez-vous a été <strong>confirmé avec succès</strong>.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Détails de votre rendez-vous :</h3>
        <p><strong>Date :</strong> ${dateFormatted}</p>
        <p><strong>Heure :</strong> ${rendezvous.time}</p>
        <p><strong>Lieu :</strong> Paname Consulting Kalaban Coura<br>Imm.Boré en face de l'Hôtel Wassulu</p>
      </div>
      
      <p>Nous vous attendons avec impatience pour échanger sur votre projet d'études.</p>
      
      <p style="color: #64748b; font-size: 14px;">
        <em>Vous recevrez un rappel la veille de votre rendez-vous.</em>
      </p>
    `;

    await this.sendEmail(
      rendezvous.email,
      "Confirmation de votre rendez-vous - Paname Consulting",
      this.getBaseTemplate("Rendez-vous Confirmé", content, rendezvous.firstName),
      "confirmation rendez-vous"
    );
  }

  async sendReminder(rendezvous: Rendezvous): Promise<void> {
    const content = `
      <p><strong>Rappel :</strong> Vous avez un rendez-vous aujourd'hui !</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Votre rendez-vous :</h3>
        <p><strong>Heure :</strong> ${rendezvous.time}</p>
        <p><strong>Lieu :</strong> Paname Consulting Kalaban Coura<br>Imm.Boré en face de l'Hôtel Wassulu</p>
      </div>
      
      <p>Préparez vos questions, nous sommes impatients de vous accompagner dans votre projet.</p>
      
      <p style="text-align: center; color: #0369a1; font-weight: bold; margin-top: 20px;">
        À très vite !
      </p>
    `;

    await this.sendEmail(
      rendezvous.email,
      "Rappel - Votre rendez-vous aujourd'hui - Paname Consulting",
      this.getBaseTemplate("Rappel de Rendez-vous", content, rendezvous.firstName),
      "rappel rendez-vous"
    );
  }

  async sendStatusUpdate(rendezvous: Rendezvous): Promise<void> {
    let content = "";
    let subject = "";
    let header = "Mise à jour de Rendez-vous";

    if (rendezvous.status === "Confirmé") {
      subject = "Rendez-vous Confirmé - Paname Consulting";
      content = `
        <p>Votre rendez-vous a été <strong>confirmé</strong> par notre équipe.</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0;">Détails mis à jour :</h3>
          <p><strong>Date :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
          <p><strong>Heure :</strong> ${rendezvous.time}</p>
          <p><strong>Statut :</strong> <span style="color: #059669; font-weight: bold;">Confirmé</span></p>
        </div>
        
        <p>Nous vous attendons avec impatience !</p>
      `;
    } else if (rendezvous.status === "Annulé") {
      subject = "Rendez-vous Annulé - Paname Consulting";
      header = "Rendez-vous Annulé";
      content = `
        <p>Votre rendez-vous a été <strong>annulé</strong>.</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0;">Informations :</h3>
          <p><strong>Date prévue :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
          <p><strong>Heure prévue :</strong> ${rendezvous.time}</p>
          ${rendezvous.avisAdmin ? `<p><strong>Raison :</strong> ${rendezvous.avisAdmin}</p>` : ""}
        </div>
        
        <p>Si vous souhaitez reprogrammer un rendez-vous, n'hésitez pas à nous contacter.</p>
      `;
    } else if (rendezvous.status === "Terminé") {
      header = "Rendez-vous Terminé";
      if (rendezvous.avisAdmin === "Favorable") {
        subject = "Rendez-vous Terminé - Procédure Lancée - Paname Consulting";
        content = `
          <p>Votre rendez-vous s'est <strong>excellentement déroulé</strong> !</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0;">Avis favorable</h3>
            <p>Nous sommes ravis de vous annoncer que votre dossier a reçu un <strong>avis favorable</strong>.</p>
            <p><strong>Prochaine étape :</strong> Votre procédure d'admission a été officiellement lancée.</p>
          </div>
          
          <p>Vous recevrez sous peu un email détaillant les étapes de votre procédure.</p>
          
          <p style="text-align: center; color: #059669; font-weight: bold; margin: 20px 0;">
            Félicitations pour cette première étape réussie !
          </p>
        `;
      } else if (rendezvous.avisAdmin === "Défavorable") {
        subject = "Rendez-vous Terminé - Avis Défavorable - Paname Consulting";
        content = `
          <p>Votre rendez-vous est maintenant <strong>terminé</strong>.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0;">Avis défavorable</h3>
            <p>Malheureusement, votre dossier n'a pas reçu un avis favorable à l'issue de l'entretien.</p>
            <p>Notre équipe reste à votre disposition pour discuter des alternatives possibles.</p>
          </div>
          
          <p>N'hésitez pas à nous contacter pour plus d'informations.</p>
        `;
      }
    } else if (rendezvous.status === "En attente") {
      subject = "Statut Modifié - En Attente - Paname Consulting";
      header = "Rendez-vous en Attente";
      content = `
        <p>Le statut de votre rendez-vous a été modifié.</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0;">Nouveau statut : En attente</h3>
          <p>Votre rendez-vous est en attente de confirmation.</p>
          <p>Nous vous tiendrons informé dès qu'il sera confirmé.</p>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">
          <em>Merci pour votre patience.</em>
        </p>
      `;
    }

    if (content && subject) {
      await this.sendEmail(
        rendezvous.email,
        subject,
        this.getBaseTemplate(header, content, rendezvous.firstName),
        `mise à jour statut: ${rendezvous.status}`
      );
    }
  }

  async sendProcedureUpdate(procedure: Procedure): Promise<void> {
    const currentStep = procedure.steps.find(
      (s) => s.statut === StepStatus.IN_PROGRESS
    );
    const completedSteps = procedure.steps.filter(
      (s) => s.statut === StepStatus.COMPLETED
    ).length;
    const totalSteps = procedure.steps.length;
    const progress = Math.round((completedSteps / totalSteps) * 100);

    let content = "";
    let header = "Mise à jour de Procédure";
    let subject = "Mise à jour de votre procédure - Paname Consulting";

    if (currentStep) {
      content = `
        <p>Votre procédure d'admission <strong>avance</strong> !</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0;">Progression : ${progress}%</h3>
          <p><strong>Étape en cours :</strong> ${currentStep.nom}</p>
          <p><strong>Statut global :</strong> ${procedure.statut}</p>
          ${currentStep.raisonRefus ? `<p><strong>Commentaire :</strong> ${currentStep.raisonRefus}</p>` : ""}
        </div>
        
        <p>Nous travaillons activement sur votre dossier pour garantir le succès de votre projet.</p>
      `;
    } else {
      subject = "Procédure Terminée - Paname Consulting";
      header = "Procédure Finalisée";
      content = `
        <p><strong>Félicitations !</strong> Votre procédure d'admission est <strong>terminée</strong>.</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0;">Procédure finalisée</h3>
          <p><strong>Statut :</strong> <span style="color: #059669; font-weight: bold;">${procedure.statut}</span></p>
          <p>Toutes les étapes ont été complétées avec succès.</p>
        </div>
        
        <p>Notre équipe vous contactera très prochainement pour la suite des démarches.</p>
      `;
    }

    await this.sendEmail(
      procedure.email,
      subject,
      this.getBaseTemplate(header, content, procedure.prenom),
      "mise à jour procédure"
    );
  }

  async sendProcedureCreation(
    procedure: Procedure,
    _rendezvous: Rendezvous
  ): Promise<void> {
    const content = `
      <p><strong>Félicitations !</strong> Suite à votre rendez-vous favorable, votre procédure d'admission a été <strong>officiellement lancée</strong>.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Votre procédure est entamée</h3>
        <p><strong>Destination :</strong> ${procedure.destination}</p>
        <p><strong>Nombre d'étapes :</strong> ${procedure.steps.length}</p>
      </div>
      
      <p>Vous pouvez suivre l'avancement de votre procédure dans votre espace personnel.</p>
      
      <p><strong>Notre équipe vous accompagne à chaque étape !</strong></p>
    `;

    await this.sendEmail(
      procedure.email,
      "Votre procédure est lancée ! - Paname Consulting",
      this.getBaseTemplate("Procédure Créée", content, procedure.prenom),
      "création procédure"
    );
  }

  async sendContactReply(contact: Contact, reply: string): Promise<void> {
    const content = `
      <p>Nous vous remercions de votre message et nous tenons à vous répondre personnellement.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Notre réponse :</h3>
        <p>${reply}</p>
      </div>
      
      <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #475569;">Rappel de votre demande :</h4>
        <p style="color: #64748b;">${contact.message}</p>
      </div>
      
      <p>N'hésitez pas à nous recontacter si vous avez d'autres questions.</p>
    `;

    await this.sendEmail(
      contact.email,
      "Réponse à votre message - Paname Consulting",
      this.getBaseTemplate("Réponse de notre équipe", content, contact.firstName || "Cher client"),
      "réponse contact"
    );
  }

  async sendContactNotification(contact: Contact): Promise<void> {
    const adminEmail = this.configService.get("EMAIL_USER");
    if (!adminEmail) {
      this.logger.warn("EMAIL_USER non configuré - notification contact ignorée");
      return;
    }

    const content = `
      <p>Un <strong>nouveau message de contact</strong> a été reçu via le site web.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Informations du contact :</h3>
        <p><strong>Nom :</strong> ${contact.firstName} ${contact.lastName}</p>
        <p><strong>Email :</strong> ${contact.email}</p>
      </div>
      
      <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #475569;">Message :</h4>
        <p>${contact.message}</p>
      </div>
      
      <p style="color: #64748b; font-size: 14px;">
        <em>Pour répondre : Cliquez sur "Répondre" dans votre client email.</em>
      </p>
    `;

    await this.sendEmail(
      adminEmail,
      'Nouveau message de contact - Paname Consulting',
      this.getBaseTemplate("Nouveau Message Contact", content, "Équipe"),
      'notification contact admin',
      contact.email
    );
  }

  async sendContactConfirmation(contact: Contact): Promise<void> {
    const content = `
      <p>Nous accusons <strong>réception de votre message</strong> et vous remercions de l'intérêt que vous portez à Paname Consulting.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Confirmation de réception</h3>
        <p>Votre demande a bien été enregistrée et sera traitée dans les plus brefs délais.</p>
      </div>
      
      <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #475569;">Résumé de votre message :</h4>
        <p style="color: #64748b;">${contact.message}</p>
      </div>
      
      <p>Un membre de notre équipe vous contactera dans les <strong>48 heures ouvrables</strong>.</p>
    `;

    await this.sendEmail(
      contact.email,
      'Confirmation de votre message - Paname Consulting',
      this.getBaseTemplate("Confirmation de Réception", content, contact.firstName || "Cher client"),
      'confirmation contact'
    );
  }

  async sendCancellationNotification(procedure: Procedure): Promise<void> {
    const content = `
      <p>Nous vous informons que votre procédure d'admission a été <strong>annulée</strong>.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Détails de l'annulation :</h3>
        <p><strong>Destination :</strong> ${procedure.destination}</p>
        <p><strong>Date d'annulation :</strong> ${new Date().toLocaleDateString("fr-FR")}</p>
        <p><strong>Statut :</strong> <span style="color: #dc2626; font-weight: bold;">Annulée</span></p>
      </div>
      
      <p>Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez plus d'informations, n'hésitez pas à nous contacter.</p>
    `;

    await this.sendEmail(
      procedure.email,
      "Annulation de votre procédure - Paname Consulting",
      this.getBaseTemplate("Procédure Annulée", content, procedure.prenom),
      "notification annulation"
    );
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `***@${domain}`;
    return `${name.substring(0, 2)}***@${domain}`;
  }
}
