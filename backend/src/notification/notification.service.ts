import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { Rendezvous } from "../schemas/rendezvous.schema";
import { Procedure, StepStatus } from "../schemas/procedure.schema";
import { ConfigService } from "@nestjs/config";
import { Contact } from "../schemas/contact.schema";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;
  private emailServiceAvailable: boolean = false;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    if (
      !this.configService.get("EMAIL_HOST") ||
      !this.configService.get("EMAIL_USER") ||
      !this.configService.get("EMAIL_PASS")
    ) {
      this.logger.warn(
        "Configuration email incomplète - notifications désactivées",
      );
      this.emailServiceAvailable = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get("EMAIL_HOST"),
        port: this.configService.get("EMAIL_PORT"),
        secure: this.configService.get("EMAIL_SECURE") === "true",
        auth: {
          user: this.configService.get("EMAIL_USER"),
          pass: this.configService.get("EMAIL_PASS"),
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
      this.logger.error(
        "Erreur initialisation service notification email",
        error.stack,
      );
      this.emailServiceAvailable = false;
    }
  }

  private async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('Service notification email initialisé avec succès');
      return true;
    } catch (error) {
      this.logger.error(
        `Test connexion notification email échoué: ${error.message}`,
      );
      return false;
    }
  }

  private getEmailTemplate(header: string, content: string, firstName: string) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 20px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0; }
          .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
          .button { display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .info-box { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #0ea5e9; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${header}</h1>
        </div>
        <div class="content">
          <p>Bonjour <strong>${firstName}</strong>,</p>
          ${content}
          <div class="footer">
            <p>Cordialement,<br><strong>L'équipe Paname Consulting</strong></p>
            <p> ${this.configService.get("EMAIL_USER")}<br> www.panameconsulting.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

 private async sendEmail(
    to: string, 
    subject: string, 
    html: string, 
    context: string,
    replyTo?: string
): Promise<void> {
    const maskedEmail = this.maskEmail(to);
    
    if (!this.emailServiceAvailable || !this.transporter) {
        this.logger.log(`Notification "${context}" pour: ${maskedEmail} (service email indisponible)`);
        return;
    }

    try {
        const mailOptions: any = {
            from: `"Paname Consulting" <${this.configService.get('EMAIL_USER')}>`,
            to: to,
            subject: subject,
            html: html
        };

        if (replyTo) {
            mailOptions.replyTo = replyTo;
        }

        await this.transporter.sendMail(mailOptions);
        this.logger.log(`Email ${context} envoyé à: ${maskedEmail}`);
    } catch (error) {
        this.logger.error(`Erreur envoi ${context}: ${error.message}`);
        if (error.message.includes('BadCredentials') || error.message.includes('Invalid login')) {
            this.emailServiceAvailable = false;
            this.logger.warn('Service notification email désactivé - erreur authentification');
        }
    }
}

  async sendConfirmation(rendezvous: Rendezvous): Promise<void> {
    const content = `
      <p>Votre rendez-vous a été confirmé avec succès.</p>
      <div class="info-box">
        <h3> Détails de votre rendez-vous :</h3>
        <p><strong>Date :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        <p><strong>Heure :</strong> ${rendezvous.time}</p>
        <p><strong>Lieu :</strong> Paname Consulting Kalaban Coura Imm.Boré en face de l'Hôtel Wassulu.</p>
      </div>
      <p>Nous vous attendons avec impatience pour échanger sur votre projet d'études.</p>
      <p><em>Vous recevrez un rappel la veille de votre rendez-vous.</em></p>
    `;

    await this.sendEmail(
      rendezvous.email,
      "Confirmation de votre rendez-vous - Paname Consulting",
      this.getEmailTemplate(
        "Rendez-vous Confirmé",
        content,
        rendezvous.firstName,
      ),
      "confirmation rendez-vous",
    );
  }

  async sendReminder(rendezvous: Rendezvous): Promise<void> {
    const content = `
      <p>Rappel : Vous avez un rendez-vous aujourd'hui !</p>
      <div class="info-box">
        <h3> Votre rendez-vous :</h3>
        <p><strong>Heure :</strong> ${rendezvous.time}</p>
        <p><strong>Lieu :</strong> Paname Consulting Kalaban Coura Imm.Boré en face de l'Hôtel Wassulu.</p>
      </div>
      <p>Préparez vos questions, nous sommes impatients de vous accompagner dans votre projet.</p>
      <p><strong>À très vite !</strong></p>
    `;

    await this.sendEmail(
      rendezvous.email,
      "Rappel - Votre rendez-vous aujourd'hui - Paname Consulting",
      this.getEmailTemplate(
        "Rappel de Rendez-vous",
        content,
        rendezvous.firstName,
      ),
      "rappel rendez-vous",
    );
  }

  async sendStatusUpdate(rendezvous: Rendezvous): Promise<void> {
    let content = "";
    let subject = "";

    if (rendezvous.status === "Confirmé") {
      subject = "Rendez-vous Confirmé - Paname Consulting";
      content = `
        <p>Votre rendez-vous a été confirmé par notre équipe.</p>
        <div class="info-box">
          <h3> Détails de votre rendez-vous :</h3>
          <p><strong>Date :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
          <p><strong>Heure :</strong> ${rendezvous.time}</p>
          <p><strong>Statut :</strong> Confirmé </p>
        </div>
        <p>Nous vous attendons avec impatience !</p>
      `;
    } else if (rendezvous.status === "Annulé") {
      subject = "Rendez-vous Annulé - Paname Consulting";
      content = `
        <p>Votre rendez-vous a été annulé.</p>
        <div class="info-box">
          <h3> Détails de votre rendez-vous :</h3>
          <p><strong>Date prévue :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
          <p><strong>Heure prévue :</strong> ${rendezvous.time}</p>
          ${rendezvous.avisAdmin ? `<p><strong>Raison :</strong> ${rendezvous.avisAdmin}</p>` : ""}
        </div>
        <p>Si vous souhaitez reprogrammer un rendez-vous, n'hésitez pas à nous contacter.</p>
      `;
    } else if (rendezvous.status === "Terminé") {
      if (rendezvous.avisAdmin === "Favorable") {
        subject = "Rendez-vous Terminé - Procédure Lancée - Paname Consulting";
        content = `
          <p>Votre rendez-vous s'est excellentement déroulé !</p>
          <div class="info-box">
            <h3> Avis favorable</h3>
            <p>Nous sommes ravis de vous annoncer que votre dossier a reçu un avis favorable.</p>
            <p><strong>Prochaine étape :</strong> Votre procédure d'admission a été officiellement lancée.</p>
          </div>
          <p>Vous recevrez sous peu un email détaillant les étapes de votre procédure.</p>
          <p><strong>Félicitations pour cette première étape réussie !</strong></p>
        `;
      } else if (rendezvous.avisAdmin === "Défavorable") {
        subject = "Rendez-vous Terminé - Avis Défavorable - Paname Consulting";
        content = `
          <p>Votre rendez-vous est maintenant terminé.</p>
          <div class="info-box">
            <h3> Avis défavorable</h3>
            <p>Malheureusement, votre dossier n'a pas reçu un avis favorable à l'issue de l'entretien.</p>
            <p>Notre équipe reste à votre disposition pour discuter des alternatives possibles.</p>
          </div>
          <p>N'hésitez pas à nous contacter pour plus d'informations.</p>
        `;
      }
    } else if (rendezvous.status === "En attente") {
      subject = "Statut Modifié - En Attente - Paname Consulting";
      content = `
        <p>Le statut de votre rendez-vous a été modifié.</p>
        <div class="info-box">
            <h3>Nouveau statut : En attente</h3>
          <p>Votre rendez-vous est en attente de confirmation.</p>
          <p>Nous vous tiendrons informé dès qu'il sera confirmé.</p>
        </div>
      `;
    }

    if (content && subject) {
      await this.sendEmail(
        rendezvous.email,
        subject,
        this.getEmailTemplate(
          "Mise à jour de Rendez-vous",
          content,
          rendezvous.firstName,
        ),
        `mise à jour statut: ${rendezvous.status}`,
      );
    }
  }

  async sendProcedureUpdate(procedure: Procedure): Promise<void> {
    const currentStep = procedure.steps.find(
      (s) => s.statut === StepStatus.IN_PROGRESS,
    );
    const completedSteps = procedure.steps.filter(
      (s) => s.statut === StepStatus.COMPLETED,
    ).length;
    const totalSteps = procedure.steps.length;
    const progress = Math.round((completedSteps / totalSteps) * 100);

    let content = "";
    if (currentStep) {
      content = `
        <p>Votre procédure d'admission avance !</p>
        <div class="info-box">
          <h3> Progression : ${progress}%</h3>
          <p><strong>Étape en cours :</strong> ${currentStep.nom}</p>
          <p><strong>Statut global :</strong> ${procedure.statut}</p>
          ${currentStep.raisonRefus ? `<p><strong>Commentaire :</strong> ${currentStep.raisonRefus}</p>` : ""}
        </div>
        <p>Nous travaillons activement sur votre dossier.</p>
      `;
    } else {
      content = `
        <p> Félicitations ! Votre procédure d'admission est terminée.</p>
        <div class="info-box">
          <h3> Procédure finalisée</h3>
          <p><strong>Statut :</strong> ${procedure.statut}</p>
          <p>Toutes les étapes ont été complétées avec succès.</p>
        </div>
        <p>Notre équipe vous contactera très prochainement pour la suite.</p>
      `;
    }

    const subject = currentStep
      ? "Mise à jour de votre procédure - Paname Consulting"
      : "Procédure Terminée - Paname Consulting";

    await this.sendEmail(
      procedure.email,
      subject,
      this.getEmailTemplate(
        "Mise à jour de Procédure",
        content,
        procedure.prenom,
      ),
      "mise à jour procédure",
    );
  }

  async sendProcedureCreation(
    procedure: Procedure,
    _rendezvous: Rendezvous,
  ): Promise<void> {
    const content = `
      <p>Félicitations ! Suite à votre rendez-vous favorable, votre procédure d'admission a été entamée.</p>

      <div class="info-box">
        <h3> Votre procédure est entamée</h3>
        <p><strong>Destination :</strong> ${procedure.destination}</p>
      </div>

      <p>Vous pouvez suivre l'avancement de votre procédure dans votre espace personnel.</p>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="#" class="button">Accéder à mon espace</a>
      </div>

      <p><strong>Notre équipe vous accompagne à chaque étape !</strong></p>
    `;

    await this.sendEmail(
      procedure.email,
      "Votre procédure est lancée ! - Paname Consulting",
      this.getEmailTemplate("Procédure Créée", content, procedure.prenom),
      "création procédure",
    );
  }

  async sendContactReply(contact: Contact, reply: string): Promise<void> {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Paname Consulting</h1>
        </div>
        <div style="padding: 30px; background: white; border: 1px solid #e0e0e0;">
          <h2 style="color: #333; margin-top: 0;">Bonjour ${contact.firstName || ""},</h2>
          <p style="color: #666; line-height: 1.6;">${reply}</p>
          <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Rappel de votre demande :</strong><br/>
              ${contact.message}
            </p>
          </div>
        </div>
        <div style="padding: 20px; background: #f8f9fa; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Paname Consulting. Tous droits réservés.
          </p>
        </div>
      </div>
    `;

    await this.sendEmail(
      contact.email,
      "Réponse à votre message - Paname Consulting",
      emailContent,
      "réponse contact",
    );
  }

  async sendContactNotification(contact: Contact): Promise<void> {
    const adminEmail = this.configService.get("EMAIL_USER");
    if (!adminEmail) {
      this.logger.warn(
        "EMAIL_USER non configuré - notification contact ignorée",
      );
      return;
    }

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Nouveau Message - Paname Consulting</h1>
        </div>
        <div style="padding: 30px; background: white; border: 1px solid #e0e0e0;">
          <h3 style="color: #333; margin-top: 0;">Nouveau message de contact reçu :</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>De :</strong> ${contact.firstName} ${contact.lastName}</p>
            <p><strong>Email :</strong> ${contact.email}</p>
            <p><strong>Message :</strong><br/>${contact.message}</p>
          </div>
          <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">
            <p style="margin: 0; color: #0369a1; font-size: 14px;">
              <strong>💡 Pour répondre :</strong> Cliquez simplement sur "Répondre" dans votre client email
            </p>
          </div>
        </div>
      </div>
    `;

    await this.sendEmail(
        adminEmail, 
        'Nouveau message de contact - Paname Consulting',
        emailContent,
        'notification contact admin',
        contact.email
    );
}

  async sendContactConfirmation(contact: Contact): Promise<void> {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Paname Consulting</h1>
        </div>
        <div style="padding: 30px; background: white; border: 1px solid #e0e0e0;">
          <h2 style="color: #333; margin-top: 0;">Confirmation de réception</h2>
          <p style="color: #666; line-height: 1.6;">
            Bonjour ${contact.firstName || ""},<br><br>
            Nous accusons réception de votre message et vous remercions de l'intérêt que vous portez à Paname Consulting.
          </p>
          <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Résumé de votre message :</strong><br/>
              ${contact.message}
            </p>
          </div>
          <p style="color: #666; line-height: 1.6; margin-top: 20px;">
            Notre équipe vous contactera dans les plus brefs délais.
          </p>
        </div>
        <div style="padding: 20px; background: #f8f9fa; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Paname Consulting. Tous droits réservés.
          </p>
        </div>
      </div>
    `;

    await this.sendEmail(
        contact.email, 
        'Confirmation de votre message - Paname Consulting',
        emailContent,
        'confirmation contact'
    );
  }

  async sendCancellationNotification(_procedure: Procedure): Promise<void> {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Paname Consulting</h1>
        </div>
      </div>
    `;

    await this.sendEmail(
      _procedure.email,
      "Annulation de votre procédure - Paname Consulting",
      emailContent,
      "notification annulation",
    );
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `***@${domain}`;
    return `${name.substring(0, 2)}***@${domain}`;
  }
}