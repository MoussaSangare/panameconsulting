import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Rendezvous } from '../schemas/rendezvous.schema';
import { Procedure, ProcedureStatus, StepStatus } from '../schemas/procedure.schema';
import { ConfigService } from '@nestjs/config';
import { Contact } from '../schemas/contact.schema';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;
  private emailServiceAvailable: boolean = false;
  private fromEmail: string = '';
  private appName: string = 'Paname Consulting';
  private frontendUrl: string = 'https://panameconsulting.vercel.app';

  constructor(private configService: ConfigService) {
    this.initializeEmailService();
  }

  private initializeEmailService() {
    // 🔧 CONFIGURATION SIMPLIFIÉE POUR GMAIL
    const emailUser = this.configService.get<string>('EMAIL_USER') || process.env.EMAIL_USER;
    const emailPass = this.configService.get<string>('EMAIL_PASS') || process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      this.logger.warn('❌ Service email désactivé - EMAIL_USER ou EMAIL_PASS manquant');
      this.emailServiceAvailable = false;
      return;
    }

    this.emailServiceAvailable = true;
    this.fromEmail = `"Paname Consulting" <${emailUser}>`;
    
    // ✅ CONFIGURATION GMAIL FIXE
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    // ✅ TEST DE CONNEXION
    this.transporter.verify()
      .then(() => {
        this.logger.log('✅ Service email Gmail initialisé avec succès');
        this.logger.log(`📧 Envoi depuis: ${this.maskEmail(emailUser)}`);
      })
      .catch((error) => {
        this.logger.error(`❌ Échec de la connexion Gmail: ${error.message}`);
        this.emailServiceAvailable = false;
      });
  }

  private async sendEmail(
    to: string, 
    subject: string, 
    html: string, 
    context: string
  ): Promise<boolean> {
    if (!this.emailServiceAvailable) {
      this.logger.warn(`📧 Notification "${context}" ignorée - service email indisponible`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: to,
        subject: subject,
        html: html
      });
      
      this.logger.log(`📧 Email envoyé (${context}) à: ${this.maskEmail(to)}`);
      return true;
      
    } catch (error) {
      this.logger.error(`❌ Erreur "${context}": ${error.message}`);
      return false;
    }
  }

  private getBaseTemplate(header: string, content: string, firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.appName} - ${header}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; }
          .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 30px 20px; text-align: center; }
          .content { background: white; padding: 30px; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
          .info-box { background: #f8fafc; padding: 20px; border-radius: 6px; border-left: 4px solid #0ea5e9; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 4px; }
          .website-link { color: #0284c7; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">${this.appName}</h1>
          <p style="margin: 5px 0 0 0;">${header}</p>
        </div>
        <div class="content">
          <p>Bonjour <strong>${firstName}</strong>,</p>
          ${content}
          <div class="footer">
            <p>Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
            <p>
              <a href="${this.frontendUrl}" class="website-link">${this.frontendUrl.replace('https://', '')}</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ==================== RENDEZ-VOUS NOTIFICATIONS ====================

  async sendConfirmation(rendezvous: Rendezvous): Promise<boolean> {
    const dateFormatted = new Date(rendezvous.date).toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const content = `
      <p>Votre rendez-vous a été confirmé avec succès.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Détails du rendez-vous</h3>
        <p><strong>Date :</strong> ${dateFormatted}</p>
        <p><strong>Heure :</strong> ${rendezvous.time}</p>
        <p><strong>Lieu :</strong> Paname Consulting - Kalaban Coura</p>
        <p><strong>Statut :</strong> Confirmé</p>
      </div>
      
      <p>Nous vous attendons avec impatience.</p>
    `;

    return await this.sendEmail(
      rendezvous.email,
      "Confirmation de votre rendez-vous - Paname Consulting",
      this.getBaseTemplate("Rendez-vous Confirmé", content, rendezvous.firstName),
      "confirmation-rendezvous"
    );
  }

  async sendReminder(rendezvous: Rendezvous): Promise<boolean> {
    const content = `
      <p>Rappel : Vous avez un rendez-vous aujourd'hui.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Votre rendez-vous aujourd'hui</h3>
        <p><strong>Heure :</strong> ${rendezvous.time}</p>
        <p><strong>Lieu :</strong> Paname Consulting - Kalaban Coura</p>
      </div>
      
      <p>Nous sommes impatients de vous rencontrer.</p>
    `;

    return await this.sendEmail(
      rendezvous.email,
      "Rappel - Rendez-vous aujourd'hui - Paname Consulting",
      this.getBaseTemplate("Rappel de Rendez-vous", content, rendezvous.firstName),
      "rappel-rendezvous"
    );
  }

  async sendStatusUpdate(rendezvous: Rendezvous): Promise<boolean> {
    let content = "";
    let subject = "";
    let header = "Mise à jour de Rendez-vous";

    switch (rendezvous.status) {
      case "Confirmé":
        subject = "Rendez-vous Confirmé - Paname Consulting";
        content = `
          <p>Votre rendez-vous a été confirmé.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0;">Rendez-vous confirmé</h3>
            <p><strong>Date :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
            <p><strong>Heure :</strong> ${rendezvous.time}</p>
          </div>
        `;
        break;

      case "Annulé":
        subject = "Rendez-vous Annulé - Paname Consulting";
        header = "Rendez-vous Annulé";
        const cancelledBy = rendezvous.cancelledBy === 'admin' ? 'par notre équipe' : 'à votre demande';
        content = `
          <p>Votre rendez-vous a été annulé ${cancelledBy}.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0;">Rendez-vous annulé</h3>
            <p><strong>Date prévue :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
            <p><strong>Heure prévue :</strong> ${rendezvous.time}</p>
            ${rendezvous.cancellationReason ? `<p><strong>Raison :</strong> ${rendezvous.cancellationReason}</p>` : ""}
          </div>
          
          <p style="text-align: center; margin-top: 20px;">
            <a href="${this.frontendUrl}" class="button">Reprogrammer un rendez-vous</a>
          </p>
        `;
        break;

      case "Terminé":
        header = "Rendez-vous Terminé";
        if (rendezvous.avisAdmin === "Favorable") {
          subject = "Rendez-vous Terminé - Avis Favorable - Paname Consulting";
          content = `
            <p>Votre rendez-vous s'est déroulé avec succès.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">Avis favorable</h3>
              <p>Votre dossier a reçu un avis favorable.</p>
              <p>Votre procédure d'admission a été lancée.</p>
            </div>
            
            <p>Félicitations pour cette première étape réussie.</p>
          `;
        } else if (rendezvous.avisAdmin === "Défavorable") {
          subject = "Rendez-vous Terminé - Paname Consulting";
          content = `
            <p>Votre rendez-vous est maintenant terminé.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">Compte rendu</h3>
              <p>Votre dossier n'a pas reçu un avis favorable pour le programme envisagé.</p>
            </div>
            
            <p>Notre équipe reste à votre disposition pour étudier d'autres alternatives.</p>
          `;
        }
        break;

      case "En attente":
        subject = "Statut Modifié - En Attente - Paname Consulting";
        header = "Rendez-vous en Attente";
        content = `
          <p>Votre demande de rendez-vous est en attente de confirmation.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0;">En attente de confirmation</h3>
            <p>Nous traitons votre demande dans les meilleurs délais.</p>
          </div>
        `;
        break;
    }

    if (content && subject) {
      return await this.sendEmail(
        rendezvous.email,
        subject,
        this.getBaseTemplate(header, content, rendezvous.firstName),
        `mise-à-jour-statut:${rendezvous.status}`
      );
    }

    return false;
  }

  // ==================== PROCEDURE NOTIFICATIONS ====================

  async sendProcedureUpdate(procedure: Procedure): Promise<boolean> {
    const currentStep = procedure.steps.find(s => s.statut === StepStatus.IN_PROGRESS);
    const completedSteps = procedure.steps.filter(s => s.statut === StepStatus.COMPLETED).length;
    const totalSteps = procedure.steps.length;
    const progress = Math.round((completedSteps / totalSteps) * 100);

    let content = "";
    let header = "Mise à jour de Procédure";
    let subject = "Mise à jour de votre procédure - Paname Consulting";

    if (currentStep) {
      content = `
        <p>Votre procédure d'admission avance.</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0;">Avancement</h3>
          <p><strong>Progression :</strong> ${progress}%</p>
          <p><strong>Étape en cours :</strong> ${currentStep.nom}</p>
          <p><strong>Statut :</strong> ${procedure.statut}</p>
          <p><strong>Destination :</strong> ${procedure.destination}</p>
        </div>
        
        <p>Notre équipe travaille activement sur votre dossier.</p>
      `;
    } else if (procedure.statut === ProcedureStatus.COMPLETED) {
      subject = "Procédure Terminée - Paname Consulting";
      header = "Procédure Finalisée";
      content = `
        <p>Votre procédure d'admission est maintenant terminée avec succès.</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0;">Procédure finalisée</h3>
          <p><strong>Statut :</strong> ${procedure.statut}</p>
          <p><strong>Destination :</strong> ${procedure.destination}</p>
          <p><strong>Filière :</strong> ${procedure.filiere}</p>
        </div>
        
        <p>Félicitations ! Vous avez franchi toutes les étapes nécessaires.</p>
      `;
    } else if (procedure.statut === ProcedureStatus.REJECTED) {
      subject = "Procédure Rejetée - Paname Consulting";
      header = "Procédure Rejetée";
      content = `
        <p>Votre procédure d'admission a été rejetée.</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0;">Décision</h3>
          <p><strong>Statut :</strong> ${procedure.statut}</p>
          <p><strong>Destination :</strong> ${procedure.destination}</p>
          ${procedure.raisonRejet ? `<p><strong>Raison :</strong> ${procedure.raisonRejet}</p>` : ""}
        </div>
        
        <p>Notre équipe reste à votre disposition pour discuter des alternatives.</p>
      `;
    }

    if (content) {
      return await this.sendEmail(
        procedure.email,
        subject,
        this.getBaseTemplate(header, content, procedure.prenom),
        `mise-à-jour-procedure:${procedure.statut}`
      );
    }

    return false;
  }

  async sendProcedureCreation(
    procedure: Procedure,
    rendezvous: Rendezvous
  ): Promise<boolean> {
    const content = `
      <p>Suite à l'avis favorable de votre rendez-vous, votre procédure d'admission a été lancée.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Votre procédure est lancée</h3>
        <p><strong>Destination :</strong> ${procedure.destination}</p>
        <p><strong>Filière :</strong> ${procedure.filiere}</p>
        <p><strong>Date du rendez-vous :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
      </div>
      
      <p>Notre équipe va désormais vous accompagner pas à pas.</p>
    `;

    return await this.sendEmail(
      procedure.email,
      "Votre procédure est lancée - Paname Consulting",
      this.getBaseTemplate("Procédure Créée", content, procedure.prenom),
      "création-procédure"
    );
  }

  async sendCancellationNotification(procedure: Procedure): Promise<boolean> {
    const content = `
      <p>Votre procédure d'admission a été annulée.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Annulation</h3>
        <p><strong>Destination :</strong> ${procedure.destination}</p>
        ${procedure.deletionReason ? `<p><strong>Raison :</strong> ${procedure.deletionReason}</p>` : ""}
      </div>
      
      <p>Notre équipe reste à votre disposition pour toute question.</p>
    `;

    return await this.sendEmail(
      procedure.email,
      "Annulation de votre procédure - Paname Consulting",
      this.getBaseTemplate("Procédure Annulée", content, procedure.prenom),
      "annulation-procédure"
    );
  }

  // ==================== CONTACT NOTIFICATIONS ====================

  async sendContactReply(contact: Contact, reply: string): Promise<boolean> {
    const content = `
      <p>Nous vous répondons à votre message :</p>
      
      <div class="info-box">
        <p style="white-space: pre-line;">${reply}</p>
      </div>
      
      <p>Nous espérons que cette réponse correspond à vos attentes.</p>
    `;

    return await this.sendEmail(
      contact.email,
      "Réponse à votre message - Paname Consulting",
      this.getBaseTemplate("Réponse de notre équipe", content, contact.firstName || "Cher client"),
      "réponse-contact"
    );
  }

  async sendContactNotification(contact: Contact): Promise<boolean> {
    const adminEmail = this.configService.get<string>('EMAIL_USER');
    if (!adminEmail) {
      this.logger.warn("📧 Email admin non configuré - notification contact ignorée");
      return false;
    }

    const content = `
      <p>Nouveau message de contact reçu :</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Informations</h3>
        <p><strong>Nom :</strong> ${contact.firstName} ${contact.lastName}</p>
        <p><strong>Email :</strong> ${contact.email}</p>
        <p><strong>Date :</strong> ${new Date().toLocaleString("fr-FR")}</p>
      </div>
      
      <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="white-space: pre-line;">${contact.message}</p>
      </div>
      
      <p>Pour répondre : Répondre à cet email.</p>
    `;

    return await this.sendEmail(
      adminEmail,
      'Nouveau message de contact - Paname Consulting',
      this.getBaseTemplate("Nouveau Message Contact", content, "Équipe"),
      'notification-contact-admin'
    );
  }

  async sendContactConfirmation(contact: Contact): Promise<boolean> {
    const content = `
      <p>Nous accusons réception de votre message.</p>
      
      <div class="info-box">
        <p>Votre demande a bien été enregistrée et sera traitée dans les plus brefs délais.</p>
        <p><strong>Délai de réponse :</strong> 48 heures ouvrables maximum</p>
      </div>
      
      <p>Un membre de notre équipe vous contactera rapidement.</p>
    `;

    return await this.sendEmail(
      contact.email,
      'Confirmation de votre message - Paname Consulting',
      this.getBaseTemplate("Confirmation de Réception", content, contact.firstName || "Cher client"),
      'confirmation-contact'
    );
  }

  // ==================== UTILITY METHODS ====================

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    const maskedName = name.length > 2 
      ? name.substring(0, 2) + '***' + name.substring(name.length - 1)
      : '***';
    return `${maskedName}@${domain}`;
  }

  getEmailStatus(): { available: boolean; message: string } {
    return {
      available: this.emailServiceAvailable,
      message: this.emailServiceAvailable 
        ? '📧 Service email disponible' 
        : '❌ Service email indisponible - vérifiez EMAIL_USER et EMAIL_PASS'
    };
  }
}