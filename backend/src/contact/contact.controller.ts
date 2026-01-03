import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
  Logger,
} from "@nestjs/common";
import { UserRole } from "../schemas/user.schema";
import { Roles } from "../shared/decorators/roles.decorator";
import { JwtAuthGuard } from "../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../shared/guards/roles.guard";
import { ContactService } from "./contact.service";
import { CreateContactDto } from "./dto/create-contact.dto";

@Controller("contact")
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(private readonly contactService: ContactService) {}

  // Envoyer un message (public)
  @Post()
  async create(@Body() createContactDto: CreateContactDto) {
    const maskedEmail = this.maskEmail(createContactDto.email);
    this.logger.log(`Nouveau message de contact reçu de: ${maskedEmail}`);
    
    const contact = await this.contactService.create(createContactDto);
    
    this.logger.log(`Message de contact créé avec succès`);
    
    return {
      message: "Message envoyé avec succès",
      contact,
    };
  }

  // Récupérer tous les messages (admin seulement)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10,
    @Query("isRead") isRead?: boolean,
    @Query("search") search?: string,
  ) {
    // Masquer les termes de recherche dans les logs
    const maskedSearch = search ? "[FILTRE_RECHERCHE]" : undefined;
    this.logger.log(`Récupération des messages de contact - Page: ${page}, Limit: ${limit}, Filtres: ${JSON.stringify({ isRead, search: maskedSearch })}`);
    
    return this.contactService.findAll(page, limit, isRead, search);
  }

  // Statistiques (admin seulement)
  @Get("stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getStats() {
    this.logger.log(`Récupération des statistiques des contacts`);
    
    const stats = await this.contactService.getStats();
    
    this.logger.log(`Statistiques récupérées: ${stats.total} messages au total`);
    
    return stats;
  }

  // Voir un message spécifique (admin seulement)
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findOne(@Param("id") id: string) {
    this.logger.log(`Consultation du message de contact: ${id}`);
    
    const contact = await this.contactService.findOne(id);
    
    this.logger.log(`Message consulté avec succès: ${id}`);
    
    return contact;
  }

  // Marquer comme lu (admin seulement)
  @Patch(":id/read")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async markAsRead(@Param("id") id: string) {
    this.logger.log(`Marquage comme lu du message: ${id}`);
    
    const message = await this.contactService.markAsRead(id);
    
    this.logger.log(`Message marqué comme lu avec succès: ${id}`);
    
    return {
      message: "Message marqué comme lu",
      contact: message,
    };
  }

  // Répondre à un message (admin seulement)
  @Post(":id/reply")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async replyToMessage(
    @Param("id") id: string,
    @Body() body: { reply: string },
    @Req() req: any,
  ) {
    const adminId = req.user?.userId ? `[ADMIN_${req.user.userId}]` : '[ADMIN_INCONNU]';
    this.logger.log(`Envoi de réponse au message: ${id} par ${adminId}`);
    
    const message = await this.contactService.replyToMessage(
      id,
      body.reply,
      req.user,
    );
    
    this.logger.log(`Réponse envoyée avec succès au message: ${id}`);
    
    return {
      message: "Réponse envoyée avec succès",
      contact: message,
    };
  }

  // Supprimer un message (admin seulement)
  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteMessage(@Param("id") id: string) {
    this.logger.log(`Suppression du message de contact: ${id}`);
    
    await this.contactService.remove(id);
    
    this.logger.log(`Message supprimé avec succès: ${id}`);
    
    return {
      message: "Message supprimé avec succès",
    };
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
}