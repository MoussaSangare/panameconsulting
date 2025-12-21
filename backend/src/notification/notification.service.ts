import { Injectable, Logger } from '@nestjs/common';
import { Rendezvous } from '../schemas/rendezvous.schema';
import { Procedure, ProcedureStatus, StepStatus } from '../schemas/procedure.schema';
import { ConfigService } from '@nestjs/config';
import { Contact } from '../schemas/contact.schema';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly appName = 'Paname Consulting';
  private readonly frontendUrl: string;

  constructor(
    private configService: ConfigService,
    private mailService: MailService
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://panameconsulting.vercel.app';
  }

  // ==================== RENDEZ-VOUS NOTIFICATIONS ====================

  async sendConfirmation(rendezvous: Rendezvous): Promise<boolean> {
    const dateFormatted = new Date(rendezvous.date).toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const subject = "Confirmation de votre rendez-vous - Paname Consulting";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Paname Consulting</h2>
        <p>Bonjour <strong>${rendezvous.firstName}</strong>,</p>
        <p>Votre rendez-vous a été confirmé avec succès.</p>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p><strong>Date :</strong> ${dateFormatted}</p>
          <p><strong>Heure :</strong> ${rendezvous.time}</p>
          <p><strong>Lieu :</strong> Paname Consulting - Kalaban Coura</p>
          <p><strong>Statut :</strong> Confirmé</p>
        </div>
        
        <p>Nous vous attendons avec impatience.</p>
        <p>Cordialement,<br>L'équipe Paname Consulting</p>
      </div>
    `;

    const success = await this.mailService.sendEmail(rendezvous.email, subject, html);
    if (success) this.logger.log(`Confirmation envoyée à ${this.maskEmail(rendezvous.email)}`);
    return success;
  }

  async sendReminder(rendezvous: Rendezvous): Promise<boolean> {
    const subject = "Rappel - Rendez-vous aujourd'hui - Paname Consulting";
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <p>Bonjour <strong>${rendezvous.firstName}</strong>,</p>
        <p>Rappel : Vous avez un rendez-vous aujourd'hui à <strong>${rendezvous.time}</strong>.</p>
        <p>Lieu : Paname Consulting - Kalaban Coura</p>
        <p>Nous sommes impatients de vous rencontrer.</p>
      </div>
    `;

    const success = await this.mailService.sendEmail(rendezvous.email, subject, html);
    if (success) this.logger.log(`Rappel envoyé à ${this.maskEmail(rendezvous.email)}`);
    return success;
  }

  async sendStatusUpdate(rendezvous: Rendezvous): Promise<boolean> {
    let subject = '';
    let html = '';

    switch (rendezvous.status) {
      case "Confirmé":
        subject = "Rendez-vous Confirmé - Paname Consulting";
        html = `
          <div style="font-family: Arial, sans-serif;">
            <p>Bonjour <strong>${rendezvous.firstName}</strong>,</p>
            <p>Votre rendez-vous a été confirmé.</p>
            <p><strong>Date :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
            <p><strong>Heure :</strong> ${rendezvous.time}</p>
          </div>
        `;
        break;

      case "Annulé":
        subject = "Rendez-vous Annulé - Paname Consulting";
        const cancelledBy = rendezvous.cancelledBy === 'admin' ? 'par notre équipe' : 'à votre demande';
        html = `
          <div style="font-family: Arial, sans-serif;">
            <p>Bonjour <strong>${rendezvous.firstName}</strong>,</p>
            <p>Votre rendez-vous a été annulé ${cancelledBy}.</p>
            ${rendezvous.cancellationReason ? `<p><strong>Raison :</strong> ${rendezvous.cancellationReason}</p>` : ""}
            <p style="margin-top: 20px;">
              <a href="${this.frontendUrl}" style="color: #2563eb;">Reprogrammer un rendez-vous</a>
            </p>
          </div>
        `;
        break;

      case "Terminé":
        if (rendezvous.avisAdmin === "Favorable") {
          subject = "Rendez-vous Terminé - Avis Favorable - Paname Consulting";
          html = `
            <div style="font-family: Arial, sans-serif;">
              <p>Bonjour <strong>${rendezvous.firstName}</strong>,</p>
              <p>Votre rendez-vous s'est déroulé avec succès.</p>
              <p><strong>Avis favorable</strong> - Votre procédure d'admission a été lancée.</p>
              <p>Félicitations pour cette première étape réussie.</p>
            </div>
          `;
        } else if (rendezvous.avisAdmin === "Défavorable") {
          subject = "Rendez-vous Terminé - Paname Consulting";
          html = `
            <div style="font-family: Arial, sans-serif;">
              <p>Bonjour <strong>${rendezvous.firstName}</strong>,</p>
              <p>Votre rendez-vous est terminé.</p>
              <p>Votre dossier n'a pas reçu un avis favorable pour le programme envisagé.</p>
              <p>Notre équipe reste à votre disposition pour étudier d'autres alternatives.</p>
            </div>
          `;
        }
        break;

      case "En attente":
        subject = "Statut Modifié - En Attente - Paname Consulting";
        html = `
          <div style="font-family: Arial, sans-serif;">
            <p>Bonjour <strong>${rendezvous.firstName}</strong>,</p>
            <p>Votre demande de rendez-vous est en attente de confirmation.</p>
            <p>Nous traitons votre demande dans les meilleurs délais.</p>
          </div>
        `;
        break;
    }

    if (html && subject) {
      const success = await this.mailService.sendEmail(rendezvous.email, subject, html);
      if (success) this.logger.log(`Statut envoyé à ${this.maskEmail(rendezvous.email)}`);
      return success;
    }
    return false;
  }

  // ==================== PROCEDURE NOTIFICATIONS ====================

  async sendProcedureUpdate(procedure: Procedure): Promise<boolean> {
    const currentStep = procedure.steps?.find(s => s.statut === StepStatus.IN_PROGRESS);
    const completedSteps = procedure.steps?.filter(s => s.statut === StepStatus.COMPLETED)?.length || 0;
    const totalSteps = procedure.steps?.length || 1;
    const progress = Math.round((completedSteps / totalSteps) * 100);

    let subject = "Mise à jour de votre procédure - Paname Consulting";
    let html = `
      <div style="font-family: Arial, sans-serif;">
        <p>Bonjour <strong>${procedure.prenom}</strong>,</p>
        <p>Votre procédure d'admission avance.</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p><strong>Progression :</strong> ${progress}%</p>
          ${currentStep ? `<p><strong>Étape en cours :</strong> ${currentStep.nom}</p>` : ""}
          <p><strong>Statut :</strong> ${procedure.statut}</p>
          <p><strong>Destination :</strong> ${procedure.destination}</p>
        </div>
        <p>Notre équipe travaille activement sur votre dossier.</p>
      </div>
    `;

    if (procedure.statut === ProcedureStatus.COMPLETED) {
      subject = "Procédure Terminée - Paname Consulting";
      html = `
        <div style="font-family: Arial, sans-serif;">
          <p>Bonjour <strong>${procedure.prenom}</strong>,</p>
          <p>Votre procédure d'admission est maintenant terminée avec succès.</p>
          <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p><strong>Destination :</strong> ${procedure.destination}</p>
            <p><strong>Filière :</strong> ${procedure.filiere}</p>
          </div>
          <p>Félicitations ! Vous avez franchi toutes les étapes nécessaires.</p>
        </div>
      `;
    } else if (procedure.statut === ProcedureStatus.REJECTED) {
      subject = "Procédure Rejetée - Paname Consulting";
      html = `
        <div style="font-family: Arial, sans-serif;">
          <p>Bonjour <strong>${procedure.prenom}</strong>,</p>
          <p>Votre procédure d'admission a été rejetée.</p>
          <div style="background: #fef2f2; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p><strong>Destination :</strong> ${procedure.destination}</p>
            ${procedure.raisonRejet ? `<p><strong>Raison :</strong> ${procedure.raisonRejet}</p>` : ""}
          </div>
          <p>Notre équipe reste à votre disposition pour discuter des alternatives.</p>
        </div>
      `;
    }

    const success = await this.mailService.sendEmail(procedure.email, subject, html);
    if (success) this.logger.log(`Mise à jour procédure envoyée à ${this.maskEmail(procedure.email)}`);
    return success;
  }

  async sendProcedureCreation(procedure: Procedure): Promise<boolean> {
    const subject = "Votre procédure est lancée - Paname Consulting";
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <p>Bonjour <strong>${procedure.prenom}</strong>,</p>
        <p>Suite à l'avis favorable de votre rendez-vous, votre procédure d'admission a été lancée.</p>
        <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p><strong>Destination :</strong> ${procedure.destination}</p>
          <p><strong>Filière :</strong> ${procedure.filiere}</p>
        </div>
        <p>Notre équipe va désormais vous accompagner pas à pas.</p>
      </div>
    `;

    const success = await this.mailService.sendEmail(procedure.email, subject, html);
    if (success) this.logger.log(`Création procédure envoyée à ${this.maskEmail(procedure.email)}`);
    return success;
  }

  async sendCancellationNotification(procedure: Procedure): Promise<boolean> {
    const subject = "Annulation de votre procédure - Paname Consulting";
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <p>Bonjour <strong>${procedure.prenom}</strong>,</p>
        <p>Votre procédure d'admission a été annulée.</p>
        <div style="background: #fef2f2; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p><strong>Destination :</strong> ${procedure.destination}</p>
          ${procedure.deletionReason ? `<p><strong>Raison :</strong> ${procedure.deletionReason}</p>` : ""}
        </div>
        <p>Notre équipe reste à votre disposition pour toute question.</p>
      </div>
    `;

    const success = await this.mailService.sendEmail(procedure.email, subject, html);
    if (success) this.logger.log(`Annulation procédure envoyée à ${this.maskEmail(procedure.email)}`);
    return success;
  }

  // ==================== CONTACT NOTIFICATIONS ====================

  async sendContactConfirmation(contact: Contact): Promise<boolean> {
    const subject = "Confirmation de votre message - Paname Consulting";
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <p>Bonjour <strong>${contact.firstName || "Cher client"}</strong>,</p>
        <p>Nous accusons réception de votre message.</p>
        <p>Votre demande a bien été enregistrée et sera traitée dans les 48 heures ouvrables.</p>
        <p>Un membre de notre équipe vous contactera rapidement.</p>
        <p>Cordialement,<br>L'équipe Paname Consulting</p>
      </div>
    `;

    const success = await this.mailService.sendEmail(contact.email, subject, html);
    if (success) this.logger.log(`Confirmation contact envoyée à ${this.maskEmail(contact.email)}`);
    return success;
  }

  async sendContactNotification(contact: Contact): Promise<boolean> {
    const adminEmail = this.configService.get<string>('EMAIL_USER');
    if (!adminEmail) {
      this.logger.warn("Email admin non configuré");
      return false;
    }

    const subject = "Nouveau message de contact - Paname Consulting";
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <p><strong>Nouveau message de contact reçu :</strong></p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p><strong>Nom :</strong> ${contact.firstName} ${contact.lastName}</p>
          <p><strong>Email :</strong> ${contact.email}</p>
          <p><strong>Date :</strong> ${new Date().toLocaleString("fr-FR")}</p>
        </div>
        <div style="background: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 15px 0;">
          <p><strong>Message :</strong></p>
          <p style="white-space: pre-line;">${contact.message}</p>
        </div>
        <p>Pour répondre : Répondre directement à cet email.</p>
      </div>
    `;

    const success = await this.mailService.sendEmail(adminEmail, subject, html);
    if (success) this.logger.log(`Notification contact envoyée à admin`);
    return success;
  }

  async sendContactReply(contact: Contact, reply: string): Promise<boolean> {
    const subject = "Réponse à votre message - Paname Consulting";
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <p>Bonjour <strong>${contact.firstName || "Cher client"}</strong>,</p>
        <p>Nous vous répondons à votre message :</p>
        <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="white-space: pre-line;">${reply}</p>
        </div>
        <p>Nous espérons que cette réponse correspond à vos attentes.</p>
        <p>Cordialement,<br>L'équipe Paname Consulting</p>
      </div>
    `;

    const success = await this.mailService.sendEmail(contact.email, subject, html);
    if (success) this.logger.log(`Réponse contact envoyée à ${this.maskEmail(contact.email)}`);
    return success;
  }

  // ==================== UTILITY ====================

  private maskEmail(email: string): string {
    if (!email || typeof email !== 'string') return '***';
    if (!email.includes('@')) return '***@***';
    
    const [name, domain] = email.split('@');
    if (!name || !domain) return '***@***';
    
    const maskedName = name.length <= 2 
      ? name.charAt(0) + '*'
      : name.charAt(0) + '***' + (name.length > 1 ? name.charAt(name.length - 1) : '');
    
    return `${maskedName}@${domain}`;
  }

  getServiceStatus(): { available: boolean; reason?: string } {
    const status = this.mailService.getStatus();
    return {
      available: status.available,
      reason: status.available ? undefined : 'Service email non configuré ou indisponible'
    };
  }
}