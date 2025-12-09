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

  // 📧 Envoyer un message (public)
  @Post()
  async create(@Body() createContactDto: CreateContactDto) {
    this.logger.log(`Nouveau message de contact reçu de: ${createContactDto.email}`);
    
    const contact = await this.contactService.create(createContactDto);
    
    this.logger.log(`Message de contact créé avec succès - ID: ${contact.email}`);
    
    return {
      message: "Message envoyé avec succès",
      contact,
    };
  }

  // 📋 Récupérer tous les messages (admin seulement)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10,
    @Query("isRead") isRead?: boolean,
    @Query("search") search?: string,
  ) {
    this.logger.log(`Récupération des messages de contact - Page: ${page}, Limit: ${limit}, Filtres: ${JSON.stringify({ isRead, search })}`);
    
    return this.contactService.findAll(page, limit, isRead, search);
  }

  // 📊 Statistiques (admin seulement)
  @Get("stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getStats() {
    this.logger.log(`Récupération des statistiques des contacts`);
    
    const stats = await this.contactService.getStats();
    
    this.logger.log(`Statistiques récupérées: ${stats.total} messages au total`);
    
    return stats;
  }

  // 👁️ Voir un message spécifique (admin seulement)
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findOne(@Param("id") id: string) {
    this.logger.log(`Consultation du message de contact: ${id}`);
    
    const contact = await this.contactService.findOne(id);
    
    this.logger.log(`Message ${id} consulté avec succès`);
    
    return contact;
  }

  // ✅ Marquer comme lu (admin seulement)
  @Patch(":id/read")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async markAsRead(@Param("id") id: string) {
    this.logger.log(`Marquage comme lu du message: ${id}`);
    
    const message = await this.contactService.markAsRead(id);
    
    this.logger.log(`Message ${id} marqué comme lu avec succès`);
    
    return {
      message: "Message marqué comme lu",
      contact: message,
    };
  }

  // 📩 Répondre à un message (admin seulement)
  @Post(":id/reply")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async replyToMessage(
    @Param("id") id: string,
    @Body() body: { reply: string },
    @Req() req: any,
  ) {
    this.logger.log(`Envoi de réponse au message: ${id} par l'admin: ${req.user.userId}`);
    
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

  // 🗑️ Supprimer un message (admin seulement)
  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteMessage(@Param("id") id: string) {
    this.logger.log(`Suppression du message de contact: ${id}`);
    
    await this.contactService.remove(id);
    
    this.logger.log(`Message ${id} supprimé avec succès`);
    
    return {
      message: "Message supprimé avec succès",
    };
  }
}