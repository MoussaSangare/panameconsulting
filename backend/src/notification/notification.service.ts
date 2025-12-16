import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Rendezvous } from "../schemas/rendezvous.schema";
import { Procedure, StepStatus, ProcedureStatus } from "../schemas/procedure.schema";
import { Contact } from "../schemas/contact.schema";

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;
  private emailServiceAvailable: boolean = false;
  private readonly appName = "Paname Consulting";
  private fromEmail: string;
  private frontendUrl: string;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    const host = this.configService.get<string>('EMAIL_HOST');
    const port = parseInt(this.configService.get<string>('EMAIL_PORT') || '587');
    const user = this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('EMAIL_PASS');
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://www.panameconsulting.vercel.app';

    if (!host || !user || !pass) {
      this.logger.error(`Configuration email manquante:
        EMAIL_HOST: ${host ? '✓' : '✗'}
        EMAIL_USER: ${user ? '✓' : '✗'}
        EMAIL_PASS: ${pass ? '✓' : '✗'}
      `);
      this.emailServiceAvailable = false;
      return;
    }

    try {
      this.fromEmail = `"${this.appName}" <${user}>`;
      
      this.transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: false, // Port 587 utilise STARTTLS
        auth: {
          user: user,
          pass: pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        tls: {
          rejectUnauthorized: true // Production - validation des certificats
        }
      });

      await this.transporter.verify();
      
      this.emailServiceAvailable = true;
      this.logger.log(`Service notification initialisé avec succès (${host}:${port})`);
      
    } catch (error) {
      this.logger.error(`Erreur d'initialisation du service email: ${error.message}`);
      this.emailServiceAvailable = false;
    }
  }

  private async sendEmail(
    to: string, 
    subject: string, 
    html: string, 
    context: string,
    replyTo?: string
  ): Promise<boolean> {
    if (!this.emailServiceAvailable) {
      this.logger.warn(`Notification "${context}" ignorée - service email indisponible`);
      return false;
    }

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.fromEmail,
        to: to,
        subject: `${subject}`,
        html: html
      };

      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      const info = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(`Email envoyé (${context}) à: ${this.maskEmail(to)}`);
      return true;
      
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi "${context}": ${error.message}`);
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
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #334155; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 0;
            background-color: #f9fafb;
          }
          .header { 
            background: linear-gradient(135deg, #0ea5e9, #0284c7); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            border-radius: 0;
          }
          .content { 
            background: white; 
            padding: 35px 30px; 
            border-radius: 0; 
            border: none;
          }
          .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding-top: 25px; 
            border-top: 1px solid #e2e8f0; 
            color: #64748b; 
            font-size: 13px; 
            line-height: 1.5;
          }
          .info-box { 
            background: #f8fafc; 
            padding: 22px; 
            border-radius: 6px; 
            border-left: 4px solid #0ea5e9; 
            margin: 25px 0;
            border: 1px solid #e2e8f0;
          }
          .highlight { 
            color: #0284c7; 
            font-weight: 600;
          }
          .status-confirmed { color: #059669; font-weight: 600; }
          .status-cancelled { color: #dc2626; font-weight: 600; }
          .status-pending { color: #d97706; font-weight: 600; }
          .status-completed { color: #059669; font-weight: 600; }
          .button { 
            display: inline-block; 
            padding: 12px 28px; 
            background: linear-gradient(135deg, #0ea5e9, #0284c7); 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 15px 0;
            font-weight: 500;
            font-size: 15px;
          }
          .note-box {
            background-color: #f0f9ff;
            padding: 16px;
            border-radius: 6px;
            border: 1px solid #bae6fd;
            margin: 20px 0;
            font-size: 14px;
          }
          .website-link {
            color: #0284c7;
            text-decoration: none;
            font-weight: 500;
          }
          .website-link:hover {
            text-decoration: underline;
          }
          @media (max-width: 600px) {
            body { padding: 0; }
            .content { padding: 25px 20px; }
            .header { padding: 25px 15px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.025em;">${this.appName}</h1>
          <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.95;">${header}</p>
        </div>
        <div class="content">
          <p style="margin-bottom: 25px;">Bonjour <span class="highlight">${firstName}</span>,</p>
          ${content}
          <div class="footer">
            <p style="margin-bottom: 15px;">Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
              Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.<br>
              <a href="${this.frontendUrl}" class="website-link" style="font-size: 12px;">${this.frontendUrl.replace('https://', '')}</a>
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
      <p>Nous avons le plaisir de vous confirmer que votre rendez-vous a été pris en compte avec succès.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #0f172a;">Détails de votre rendez-vous</h3>
        <p><strong>Date :</strong> ${dateFormatted}</p>
        <p><strong>Heure :</strong> ${rendezvous.time}</p>
        <p><strong>Lieu :</strong> Paname Consulting<br>Kalaban Coura, Imm. Boré<br>En face de l'Hôtel Wassulu</p>
        <p><strong>Contact :</strong> +223 XX XX XX XX</p>
        <p><strong>Statut :</strong> <span class="status-confirmed">Confirmé</span></p>
      </div>
      
      <p>Nous vous attendons avec impatience pour échanger sur votre projet d'études à l'étranger. 
      Ce rendez-vous est l'occasion pour nous de mieux comprendre vos aspirations et de vous proposer 
      un accompagnement personnalisé.</p>
      
      <div class="note-box">
        <p style="margin: 0;"><strong>Pour préparer au mieux notre échange :</strong></p>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Vos relevés de notes et diplômes</li>
          <li>Votre pièce d'identité ou passeport</li>
          <li>Vos questions éventuelles sur les destinations</li>
        </ul>
      </div>
      
      <p>À très bientôt,</p>
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
      <p>Nous tenons à vous rappeler que vous avez un rendez-vous aujourd'hui avec notre équipe.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #0f172a;">Votre rendez-vous aujourd'hui</h3>
        <p><strong>Heure :</strong> ${rendezvous.time}</p>
        <p><strong>Lieu :</strong> Paname Consulting<br>Kalaban Coura, Imm. Boré<br>En face de l'Hôtel Wassulu</p>
        <p><strong>Contact sur place :</strong> +223 XX XX XX XX</p>
      </div>
      
      <p>Nous sommes impatients de vous rencontrer et de débuter ce beau projet d'études internationales avec vous.</p>
      
      <div class="note-box">
        <p style="margin: 0;"><strong>En cas d'empêchement :</strong><br>
        Si vous ne pouvez pas vous présenter, merci de nous contacter au plus vite pour nous en informer.</p>
      </div>
      
      <p>Notre équipe est prête à vous accueillir et à répondre à toutes vos questions.</p>
    `;

    return await this.sendEmail(
      rendezvous.email,
      "Rappel - Votre rendez-vous aujourd'hui - Paname Consulting",
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
          <p>Le statut de votre rendez-vous a été mis à jour.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #0f172a;">Rendez-vous confirmé</h3>
            <p><strong>Date :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
            <p><strong>Heure :</strong> ${rendezvous.time}</p>
            <p><strong>Statut :</strong> <span class="status-confirmed">Confirmé</span></p>
          </div>
          
          <p>Votre rendez-vous est maintenant confirmé et figé dans notre agenda. Nous vous attendons 
          à la date et heure convenues.</p>
          
          <p>N'hésitez pas à nous contacter si vous avez des questions avant notre rencontre.</p>
        `;
        break;

      case "Annulé":
        subject = "Rendez-vous Annulé - Paname Consulting";
        header = "Rendez-vous Annulé";
        const cancelledBy = rendezvous.cancelledBy === 'admin' ? 'par notre équipe' : 'à votre demande';
        content = `
          <p>Nous vous informons que votre rendez-vous a été annulé ${cancelledBy}.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #0f172a;">Rendez-vous annulé</h3>
            <p><strong>Date prévue :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
            <p><strong>Heure prévue :</strong> ${rendezvous.time}</p>
            <p><strong>Statut :</strong> <span class="status-cancelled">Annulé</span></p>
            ${rendezvous.cancellationReason ? `<p><strong>Raison :</strong> ${rendezvous.cancellationReason}</p>` : ""}
            ${rendezvous.cancelledAt ? `<p><strong>Date d'annulation :</strong> ${new Date(rendezvous.cancelledAt).toLocaleDateString("fr-FR")}</p>` : ""}
          </div>
          
          <p>Nous regrettons de ne pas pouvoir vous recevoir à la date prévue. Si vous souhaitez 
          reprogrammer un rendez-vous, nous vous invitons à visiter notre site web ou à nous contacter 
          directement pour convenir d'une nouvelle date.</p>
          
          <p style="text-align: center; margin-top: 25px;">
            <a href="${this.frontendUrl}" class="button">Reprogrammer un rendez-vous</a>
          </p>
        `;
        break;

      case "Terminé":
        header = "Rendez-vous Terminé";
        if (rendezvous.avisAdmin === "Favorable") {
          subject = "Rendez-vous Terminé - Avis Favorable - Paname Consulting";
          content = `
            <p>Votre rendez-vous s'est déroulé avec succès et nous tenons à vous en remercier.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #0f172a;">Avis favorable</h3>
              <p>Nous sommes heureux de vous annoncer que votre dossier a reçu un avis favorable à l'issue de notre entretien.</p>
              <p><strong>Prochaine étape :</strong> Votre procédure d'admission a été officiellement lancée.</p>
              <p><strong>Avis :</strong> <span class="status-confirmed">Favorable</span></p>
            </div>
            
            <p>Votre projet d'études à l'étranger prend forme. Notre équipe a initié les démarches 
            nécessaires pour concrétiser votre projet. Vous recevrez prochainement un email détaillant 
            les différentes étapes de votre procédure d'admission.</p>
            
            <p>Félicitations pour cette première étape réussie. Nous sommes convaincus que votre parcours 
            académique à l'international sera une belle réussite.</p>
          `;
        } else if (rendezvous.avisAdmin === "Défavorable") {
          subject = "Rendez-vous Terminé - Paname Consulting";
          content = `
            <p>Votre rendez-vous est maintenant terminé et nous vous remercions pour votre temps.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #0f172a;">Compte rendu de l'entretien</h3>
              <p>À l'issue de notre échange, votre dossier n'a pas reçu un avis favorable pour la destination 
              et le programme envisagés.</p>
              <p><strong>Avis :</strong> <span class="status-cancelled">Défavorable</span></p>
            </div>
            
            <p>Cela ne signifie pas nécessairement la fin de votre projet d'études à l'étranger. 
            Notre équipe reste à votre disposition pour étudier ensemble d'autres alternatives possibles 
            qui pourraient mieux correspondre à votre profil et aspirations.</p>
            
            <p>Nous vous encourageons à prendre contact avec nous pour discuter des autres options 
            disponibles.</p>
          `;
        }
        break;

      case "En attente":
        subject = "Statut Modifié - En Attente - Paname Consulting";
        header = "Rendez-vous en Attente";
        content = `
          <p>Le statut de votre rendez-vous a été modifié.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #0f172a;">En attente de confirmation</h3>
            <p>Votre demande de rendez-vous est actuellement en attente de confirmation par notre équipe.</p>
            <p><strong>Statut :</strong> <span class="status-pending">En attente</span></p>
          </div>
          
          <p>Nous traitons votre demande dans les meilleurs délais. Vous recevrez une notification 
          dès que votre rendez-vous sera confirmé ou si nous avons besoin d'informations complémentaires.</p>
          
          <p>Nous vous remercions pour votre patience et votre compréhension.</p>
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
        <p>Votre procédure d'admission avance et nous tenons à vous en informer.</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0; color: #0f172a;">Avancement de votre dossier</h3>
          <p><strong>Progression :</strong> ${progress}%</p>
          <p><strong>Étape en cours :</strong> ${currentStep.nom}</p>
          <p><strong>Statut global :</strong> ${procedure.statut}</p>
          <p><strong>Destination :</strong> ${procedure.destination}</p>
          ${currentStep.raisonRefus ? `<p><strong>Commentaire :</strong> ${currentStep.raisonRefus}</p>` : ""}
        </div>
        
        <p>Notre équipe travaille activement sur votre dossier pour garantir le succès de votre projet 
        d'études. Chaque étape est traitée avec la plus grande attention pour vous offrir un accompagnement 
        de qualité.</p>
        
        <p>Vous recevrez une nouvelle mise à jour lorsque l'étape en cours sera terminée ou si une action 
        de votre part est nécessaire.</p>
      `;
    } else if (procedure.statut === ProcedureStatus.COMPLETED) {
      subject = "Procédure Terminée - Paname Consulting";
      header = "Procédure Finalisée";
      content = `
        <p>Nous avons le plaisir de vous annoncer que votre procédure d'admission est maintenant terminée avec succès.</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0; color: #0f172a;">Procédure finalisée</h3>
          <p><strong>Statut :</strong> <span class="status-completed">${procedure.statut}</span></p>
          <p><strong>Destination :</strong> ${procedure.destination}</p>
          <p><strong>Filière :</strong> ${procedure.filiere}</p>
          <p><strong>Date de complétion :</strong> ${procedure.dateCompletion ? new Date(procedure.dateCompletion).toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR")}</p>
        </div>
        
        <p>Félicitations ! Vous avez franchi toutes les étapes nécessaires pour votre admission. 
        Ce résultat est le fruit de notre collaboration et de votre engagement dans ce projet.</p>
        
        <p>Notre équipe vous contactera prochainement pour vous communiquer les informations détaillées 
        concernant la suite des démarches et votre départ.</p>
        
        <p>Nous vous souhaitons plein de succès dans cette nouvelle aventure académique.</p>
      `;
    } else if (procedure.statut === ProcedureStatus.REJECTED) {
      subject = "Procédure Rejetée - Paname Consulting";
      header = "Procédure Rejetée";
      content = `
        <p>Nous vous informons que votre procédure d'admission a été rejetée.</p>
        
        <div class="info-box">
          <h3 style="margin-top: 0; color: #0f172a;">Décision sur votre dossier</h3>
          <p><strong>Statut :</strong> <span class="status-cancelled">${procedure.statut}</span></p>
          <p><strong>Destination :</strong> ${procedure.destination}</p>
          ${procedure.raisonRejet ? `<p><strong>Raison :</strong> ${procedure.raisonRejet}</p>` : ""}
          <p><strong>Date de décision :</strong> ${new Date().toLocaleDateString("fr-FR")}</p>
        </div>
        
        <p>Nous comprenons que cette nouvelle peut être décevante. Notre équipe reste à votre disposition 
        pour discuter des alternatives possibles ou pour vous aider à préparer une nouvelle candidature 
        si vous le souhaitez.</p>
        
        <p>N'hésitez pas à nous contacter pour échanger sur les options qui s'offrent à vous.</p>
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
      <p>Suite à l'avis favorable de votre rendez-vous, nous sommes heureux de vous annoncer que votre 
      procédure d'admission a été officiellement lancée.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #0f172a;">Votre procédure est lancée</h3>
        <p><strong>Destination :</strong> ${procedure.destination}</p>
        <p><strong>Filière :</strong> ${procedure.filiere}</p>
        <p><strong>Niveau d'études :</strong> ${procedure.niveauEtude}</p>
        <p><strong>Date du rendez-vous :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
        <p><strong>Nombre d'étapes :</strong> ${procedure.steps.length}</p>
      </div>
      
      <p>Notre équipe va désormais vous accompagner pas à pas dans l'ensemble des démarches nécessaires 
      à votre admission. Vous recevrez régulièrement des mises à jour sur l'avancement de votre dossier.</p>
      
      <p>Chaque étape sera traitée avec soin pour maximiser vos chances de succès. Nous restons à votre 
      disposition pour toute question ou précision dont vous pourriez avoir besoin.</p>
      
      <div class="note-box">
        <p style="margin: 0;"><strong>Accompagnement personnalisé :</strong><br>
        Notre équipe vous guide à chaque étape de votre projet d'études, de la constitution du dossier 
        jusqu'à votre départ.</p>
      </div>
      
      <p>Nous vous souhaitons une excellente continuation dans cette belle aventure qui commence.</p>
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
      <p>Nous vous informons que votre procédure d'admission a été annulée.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #0f172a;">Annulation de votre procédure</h3>
        <p><strong>Destination :</strong> ${procedure.destination}</p>
        <p><strong>Date d'annulation :</strong> ${new Date().toLocaleDateString("fr-FR")}</p>
        <p><strong>Statut :</strong> <span class="status-cancelled">${procedure.statut}</span></p>
        ${procedure.deletionReason ? `<p><strong>Raison :</strong> ${procedure.deletionReason}</p>` : ""}
      </div>
      
      <p>Si cette annulation résulte d'une erreur ou si vous souhaitez obtenir plus d'informations 
      concernant cette décision, notre équipe reste à votre disposition pour échanger avec vous.</p>
      
      <p>Nous regrettons de ne pas pouvoir vous accompagner plus loin dans ce projet et nous vous 
      souhaitons plein succès dans vos démarches futures.</p>
      
      <p>Pour toute question, n'hésitez pas à nous contacter directement.</p>
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
      <p>Nous vous remercions de votre message et nous tenons à vous répondre personnellement.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #0f172a;">Notre réponse</h3>
        <p style="white-space: pre-line; line-height: 1.7;">${reply}</p>
      </div>
      
      <div style="background: #f8fafc; padding: 18px; border-radius: 6px; margin: 25px 0;">
        <h4 style="margin-top: 0; color: #475569;">Rappel de votre demande</h4>
        <p style="color: #64748b; white-space: pre-line;">${contact.message}</p>
      </div>
      
      <p>Nous espérons que cette réponse correspond à vos attentes. N'hésitez pas à nous recontacter 
      si vous avez d'autres questions ou besoin d'informations complémentaires.</p>
      
      <p>Nous restons à votre disposition pour vous accompagner dans votre projet d'études.</p>
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
      this.logger.warn("Email admin non configuré - notification contact ignorée");
      return false;
    }

    const content = `
      <p>Un nouveau message de contact a été reçu via le site web.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #0f172a;">Informations du contact</h3>
        <p><strong>Nom :</strong> ${contact.firstName} ${contact.lastName}</p>
        <p><strong>Email :</strong> ${contact.email}</p>
        <p><strong>Date :</strong> ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</p>
      </div>
      
      <div style="background: #f8fafc; padding: 18px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #475569;">Message reçu</h4>
        <p style="white-space: pre-line; line-height: 1.7;">${contact.message}</p>
      </div>
      
      <p style="color: #64748b; font-size: 14px; border-left: 3px solid #0ea5e9; padding-left: 12px;">
        Pour répondre : Cliquez simplement sur "Répondre" dans votre client email. L'adresse de réponse 
        sera automatiquement configurée vers ${contact.email}.
      </p>
    `;

    return await this.sendEmail(
      adminEmail,
      'Nouveau message de contact - Paname Consulting',
      this.getBaseTemplate("Nouveau Message Contact", content, "Équipe"),
      'notification-contact-admin',
      contact.email
    );
  }

  async sendContactConfirmation(contact: Contact): Promise<boolean> {
    const content = `
      <p>Nous accusons réception de votre message et vous remercions de l'intérêt que vous portez à 
      Paname Consulting.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #0f172a;">Confirmation de réception</h3>
        <p>Votre demande a bien été enregistrée et sera traitée dans les plus brefs délais par notre équipe.</p>
        <p><strong>Délai de réponse estimé :</strong> 48 heures ouvrables maximum</p>
        <p><strong>Date de réception :</strong> ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</p>
      </div>
      
      <div style="background: #f8fafc; padding: 18px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #475569;">Résumé de votre message</h4>
        <p style="color: #64748b;">${contact.message}</p>
      </div>
      
      <p>Un membre de notre équipe vous contactera rapidement pour répondre à votre demande de manière 
      personnalisée et détaillée.</p>
      
      <p>En attendant, n'hésitez pas à consulter notre site web pour découvrir nos services et 
      accompagnements.</p>
      
      <p style="text-align: center; margin-top: 25px;">
        <a href="${this.frontendUrl}" class="button">Visiter notre site web</a>
      </p>
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

  getServiceStatus(): { available: boolean; fromEmail: string; frontendUrl: string } {
    return {
      available: this.emailServiceAvailable,
      fromEmail: this.fromEmail || 'Non configuré',
      frontendUrl: this.frontendUrl
    };
  }
}