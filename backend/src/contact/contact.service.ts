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

  // 📨 Créer un nouveau message de contact
  async create(createContactDto: CreateContactDto): Promise<Contact> {
    try {
      this.logger.log(`Création d'un nouveau message de contact de: ${createContactDto.email}`);

      const createdContact = new this.contactModel(createContactDto);
      const savedContact = await createdContact.save();

      this.logger.log(`Message de contact créé avec ID: ${savedContact._id}`);

      // Envoyer les notifications après la sauvegarde
      try {
        await this.notificationService.sendContactNotification(savedContact);
        await this.notificationService.sendContactConfirmation(savedContact);
        this.logger.log(`Notifications envoyées pour le contact ID: ${savedContact._id}`);
      } catch (notificationError) {
        this.logger.error(
          `Erreur lors de l'envoi des notifications pour le contact ${savedContact._id}: ${notificationError.message}`,
          notificationError.stack,
        );
      }

      return savedContact;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la création du contact: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException("Erreur lors de l'envoi du message");
    }
  }

  // 📋 Récupérer tous les messages avec pagination et filtres
  async findAll(
    page: number = 1,
    limit: number = 10,
    isRead?: boolean,
    search?: string,
  ) {
    try {
      this.logger.debug(`Récupération des contacts - Page: ${page}, Limit: ${limit}, Filtres: ${JSON.stringify({ isRead, search })}`);

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

  // 👁️ Récupérer un message spécifique
  async findOne(id: string): Promise<Contact> {
    try {
      this.logger.debug(`Recherche du contact: ${id}`);
      
      const contact = await this.contactModel.findById(id).exec();
      if (!contact) {
        this.logger.warn(`Contact non trouvé: ${id}`);
        throw new NotFoundException("Message de contact non trouvé");
      }
      
      this.logger.debug(`Contact trouvé: ${id}`);
      return contact;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du contact ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ✅ Marquer un message comme lu
  async markAsRead(id: string): Promise<Contact> {
    try {
      this.logger.log(`Marquage comme lu du contact: ${id}`);
      
      const contact = await this.contactModel
        .findByIdAndUpdate(id, { isRead: true }, { new: true })
        .exec();

      if (!contact) {
        this.logger.warn(`Contact non trouvé pour marquage comme lu: ${id}`);
        throw new NotFoundException("Message de contact non trouvé");
      }

      this.logger.log(`Message ${id} marqué comme lu avec succès`);
      return contact;
    } catch (error) {
      this.logger.error(
        `Erreur lors du marquage comme lu du contact ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // 📩 Répondre à un message (admin seulement)
  async replyToMessage(id: string, reply: string, user: any): Promise<Contact> {
    try {
      this.logger.log(`Envoi de réponse au contact ${id} par l'admin ${user.userId}`);

      // Vérification des droits admin
      if (!user || user.role !== UserRole.ADMIN) {
        this.logger.warn(`Tentative d'accès non autorisée pour répondre au contact ${id}`);
        throw new BadRequestException("Accès refusé : admin requis");
      }

      if (!reply || reply.trim().length < 1) {
        this.logger.warn(`Tentative d'envoi de réponse vide pour le contact ${id}`);
        throw new BadRequestException("La réponse ne peut pas être vide");
      }

      const contact = await this.contactModel.findById(id).exec();
      if (!contact) {
        this.logger.warn(`Contact non trouvé pour réponse: ${id}`);
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
        this.logger.error(`Erreur lors de la mise à jour du contact ${id}`);
        throw new NotFoundException("Erreur lors de la mise à jour du message");
      }

      // Envoyer la réponse par email
      await this.notificationService.sendContactReply(updatedContact, reply);

      this.logger.log(`Réponse envoyée avec succès au contact ${id} par l'admin ${user.userId}`);
      return updatedContact;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de la réponse au contact ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // 🗑️ Supprimer un message
  async remove(id: string): Promise<void> {
    try {
      this.logger.log(`Suppression du contact: ${id}`);
      
      const result = await this.contactModel.findByIdAndDelete(id).exec();
      if (!result) {
        this.logger.warn(`Contact non trouvé pour suppression: ${id}`);
        throw new NotFoundException("Message de contact non trouvé");
      }

      this.logger.log(`Message de contact ${id} supprimé avec succès`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression du contact ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // 📊 Obtenir les statistiques des messages
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
}