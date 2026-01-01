import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Contact } from "../schemas/contact.schema";
import { CreateContactDto } from "./dto/create-contact.dto";
import { NotificationService } from "../notification/notification.service";
import { UserRole } from "../schemas/user.schema";

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectModel(Contact.name) private contactModel: Model<Contact>,
    private notificationService: NotificationService,
  ) {}

  // Créer un nouveau message de contact
  async create(createContactDto: CreateContactDto): Promise<Contact> {
    const contactId = "CONTACT_" + Date.now(); // ID temporaire pour les logs
    try {
      this.logger.log(`Création d'un nouveau message de contact [ID: ${contactId}]`);

      // Nettoie les champs optionnels vides
      const cleanedData = {
        ...createContactDto,
        firstName: createContactDto.firstName?.trim() || undefined,
        lastName: createContactDto.lastName?.trim() || undefined,
      };

      const createdContact = new this.contactModel(cleanedData);
      const savedContact = await createdContact.save();

      // Masquer l'email dans les logs
      const maskedEmail = this.maskEmail(savedContact.email);
      this.logger.log(`Message de contact créé avec succès [ID: ${savedContact._id}, Email: ${maskedEmail}]`);

      // Envoyer les notifications après la sauvegarde
      try {
        await this.notificationService.sendContactNotification(savedContact);
        await this.notificationService.sendContactConfirmation(savedContact);
        this.logger.log(`Notifications envoyées pour le contact [ID: ${savedContact._id}]`);
      } catch (notificationError) {
        this.logger.error(
          `Erreur lors de l'envoi des notifications pour le contact [ID: ${savedContact._id}]`,
          notificationError.stack,
        );
        // Ne pas propager l'erreur des notifications pour ne pas bloquer l'envoi du formulaire
      }

      return savedContact;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création du contact [ID: ${contactId}]: ${error.message}`,
        error.stack,
      );
      
      // Si c'est une erreur de validation Mongoose, la formater proprement
      if (error.name === 'ValidationError') {
        throw new BadRequestException({
          message: "Erreur de validation",
          errors: error.errors,
        });
      }
      
      throw new BadRequestException("Erreur lors de l'envoi du message");
    }
  }

  // Récupérer tous les messages avec pagination et filtres
  async findAll(
    page: number = 1,
    limit: number = 10,
    isRead?: boolean,
    search?: string,
  ) {
    try {
      // Masquer les termes de recherche dans les logs
      const maskedSearch = search ? "[FILTRE_RECHERCHE]" : undefined;
      this.logger.debug(`Récupération des contacts - Page: ${page}, Limit: ${limit}, Filtres: ${JSON.stringify({ isRead, search: maskedSearch })}`);

      // Valider les paramètres
      if (page < 1)
        throw new BadRequestException(
          "Le numéro de page doit être supérieur à 0",
        );
      if (limit < 1 || limit > 100)
        throw new BadRequestException("La limite doit être entre 1 et 100");

      const skip = (page - 1) * limit;

      const filters: any = {};
      if (isRead !== undefined) filters.isRead = isRead;
      if (search?.trim()) {
        filters.$or = [
          { email: { $regex: search.trim(), $options: "i" } },
          { firstName: { $regex: search.trim(), $options: "i" } },
          { lastName: { $regex: search.trim(), $options: "i" } },
          { message: { $regex: search.trim(), $options: "i" } },
        ];
      }

      const [data, total] = await Promise.all([
        this.contactModel
          .find(filters)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .exec(),
        this.contactModel.countDocuments(filters),
      ]);

      this.logger.debug(`Récupération réussie: ${data.length} contacts sur ${total} total`);

      return {
        data,
        total,
        page: Number(page),
        limit: Number(limit),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des contacts: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Récupérer un message spécifique
  async findOne(id: string): Promise<Contact> {
    try {
      this.logger.debug(`Recherche du contact [ID: ${id}]`);
      
      const contact = await this.contactModel.findById(id).exec();
      if (!contact) {
        this.logger.warn(`Contact non trouvé [ID: ${id}]`);
        throw new NotFoundException("Message de contact non trouvé");
      }
      
      // Masquer l'email avant de logger
      const maskedEmail = this.maskEmail(contact.email);
      this.logger.debug(`Contact trouvé [ID: ${id}, Email: ${maskedEmail}]`);
      return contact;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du contact [ID: ${id}]: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Marquer un message comme lu
  async markAsRead(id: string): Promise<Contact> {
    try {
      this.logger.log(`Marquage comme lu du contact [ID: ${id}]`);
      
      const contact = await this.contactModel
        .findByIdAndUpdate(id, { isRead: true }, { new: true })
        .exec();

      if (!contact) {
        this.logger.warn(`Contact non trouvé pour marquage comme lu [ID: ${id}]`);
        throw new NotFoundException("Message de contact non trouvé");
      }

      this.logger.log(`Message marqué comme lu avec succès [ID: ${id}]`);
      return contact;
    } catch (error) {
      this.logger.error(
        `Erreur lors du marquage comme lu du contact [ID: ${id}]: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Répondre à un message (admin seulement)
  async replyToMessage(id: string, reply: string, user: any): Promise<Contact> {
    try {
      const adminId = user?.userId ? `[ADMIN_${user.userId}]` : '[ADMIN_INCONNU]';
      this.logger.log(`Envoi de réponse au contact [ID: ${id}] par ${adminId}`);

      // Vérification des droits admin
      if (!user || user.role !== UserRole.ADMIN) {
        this.logger.warn(`Tentative d'accès non autorisée pour répondre au contact [ID: ${id}]`);
        throw new BadRequestException("Accès refusé : admin requis");
      }

      if (!reply || reply.trim().length < 1) {
        this.logger.warn(`Tentative d'envoi de réponse vide pour le contact [ID: ${id}]`);
        throw new BadRequestException("La réponse ne peut pas être vide");
      }

      const contact = await this.contactModel.findById(id).exec();
      if (!contact) {
        this.logger.warn(`Contact non trouvé pour réponse [ID: ${id}]`);
        throw new NotFoundException("Message de contact non trouvé");
      }

      // Mise à jour du message avec la réponse
      const updatedContact = await this.contactModel
        .findByIdAndUpdate(
          id,
          {
            adminResponse: reply.trim(),
            respondedAt: new Date(),
            respondedBy: user._id,
            isRead: true,
          },
          { new: true },
        )
        .exec();

      if (!updatedContact) {
        this.logger.error(`Erreur lors de la mise à jour du contact [ID: ${id}]`);
        throw new NotFoundException("Erreur lors de la mise à jour du message");
      }

      // Envoyer la réponse par email
      await this.notificationService.sendContactReply(updatedContact, reply);

      this.logger.log(`Réponse envoyée avec succès au contact [ID: ${id}] par ${adminId}`);
      return updatedContact;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de la réponse au contact [ID: ${id}]: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Supprimer un message
  async remove(id: string): Promise<void> {
    try {
      this.logger.log(`Suppression du contact [ID: ${id}]`);
      
      const result = await this.contactModel.findByIdAndDelete(id).exec();
      if (!result) {
        this.logger.warn(`Contact non trouvé pour suppression [ID: ${id}]`);
        throw new NotFoundException("Message de contact non trouvé");
      }

      this.logger.log(`Message de contact supprimé avec succès [ID: ${id}]`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression du contact [ID: ${id}]: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Obtenir les statistiques des messages
  async getStats(): Promise<{
    total: number;
    unread: number;
    read: number;
    responded: number;
    thisMonth: number;
    lastMonth: number;
  }> {
    try {
      this.logger.debug(`Calcul des statistiques des contacts`);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const [total, unread, read, responded, thisMonth, lastMonth] =
        await Promise.all([
          this.contactModel.countDocuments(),
          this.contactModel.countDocuments({ isRead: false }),
          this.contactModel.countDocuments({ isRead: true }),
          this.contactModel.countDocuments({
            adminResponse: { $exists: true, $ne: null },
          }),
          this.contactModel.countDocuments({
            createdAt: { $gte: startOfMonth },
          }),
          this.contactModel.countDocuments({
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          }),
        ]);

      this.logger.debug(`Statistiques calculées: Total=${total}, Non lus=${unread}, Répondus=${responded}`);

      return {
        total,
        unread,
        read,
        responded,
        thisMonth,
        lastMonth,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des statistiques: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Méthode privée pour masquer les emails dans les logs
  private maskEmail(email: string): string {
    if (!email) return '[EMAIL_NON_DEFINI]';
    
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '[EMAIL_MAL_FORMATE]';
    
    // Garde les 2 premiers caractères du local part, masque le reste
    const maskedLocal = localPart.length > 2 
      ? localPart.substring(0, 2) + '*'.repeat(localPart.length - 2)
      : '*'.repeat(localPart.length);
    
    return `${maskedLocal}@${domain}`;
  }

  // Méthode pour masquer les IDs sensibles
  private maskSensitiveId(id: string): string {
    if (!id) return '[ID_NON_DEFINI]';
    if (id.length <= 8) return `[ID_${id}]`;
    
    // Garde les 4 premiers et 4 derniers caractères
    const firstPart = id.substring(0, 4);
    const lastPart = id.substring(id.length - 4);
    return `[ID_${firstPart}...${lastPart}]`;
  }
}