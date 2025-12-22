import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Rendezvous } from "../schemas/rendezvous.schema";
import { Procedure, ProcedureStatus, StepStatus } from "../schemas/procedure.schema";
import { Contact } from "../schemas/contact.schema";
import { EmailConfigService } from "../config/email-config.service";
import { AppConfig } from "../config/configuration";

interface EmailTemplateData {
  firstName: string;
  [key: string]: any;
}

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private appName = "Paname Consulting";
  private frontendUrl: string;
  private initialized = false;

  constructor(
    private configService: ConfigService<AppConfig>,
    private emailService: EmailConfigService
  ) {
    const config = this.configService.get<AppConfig>('app', { infer: true });
    this.appName = config.appName;
    this.frontendUrl = config.frontendUrl;
  }

  async onModuleInit() {
    this.logger.log('⏳ Initialisation du service notification...');
    
    try {
      // Attendre que le service email soit initialisé
      let attempts = 0;
      const maxAttempts = 10;
      const delayMs = 1000;

      while (attempts < maxAttempts) {
        if (this.emailService.isAvailable()) {
          const status = this.emailService.getStatus();
          this.logger.log('✅ Service notification initialisé avec succès');
          this.logger.log(`📊 Statut email: ${status.sentCount} envoyés, ${status.failedCount} échecs`);
          this.initialized = true;
          return;
        }
        
        attempts++;
        this.logger.debug(`⏳ Attente du service email... (${attempts}/${maxAttempts})`);
        await this.delay(delayMs);
      }

      // Si on arrive ici, le service email n'est pas disponible
      this.logger.warn('⚠️ Service email non disponible après plusieurs tentatives');
      this.logger.warn('Le service notification fonctionnera en mode dégradé');
      
    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'initialisation: ${error.message}`);
    }
  }

  private async sendNotification(
    to: string,
    subject: string,
    templateName: string,
    templateData: EmailTemplateData
  ): Promise<boolean> {
    // Vérifier si le service est initialisé
    if (!this.initialized || !this.emailService.isAvailable()) {
      this.logger.warn(`⏸️  Notification "${templateName}" ignorée - service email non disponible`);
      this.logger.debug(`Initialized: ${this.initialized}, Available: ${this.emailService.isAvailable()}`);
      return false;
    }

    try {
      const html = this.generateTemplate(templateName, templateData);
      const context = `${templateName}-${new Date().toISOString().split('T')[0]}`;
      
      const result = await this.emailService.sendEmail(to, subject, html, context);
      
      if (result) {
        this.logger.log(`✅ Notification "${templateName}" envoyée à ${this.maskEmail(to)}`);
      } else {
        this.logger.warn(`⚠️ Échec d'envoi de notification "${templateName}"`);
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'envoi "${templateName}": ${error.message}`);
      return false;
    }
  }

  private generateTemplate(templateName: string, data: EmailTemplateData): string {
    const baseTemplate = this.getBaseTemplate();
    const content = this.getTemplateContent(templateName, data);
    
    return baseTemplate
      .replace('{{APP_NAME}}', this.appName)
      .replace('{{CONTENT}}', content)
      .replace(/{{FIRST_NAME}}/g, data.firstName)
      .replace(/{{FRONTEND_URL}}/g, this.frontendUrl)
      .replace(/{{CURRENT_YEAR}}/g, new Date().getFullYear().toString());
  }

  private getBaseTemplate(): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>{{APP_NAME}}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f5f7fa; }
          .email-container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 10px; }
          .header p { font-size: 16px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 18px; margin-bottom: 25px; color: #1e293b; }
          .info-box { background: #f8fafc; border-left: 4px solid #0ea5e9; padding: 25px; margin: 25px 0; border-radius: 0 8px 8px 0; }
          .info-box h3 { color: #0f172a; margin-bottom: 15px; font-size: 18px; }
          .info-box p { margin: 8px 0; color: #475569; }
          .footer { background: #f1f5f9; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #64748b; font-size: 14px; line-height: 1.5; }
          .footer a { color: #0ea5e9; text-decoration: none; }
          .footer .copyright { margin-top: 20px; font-size: 12px; color: #94a3b8; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
          .important { background: #fef3c7; border-left-color: #f59e0b; }
          .success { background: #d1fae5; border-left-color: #10b981; }
          .warning { background: #fef3c7; border-left-color: #f59e0b; }
          .danger { background: #fee2e2; border-left-color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>{{APP_NAME}}</h1>
            <p>Votre partenaire pour les études à l'international</p>
          </div>
          
          <div class="content">
            <p class="greeting">Bonjour <strong>{{FIRST_NAME}}</strong>,</p>
            {{CONTENT}}
          </div>
          
          <div class="footer">
            <p>
              <strong>Besoin d'aide ?</strong><br>
              Contactez-nous : <a href="mailto:support@panameconsulting.com">support@panameconsulting.com</a>
            </p>
            <p>
              <strong>Visitez notre site :</strong><br>
              <a href="{{FRONTEND_URL}}">{{FRONTEND_URL.replace('https://', '')}}</a>
            </p>
            <div class="copyright">
              © {{CURRENT_YEAR}} {{APP_NAME}}. Tous droits réservés.<br>
              Kalaban Coura, Bamako, Mali
            </div>
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
      
      <div class="info-box success">
        <h3>📅 Détails du rendez-vous</h3>
        <p><strong>Date :</strong> ${dateFormatted}</p>
        <p><strong>Heure :</strong> ${rendezvous.time}</p>
        <p><strong>Lieu :</strong> ${this.appName} - Kalaban Coura, Bamako</p>
        <p><strong>Statut :</strong> <span style="color: #10b981;">Confirmé ✓</span></p>
      </div>
      
      <p>Nous vous attendons avec impatience pour échanger sur votre projet d'études.</p>
      
      <div class="info-box">
        <p><strong>ℹ️ Informations importantes :</strong></p>
        <p>• Merci d'arriver 10 minutes avant l'heure prévue</p>
        <p>• Apportez vos documents d'identité et académiques</p>
        <p>• Durée estimée : 45 minutes à 1 heure</p>
      </div>
    `;

    return await this.sendNotification(
      rendezvous.email,
      `Confirmation de rendez-vous - ${this.appName}`,
      'rendezvous-confirmation',
      {
        firstName: rendezvous.firstName,
        content,
      }
    );
  }

  async sendReminder(rendezvous: Rendezvous): Promise<boolean> {
    const content = `
      <p>Rappel amical : Vous avez un rendez-vous prévu aujourd'hui.</p>
      
      <div class="info-box important">
        <h3>⏰ Votre rendez-vous aujourd'hui</h3>
        <p><strong>Heure :</strong> ${rendezvous.time}</p>
        <p><strong>Lieu :</strong> ${this.appName} - Kalaban Coura, Bamako</p>
      </div>
      
      <p>Nous sommes impatients de vous rencontrer et de discuter de votre projet.</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="tel:+22320202020" class="button">📞 Nous appeler</a>
        <a href="${this.frontendUrl}/rendezvous" class="button" style="background: #475569; margin-left: 10px;">📋 Mes rendez-vous</a>
      </div>
    `;

    return await this.sendNotification(
      rendezvous.email,
      `Rappel - Rendez-vous aujourd'hui - ${this.appName}`,
      'rendezvous-reminder',
      {
        firstName: rendezvous.firstName,
        content,
      }
    );
  }

  async sendStatusUpdate(rendezvous: Rendezvous): Promise<boolean> {
    const dateStr = new Date(rendezvous.date).toLocaleDateString("fr-FR");
    
    let subject = '';
    let header = 'Mise à jour de Rendez-vous';
    let content = '';
    let boxClass = 'info-box';

    switch (rendezvous.status) {
      case "Confirmé":
        subject = `Rendez-vous Confirmé - ${this.appName}`;
        boxClass = 'info-box success';
        content = `
          <p>Votre demande de rendez-vous a été confirmée par notre équipe.</p>
          
          <div class="${boxClass}">
            <h3>✅ Rendez-vous confirmé</h3>
            <p><strong>Date :</strong> ${dateStr}</p>
            <p><strong>Heure :</strong> ${rendezvous.time}</p>
            <p><strong>Référence :</strong> RDV-${rendezvous._id.toString().substring(0, 8).toUpperCase()}</p>
          </div>
          
          <p>Vous recevrez un rappel la veille de votre rendez-vous.</p>
        `;
        break;

      case "Annulé":
        subject = `Rendez-vous Annulé - ${this.appName}`;
        header = 'Rendez-vous Annulé';
        boxClass = 'info-box danger';
        const cancelledBy = rendezvous.cancelledBy === 'admin' ? 'par notre équipe' : 'à votre demande';
        
        content = `
          <p>Votre rendez-vous a été annulé ${cancelledBy}.</p>
          
          <div class="${boxClass}">
            <h3>❌ Rendez-vous annulé</h3>
            <p><strong>Date prévue :</strong> ${dateStr}</p>
            <p><strong>Heure prévue :</strong> ${rendezvous.time}</p>
            ${rendezvous.cancellationReason ? `<p><strong>Raison :</strong> ${rendezvous.cancellationReason}</p>` : ""}
            <p><strong>Référence :</strong> RDV-${rendezvous._id.toString().substring(0, 8).toUpperCase()}</p>
          </div>
          
          <p>Nous regrettons cette annulation et restons à votre disposition pour un nouveau rendez-vous.</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${this.frontendUrl}/rendezvous/nouveau" class="button">📅 Prendre un nouveau rendez-vous</a>
          </div>
        `;
        break;

      case "Terminé":
        header = "Rendez-vous Terminé";
        if (rendezvous.avisAdmin === "Favorable") {
          subject = `Rendez-vous Terminé - Avis Favorable - ${this.appName}`;
          boxClass = 'info-box success';
          content = `
            <p>Votre rendez-vous s'est déroulé avec succès.</p>
            
            <div class="${boxClass}">
              <h3>🎉 Avis favorable</h3>
              <p>Votre dossier a reçu un avis favorable de notre comité d'admission.</p>
              <p><strong>Prochaine étape :</strong> Lancement de votre procédure d'admission</p>
            </div>
            
            <p>Félicitations ! Vous recevrez sous peu les détails de la procédure à suivre.</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="${this.frontendUrl}/procedures" class="button">📋 Suivre ma procédure</a>
            </div>
          `;
        } else if (rendezvous.avisAdmin === "Défavorable") {
          subject = `Rendez-vous Terminé - ${this.appName}`;
          boxClass = 'info-box warning';
          content = `
            <p>Votre rendez-vous est maintenant terminé.</p>
            
            <div class="${boxClass}">
              <h3>📝 Compte rendu</h3>
              <p>Après examen, votre dossier n'a pas reçu un avis favorable pour le programme envisagé.</p>
            </div>
            
            <p>Notre équipe reste à votre disposition pour étudier d'autres alternatives adaptées à votre profil.</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="${this.frontendUrl}/contact" class="button">💬 Discuter des alternatives</a>
            </div>
          `;
        }
        break;

      case "En attente":
        subject = `Statut Modifié - En Attente - ${this.appName}`;
        header = "Rendez-vous en Attente";
        boxClass = 'info-box warning';
        content = `
          <p>Votre demande de rendez-vous est en attente de confirmation.</p>
          
          <div class="${boxClass}">
            <h3>⏳ En attente de confirmation</h3>
            <p>Nous traitons votre demande dans les meilleurs délais.</p>
            <p><strong>Référence :</strong> RDV-${rendezvous._id.toString().substring(0, 8).toUpperCase()}</p>
          </div>
          
          <p>Vous recevrez une notification dès que votre rendez-vous sera confirmé.</p>
          
          <p style="font-size: 14px; color: #64748b; margin-top: 20px;">
            <em>Délai de traitement habituel : 24 à 48 heures ouvrables</em>
          </p>
        `;
        break;
    }

    if (content && subject) {
      return await this.sendNotification(
        rendezvous.email,
        subject,
        'rendezvous-status-update',
        {
          firstName: rendezvous.firstName,
          content,
          header,
        }
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
    let subject = `Mise à jour de votre procédure - ${this.appName}`;
    let boxClass = 'info-box';

    if (currentStep) {
      boxClass = 'info-box';
      content = `
        <p>Votre procédure d'admission avance.</p>
        
        <div class="${boxClass}">
          <h3>📈 Avancement</h3>
          <div style="margin: 15px 0;">
            <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%); width: ${progress}%; height: 100%;"></div>
            </div>
            <p style="text-align: center; margin-top: 5px; font-weight: 600; color: #0ea5e9;">${progress}% complété</p>
          </div>
          <p><strong>Étape en cours :</strong> ${currentStep.nom}</p>
          <p><strong>Statut :</strong> ${procedure.statut}</p>
          <p><strong>Destination :</strong> ${procedure.destination}</p>
          <p><strong>Filière :</strong> ${procedure.filiere}</p>
          <p><strong>Référence :</strong> PROC-${procedure._id.toString().substring(0, 8).toUpperCase()}</p>
        </div>
        
        <p>Notre équipe travaille activement sur votre dossier. Vous serez informé de la prochaine étape.</p>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="${this.frontendUrl}/procedures/${procedure._id}" class="button">👁️ Voir le détail</a>
        </div>
      `;
    } else if (procedure.statut === ProcedureStatus.COMPLETED) {
      subject = `🎉 Procédure Terminée - ${this.appName}`;
      header = "Procédure Finalisée";
      boxClass = 'info-box success';
      content = `
        <p>Félicitations ! Votre procédure d'admission est maintenant terminée avec succès.</p>
        
        <div class="${boxClass}">
          <h3>✅ Procédure finalisée</h3>
          <p><strong>Statut :</strong> <span style="color: #10b981;">${procedure.statut} ✓</span></p>
          <p><strong>Destination :</strong> ${procedure.destination}</p>
          <p><strong>Filière :</strong> ${procedure.filiere}</p>
          <p><strong>Référence :</strong> PROC-${procedure._id.toString().substring(0, 8).toUpperCase()}</p>
          <p><strong>Date de finalisation :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
        
        <p>Vous avez franchi toutes les étapes nécessaires. Notre équipe vous contactera sous peu pour la suite.</p>
        
        <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>📋 Prochaines étapes :</strong></p>
          <p>• Récupération des documents officiels</p>
          <p>• Préparation au départ</p>
          <p>• Briefing pré-départ</p>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="tel:+22320202020" class="button">📞 Prendre rendez-vous</a>
        </div>
      `;
    } else if (procedure.statut === ProcedureStatus.REJECTED) {
      subject = `Procédure Rejetée - ${this.appName}`;
      header = "Procédure Rejetée";
      boxClass = 'info-box danger';
      content = `
        <p>Votre procédure d'admission a été rejetée.</p>
        
        <div class="${boxClass}">
          <h3>❌ Décision</h3>
          <p><strong>Statut :</strong> <span style="color: #ef4444;">${procedure.statut}</span></p>
          <p><strong>Destination :</strong> ${procedure.destination}</p>
          <p><strong>Filière :</strong> ${procedure.filiere}</p>
          ${procedure.raisonRejet ? `<p><strong>Raison :</strong> ${procedure.raisonRejet}</p>` : ""}
          <p><strong>Référence :</strong> PROC-${procedure._id.toString().substring(0, 8).toUpperCase()}</p>
        </div>
        
        <p>Nous regrettons cette décision. Notre équipe reste à votre disposition pour discuter des alternatives possibles.</p>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="${this.frontendUrl}/contact" class="button">💬 Discuter des options</a>
        </div>
      `;
    }

    if (content) {
      return await this.sendNotification(
        procedure.email,
        subject,
        'procedure-update',
        {
          firstName: procedure.prenom,
          content,
          header,
        }
      );
    }

    return false;
  }

  async sendProcedureCreation(procedure: Procedure, rendezvous: Rendezvous): Promise<boolean> {
    const content = `
      <p>Suite à l'avis favorable de votre rendez-vous, votre procédure d'admission a été officiellement lancée.</p>
      
      <div class="info-box success">
        <h3>🚀 Votre procédure est lancée</h3>
        <p><strong>Destination :</strong> ${procedure.destination}</p>
        <p><strong>Filière :</strong> ${procedure.filiere}</p>
        <p><strong>Date du rendez-vous :</strong> ${new Date(rendezvous.date).toLocaleDateString("fr-FR")}</p>
        <p><strong>Référence procédure :</strong> PROC-${procedure._id.toString().substring(0, 8).toUpperCase()}</p>
        <p><strong>Référence rendez-vous :</strong> RDV-${rendezvous._id.toString().substring(0, 8).toUpperCase()}</p>
      </div>
      
      <p>Notre équipe va désormais vous accompagner pas à pas dans toutes les étapes de votre admission.</p>
      
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>📋 Étapes de la procédure :</strong></p>
        <ol style="margin-left: 20px; margin-top: 10px;">
          ${procedure.steps.map((step, index) => 
            `<li>${step.nom} <span style="color: ${step.statut === StepStatus.COMPLETED ? '#10b981' : '#94a3b8'}">(${step.statut})</span></li>`
          ).join('')}
        </ol>
      </div>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${this.frontendUrl}/procedures/${procedure._id}" class="button">📊 Suivre ma procédure</a>
      </div>
    `;

    return await this.sendNotification(
      procedure.email,
      `Votre procédure est lancée - ${this.appName}`,
      'procedure-creation',
      {
        firstName: procedure.prenom,
        content,
      }
    );
  }

  async sendCancellationNotification(procedure: Procedure): Promise<boolean> {
    const content = `
      <p>Votre procédure d'admission a été annulée.</p>
      
      <div class="info-box danger">
        <h3>🛑 Annulation</h3>
        <p><strong>Destination :</strong> ${procedure.destination}</p>
        <p><strong>Filière :</strong> ${procedure.filiere}</p>
        <p><strong>Référence :</strong> PROC-${procedure._id.toString().substring(0, 8).toUpperCase()}</p>
        ${procedure.deletionReason ? `<p><strong>Raison :</strong> ${procedure.deletionReason}</p>` : ""}
        <p><strong>Date d'annulation :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
      </div>
      
      <p>Nous regrettons cette annulation. Notre équipe reste à votre disposition pour toute question ou pour étudier d'autres projets.</p>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${this.frontendUrl}/contact" class="button">💬 Nous contacter</a>
      </div>
    `;

    return await this.sendNotification(
      procedure.email,
      `Annulation de votre procédure - ${this.appName}`,
      'procedure-cancellation',
      {
        firstName: procedure.prenom,
        content,
      }
    );
  }

  // ==================== CONTACT NOTIFICATIONS ====================

  async sendContactReply(contact: Contact, reply: string): Promise<boolean> {
    const content = `
        <p>En réponse à votre message, ${contact.firstName} vous écrit :</p>
      
      <div class="info-box">
        <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <p style="white-space: pre-line; line-height: 1.8;">${reply}</p>
        </div>
      </div>
      
      <p>Nous espérons que cette réponse correspond à vos attentes.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <p><strong>Votre message original :</strong></p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin-top: 10px; font-size: 14px;">
          <p style="white-space: pre-line;">${contact.message}</p>
        </div>
      </div>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${this.frontendUrl}/contact" class="button">💬 Nouveau message</a>
      </div>
    `;

    return await this.sendNotification(
      contact.email,
      `Réponse à votre message - ${this.appName}`,
      'contact-reply',
      {
        firstName: contact.firstName || 'Cher client',
        content,
      }
    );
  }

  async sendContactNotification(contact: Contact): Promise<boolean> {
    const adminEmail = this.configService.get<string>('app.adminEmail', { infer: true });
    
    if (!adminEmail) {
      this.logger.warn("Email admin non configuré - notification contact ignorée");
      return false;
    }

    const content = `
      <p>Nouveau message de contact reçu sur le site :</p>
      
      <div class="info-box important">
        <h3>📨 Informations du contact</h3>
        <p><strong>Nom complet :</strong> ${contact.firstName} ${contact.lastName}</p>
        <p><strong>Email :</strong> ${contact.email}</p>
        
        <p><strong>Date :</strong> ${new Date().toLocaleString("fr-FR")}</p>
      </div>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
        <h4 style="margin-top: 0; color: #475569;">Message :</h4>
        <p style="white-space: pre-line; line-height: 1.6;">${contact.message}</p>
      </div>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="mailto:${contact.email}" class="button">📧 Répondre</a>
      </div>
    `;

    return await this.emailService.sendEmail(
      adminEmail,
      `Nouveau message de contact - ${contact.firstName} ${contact.lastName} - ${this.appName}`,
      this.generateTemplate('contact-admin', {
        firstName: 'Équipe',
        content,
      }),
      'contact-admin-notification'
    );
  }

  async sendContactConfirmation(contact: Contact): Promise<boolean> {
    const content = `
      <p>Nous accusons réception de votre message.</p>
      
      <div class="info-box success">
        <h3>✅ Message bien reçu</h3>
        <p>Votre demande a bien été enregistrée dans notre système.</p>
        <p><strong>Délai de réponse :</strong> 48 heures ouvrables maximum</p>
      </div>
      
      <p>Un membre de notre équipe vous contactera rapidement par email ou téléphone.</p>
      
      <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>ℹ️ Informations pratiques :</strong></p>
        <p><strong>📞 Téléphone :</strong> +223 20 20 20 20</p>
        <p><strong>🕒 Horaires :</strong> Lundi - Vendredi, 8h - 18h</p>
        <p><strong>📍 Adresse :</strong> Kalaban Coura, Bamako, Mali</p>
      </div>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${this.frontendUrl}" class="button">🌐 Visiter notre site</a>
      </div>
    `;

    return await this.sendNotification(
      contact.email,
      `Confirmation de réception - ${this.appName}`,
      'contact-confirmation',
      {
        firstName: contact.firstName || 'Cher client',
        content,
      }
    );
  }

  // ==================== UTILITY METHODS ====================

  private getTemplateContent(templateName: string, data: any): string {
    // Cette méthode est utilisée par generateTemplate
    return data.content;
  }

  getEmailStatus(): { available: boolean; stats: any; lastCheck: string } {
    const status = this.emailService.getStatus();
    
    return {
      available: status.available,
      stats: {
        sent: status.sentCount,
        failed: status.failedCount,
        uptime: Math.floor(status.uptime / 1000 / 60) + ' minutes',
      },
      lastCheck: status.lastCheck || 'Jamais',
    };
  }

  
  private maskEmail(email: string): string {
    if (!email?.includes('@')) return '***@***';
    
    const [name, domain] = email.split('@');
    const nameLength = name.length;
    
    if (nameLength <= 3) {
      return '***@' + domain;
    }
    
    const first = name.substring(0, 2);
    const last = name.substring(nameLength - 1);
    const masked = first + '*'.repeat(3) + last;
    
    return masked + '@' + domain;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testEmailService(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.emailService.testEmailService();
      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      return {
        success: false,
        message: `Erreur lors du test: ${error.message}`,
      };
    }
  }
}