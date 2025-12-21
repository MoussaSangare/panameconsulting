import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Rendezvous } from '../schemas/rendezvous.schema';
import { Procedure, StepStatus } from '../schemas/procedure.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASS')
      }
    });
  }

  async sendConfirmation(rendezvous: Rendezvous): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_USER'),
        to: rendezvous.email,
        subject: 'Confirmation de rendez-vous',
        html: `
          <p>Bonjour ${rendezvous.firstName},</p>
          <p>Votre rendez-vous est confirmé pour le ${rendezvous.date} à ${rendezvous.time}.</p>
          <p>Cordialement,<br>L'équipe Paname Consulting</p>
        `
      });
    } catch (error) {
      this.logger.error(`Erreur envoi confirmation: ${error.message}`);
    }
  }

  async sendReminder(rendezvous: Rendezvous): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_USER'),
        to: rendezvous.email,
        subject: 'Rappel de rendez-vous',
        html: `
          <p>Bonjour ${rendezvous.firstName},</p>
          <p>Rappel: Vous avez un rendez-vous aujourd'hui à ${rendezvous.time}.</p>
          <p>Cordialement,<br>L'équipe Paname Consulting</p>
        `
      });
    } catch (error) {
      this.logger.error(`Erreur envoi rappel: ${error.message}`);
    }
  }

  async sendStatusUpdate(rendezvous: Rendezvous): Promise<void> {
    try {
      let message = '';
      if (rendezvous.status === 'Terminé' && rendezvous.avisAdmin === 'Favorable') {
        message = 'Bonjour,Votre rendez-vous s’est bien déroulé. À présent, conformément à nos échanges, nous allons lancer la prochaine étape en démarrant votre procédure. Vous pouvez compter sur nous pour vous accompagner tout au long du processus. ';
      } else {
        message = `Le statut de votre rendez-vous est maintenant: ${rendezvous.status}`;
      }

      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_USER'),
        to: rendezvous.email,
        subject: 'Mise à jour de votre rendez-vous',
        html: `
          <p>Bonjour ${rendezvous.firstName},</p>
          <p>${message}</p>
          ${rendezvous.avisAdmin ? `<p>Avis: ${rendezvous.avisAdmin}</p>` : ''}
          <p>Cordialement,<br>L'équipe Paname Consulting</p>
        `
      });
    } catch (error) {
      this.logger.error(`Erreur envoi mise à jour: ${error.message}`);
    }
  }

  async sendProcedureUpdate(procedure: Procedure): Promise<void> {
    try {
      const currentStep = procedure.steps.find(s => s.statut === StepStatus.IN_PROGRESS);
      const message = currentStep 
        ? `Votre procédure est à l'étape: ${currentStep.nom}`
        : 'Votre procédure est terminée';

      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_USER'),
        to: procedure.email,
        subject: 'Mise à jour de votre procédure',
        html: `
          <p>Bonjour ${procedure.prenom},</p>
          <p>${message}</p>
          <p>Statut global: ${procedure.statut}</p>
          ${currentStep?.raisonRefus ? `<p>Raison: ${currentStep.raisonRefus}</p>` : ''}
          <p>Cordialement,<br>L'équipe d'admission</p>
        `
      });
    } catch (error) {
      this.logger.error(`Erreur envoi mise à jour procédure: ${error.message}`);
    }
  }


async sendProcedureCreation(procedure: Procedure, rendezvous: Rendezvous): Promise<void> {
    try {
        await this.transporter.sendMail({
            from: this.configService.get('EMAIL_USER'),
            to: procedure.email,
            subject: 'Votre procédure a été créée - Paname Consulting',
            html: `
                <p>Bonjour ${procedure.prenom},</p>
                <p>Votre rendez-vous du ${rendezvous.date} à ${rendezvous.time} s'est terminé favorablement.</p>
                <p>Nous avons le plaisir de vous informer que votre procédure d'admission a été officiellement créée.</p>
                
                <h3>Détails de votre procédure :</h3>
                <ul>
                    <li><strong>Nom complet :</strong> ${procedure.prenom} ${procedure.nom}</li>
                    <li><strong>Destination :</strong> ${procedure.destination}</li>
                    <li><strong>Statut initial :</strong> ${procedure.statut}</li>
                </ul>
                
                <p>Vous pouvez désormais suivre l'avancement de votre procédure dans votre espace personnel.</p>
                
                <p>Nous vous accompagnerons tout au long des différentes étapes :</p>
                <ol>
                    <li>Demande d'Admission</li>
                    <li>Demande de Visa</li>
                    <li>Préparatifs de Voyage</li>
                </ol>
                
                <p>Notre équipe reste à votre disposition pour toute question.</p>
                
                <p>Cordialement,<br>L'équipe Paname Consulting</p>
            `
        });
    } catch (error) {
        this.logger.error(`Erreur envoi création procédure: ${error.message}`);
    }
}
  

}