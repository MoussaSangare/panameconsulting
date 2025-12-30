import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Req,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { CreateRendezvousDto } from './dto/create-rendezvous.dto';
import { UpdateRendezvousDto } from './dto/update-rendezvous.dto';
import { RendezvousService } from './rendez-vous.service';
import { Roles } from '../shared/decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import { AuthenticatedRequest } from '../shared/interfaces/authenticated-user.interface';
import { ApiOperation, ApiResponse, ApiQuery, ApiTags, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';

// Constantes pour la cohérence
const RENDEZVOUS_STATUS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  EXPIRED: 'Expiré'
} as const;

const ADMIN_OPINION = {
  FAVORABLE: 'Favorable',
  UNFAVORABLE: 'Défavorable'
} as const;

@ApiTags('rendezvous')
@ApiBearerAuth()
@Controller('rendezvous')
export class RendezvousController {
  private readonly logger = new Logger(RendezvousController.name);

  // Méthode utilitaire pour masquer les données sensibles dans les logs
  private maskSensitiveData(data: any): any {
    if (!data) return data;
    
    const masked = { ...data };
    
    // Masquer l'email
    if (masked.email) {
      const [localPart, domain] = masked.email.split('@');
      if (localPart && domain) {
        const maskedLocal = localPart.length <= 2 
          ? localPart.charAt(0) + '*'
          : localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1);
        masked.email = `${maskedLocal}@${domain}`;
      }
    }
    
    // Masquer le téléphone (garder les 4 derniers chiffres)
    if (masked.telephone) {
      const phoneStr = String(masked.telephone);
      if (phoneStr.length > 4) {
        masked.telephone = '***' + phoneStr.slice(-4);
      } else {
        masked.telephone = '***';
      }
    }
    
    // Masquer le prénom et nom (garder première lettre)
    if (masked.firstName) {
      masked.firstName = masked.firstName.length <= 1 
        ? masked.firstName.charAt(0) + '*'
        : masked.firstName.charAt(0) + '***';
    }
    
    if (masked.lastName) {
      masked.lastName = masked.lastName.length <= 1 
        ? masked.lastName.charAt(0) + '*'
        : masked.lastName.charAt(0) + '***';
    }
    
    // Masquer ID partiellement
    if (masked._id || masked.id) {
      const idStr = String(masked._id || masked.id);
      if (idStr.length > 8) {
        masked._id = idStr.substring(0, 4) + '***' + idStr.slice(-4);
        masked.id = masked._id;
      }
    }
    
    return masked;
  }

  // Méthode pour masquer un email simple
  private maskEmail(email: string): string {
    if (!email) return '***';
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***';
    
    if (localPart.length <= 2) {
      return `${localPart.charAt(0)}***@${domain}`;
    }
    return `${localPart.charAt(0)}***${localPart.charAt(localPart.length - 1)}@${domain}`;
  }

  constructor(private readonly rendezvousService: RendezvousService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({ 
    summary: 'Créer un nouveau rendez-vous',
    description: 'Créer un rendez-vous pour l\'utilisateur connecté (compte requis)'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Rendez-vous créé avec succès',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        telephone: '+22812345678',
        destination: 'France',
        niveauEtude: 'Licence',
        filiere: 'Informatique',
        date: '2024-12-25',
        time: '10:00',
        status: 'Confirmé',
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T10:00:00.000Z'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Données invalides ou créneau non disponible' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé ou pas de compte' })
  async create(
    @Body() createDto: CreateRendezvousDto,
    @Req() req: AuthenticatedRequest
  ) {
    const maskedEmail = this.maskEmail(createDto.email);
    this.logger.log(`Création rendez-vous par utilisateur: ${maskedEmail}`);
    
    const userEmail = req.user?.email;
    const isAdmin = req.user?.role === UserRole.ADMIN;
    
    if (!userEmail) {
      this.logger.error('Email utilisateur non trouvé dans le token');
      throw new BadRequestException('Email utilisateur non trouvé dans le token');
    }

    // VÉRIFICATION : Pour les utilisateurs non-admin, l'email doit correspondre
    if (!isAdmin) {
      const normalizedDtoEmail = createDto.email.toLowerCase().trim();
      const normalizedUserEmail = userEmail.toLowerCase().trim();
      
      if (normalizedDtoEmail !== normalizedUserEmail) {
        const maskedDtoEmail = this.maskEmail(normalizedDtoEmail);
        const maskedUserEmail = this.maskEmail(normalizedUserEmail);
        this.logger.warn(`Tentative de création avec email différent: ${maskedDtoEmail} vs ${maskedUserEmail}`);
        throw new ForbiddenException('Vous ne pouvez créer un rendez-vous que pour votre propre compte');
      }
    }

    try {
      const result = await this.rendezvousService.create(createDto, userEmail, isAdmin);
      
      // Convertir le résultat en objet simple pour le masquage
      const resultObject = result && typeof result === 'object' ? 
        (result as any).toObject ? (result as any).toObject() : 
        { ...result } : 
        {};
      
      const maskedResult = this.maskSensitiveData(resultObject);
      this.logger.log(`Rendez-vous créé avec succès: ${JSON.stringify(maskedResult)}`);
      return result;
    } catch (error) {
      const maskedData = this.maskSensitiveData(createDto);
      this.logger.error(`Erreur création rendez-vous: ${error.message}, Données: ${JSON.stringify(maskedData)}`);
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Lister tous les rendez-vous (admin)',
    description: 'Récupérer tous les rendez-vous avec pagination et filtres (admin uniquement)'
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    type: Number, 
    description: 'Numéro de page (défaut: 1)',
    example: 1 
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: 'Limite par page (défaut: 10, max: 100)',
    example: 10 
  })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    type: String, 
    description: `Filtrer par statut: ${Object.values(RENDEZVOUS_STATUS).join(', ')}`,
    example: 'En attente'
  })
  @ApiQuery({ 
    name: 'date', 
    required: false, 
    type: String, 
    description: 'Filtrer par date (format: YYYY-MM-DD)',
    example: '2024-12-25'
  })
  @ApiQuery({ 
    name: 'search', 
    required: false, 
    type: String, 
    description: 'Recherche textuelle (nom, prénom, email, destination)',
    example: 'Dupont'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Liste des rendez-vous',
    schema: {
      example: {
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            firstName: 'Jean',
            lastName: 'Dupont',
            email: 'jean.dupont@example.com',
            telephone: '+22812345678',
            destination: 'France',
            niveauEtude: 'Licence',
            filiere: 'Informatique',
            date: '2024-12-25',
            time: '10:00',
            status: 'En attente',
            createdAt: '2024-01-01T10:00:00.000Z'
          }
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé (admin uniquement)' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('search') search?: string,
  ) {
    if (req.user?.role !== UserRole.ADMIN) {
      this.logger.warn('Tentative d\'accès admin non autorisé');
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }
    
    // Validation des paramètres
    if (page < 1) {
      this.logger.warn(`Numéro de page invalide: ${page}`);
      throw new BadRequestException('Le numéro de page doit être supérieur à 0');
    }
    if (limit < 1 || limit > 100) {
      this.logger.warn(`Limite invalide: ${limit}`);
      throw new BadRequestException('La limite doit être entre 1 et 100');
    }
    if (status && !Object.values(RENDEZVOUS_STATUS).includes(status as any)) {
      this.logger.warn(`Statut invalide: ${status}`);
      throw new BadRequestException(`Statut invalide. Valeurs autorisées: ${Object.values(RENDEZVOUS_STATUS).join(', ')}`);
    }

    const maskedSearch = search ? this.maskEmail(search) : search;
    this.logger.log(`Liste rendez-vous admin - Page: ${page}, Limite: ${limit}, Statut: ${status}, Date: ${date}, Recherche: ${maskedSearch}`);
    
    return this.rendezvousService.findAll(page, limit, status, date, search);
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Lister les rendez-vous de l\'utilisateur connecté',
    description: 'Récupérer les rendez-vous de l\'utilisateur connecté par son email (compte requis)'
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    type: Number, 
    description: 'Numéro de page (défaut: 1)',
    example: 1 
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: 'Limite par page (défaut: 10, max: 100)',
    example: 10 
  })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    type: String, 
    description: `Filtrer par statut: ${Object.values(RENDEZVOUS_STATUS).join(', ')}`,
    example: 'Confirmé'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Liste des rendez-vous de l\'utilisateur',
    schema: {
      example: {
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            firstName: 'Jean',
            lastName: 'Dupont',
            email: 'jean.dupont@example.com',
            telephone: '+22812345678',
            destination: 'France',
            niveauEtude: 'Licence',
            filiere: 'Informatique',
            date: '2024-12-25',
            time: '10:00',
            status: 'Confirmé',
            createdAt: '2024-01-01T10:00:00.000Z'
          }
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Pas de compte pour cet email' })
  async findByUser(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
  ) {
    // Récupérer l'email de l'utilisateur depuis le token JWT
    const userEmail = req.user?.email;
    const maskedUserEmail = this.maskEmail(userEmail || '');
    
    this.logger.log(`Recherche rendez-vous pour utilisateur: ${maskedUserEmail}`);
    
    if (!userEmail) {
      this.logger.error('Email utilisateur non trouvé dans le token');
      throw new BadRequestException('Email utilisateur non trouvé dans le token');
    }
  
    // Validation des paramètres
    if (page < 1) {
      this.logger.warn(`Page invalide: ${page} pour utilisateur: ${maskedUserEmail}`);
      throw new BadRequestException('Page invalide');
    }
    if (limit < 1 || limit > 100) {
      this.logger.warn(`Limite invalide: ${limit} pour utilisateur: ${maskedUserEmail}`);
      throw new BadRequestException('Limite invalide');
    }
    
    if (status && !Object.values(RENDEZVOUS_STATUS).includes(status as any)) {
      this.logger.warn(`Statut invalide: ${status} pour utilisateur: ${maskedUserEmail}`);
      throw new BadRequestException(`Statut invalide. Valeurs autorisées: ${Object.values(RENDEZVOUS_STATUS).join(', ')}`);
    }

    return this.rendezvousService.findByEmail(userEmail, page, limit, status);
  }

  @Get('available-slots')
  @ApiOperation({ 
    summary: 'Obtenir les créneaux disponibles',
    description: 'Récupérer les créneaux horaires disponibles pour une date spécifique'
  })
  @ApiQuery({ 
    name: 'date', 
    required: true, 
    type: String, 
    description: 'Date pour laquelle vérifier les créneaux (format: YYYY-MM-DD)',
    example: '2024-12-25'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Liste des créneaux disponibles',
    schema: {
      example: ['09:00', '09:30', '10:00', '14:00']
    }
  })
  @ApiResponse({ status: 400, description: 'Date requise ou invalide' })
  async getAvailableSlots(@Query('date') date: string) {
    if (!date) {
      this.logger.warn('Date non fournie pour la recherche de créneaux');
      throw new BadRequestException('La date est requise pour cette requête');
    }

    // Validation du format de date
    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
    if (!dateRegex.test(date)) {
      this.logger.warn(`Format de date invalide: ${date}`);
      throw new BadRequestException('Format de date invalide (YYYY-MM-DD requis)');
    }

    this.logger.log(`Recherche créneaux disponibles pour la date: ${date}`);
    return this.rendezvousService.getAvailableSlots(date);
  }

  @Get('available-dates')
  @CacheKey('available-dates')
  @CacheTTL(300) // 5 minutes
  @ApiOperation({ 
    summary: 'Obtenir les dates disponibles',
    description: 'Récupérer les dates avec des créneaux disponibles pour les 60 prochains jours'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Liste des dates disponibles',
    schema: {
      example: ['2024-12-25', '2024-12-26', '2024-12-27']
    }
  })
  async getAvailableDates() {
    this.logger.log('Recherche dates disponibles');
    return this.rendezvousService.getAvailableDates();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Récupérer un rendez-vous par ID',
    description: 'Obtenir les détails d\'un rendez-vous spécifique par son ID (compte requis)'
  })
  @ApiParam({
    name: 'id',
    description: 'ID du rendez-vous',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'Détails du rendez-vous'
  })
  @ApiResponse({ status: 400, description: 'ID invalide' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé ou pas de compte' })
  @ApiResponse({ status: 404, description: 'Rendez-vous non trouvé' })
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (!id || id.trim() === '') {
      this.logger.warn('ID de rendez-vous non fourni');
      throw new BadRequestException('ID du rendez-vous requis');
    }

    if (id === 'stats') {
      this.logger.warn('ID de rendez-vous invalide: stats');
      throw new BadRequestException('Invalid rendezvous ID');
    }

    const userEmail = req.user?.email;
    const isAdmin = req.user?.role === UserRole.ADMIN;
    const maskedId = id.length > 8 ? id.substring(0, 4) + '***' + id.slice(-4) : '***';
    const maskedUserEmail = this.maskEmail(userEmail || '');
    
    if (!isAdmin && !userEmail) {
      this.logger.error('Email utilisateur non trouvé dans le token');
      throw new BadRequestException('Email utilisateur non trouvé dans le token');
    }

    this.logger.log(`Recherche rendez-vous par ID: ${maskedId} pour utilisateur: ${maskedUserEmail}`);

    const rendezvous = await this.rendezvousService.findOne(id, userEmail, isAdmin);
    
    if (!rendezvous) {
      this.logger.warn(`Rendez-vous non trouvé avec ID: ${maskedId}`);
      throw new NotFoundException(`Rendez-vous avec l'ID ${maskedId} non trouvé`);
    }

    return rendezvous;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Mettre à jour un rendez-vous',
    description: 'Modifier les informations d\'un rendez-vous existant (compte requis). IMPORTANT : Un rendez-vous ne peut être marqué comme "Terminé" que si sa date/heure est passée ou aujourd\'hui.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID du rendez-vous', 
    example: '507f1f77bcf86cd799439011' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Rendez-vous mis à jour',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        telephone: '+22812345678',
        destination: 'Canada',
        niveauEtude: 'Licence',
        filiere: 'Informatique',
        date: '2024-12-26',
        time: '11:00',
        status: 'Confirmé',
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-02T10:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Données invalides, créneau non disponible, ou tentative de marquer un rendez-vous futur comme terminé'
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé à modifier ce rendez-vous ou pas de compte' })
  @ApiResponse({ status: 404, description: 'Rendez-vous non trouvé' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRendezvousDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!id || id.trim() === '') {
      this.logger.warn('ID de rendez-vous non fourni pour la mise à jour');
      throw new BadRequestException('ID du rendez-vous requis');
    }

    const userEmail = req.user?.email;
    const isAdmin = req.user?.role === UserRole.ADMIN;
    const maskedId = id.length > 8 ? id.substring(0, 4) + '***' + id.slice(-4) : '***';
    const maskedUserEmail = this.maskEmail(userEmail || '');
    const maskedUpdateData = this.maskSensitiveData(updateDto);
    
    if (!isAdmin && !userEmail) {
      this.logger.error('Email utilisateur non trouvé dans le token');
      throw new BadRequestException('Email utilisateur non trouvé dans le token');
    }

    // Validation supplémentaire pour le statut "Terminé" dans updateDto
    if (updateDto.status === RENDEZVOUS_STATUS.COMPLETED) {
      // Vérifier que l'avis admin est fourni si statut "Terminé"
      if (!isAdmin) {
        this.logger.warn(`Tentative non autorisée de marquer comme terminé par utilisateur: ${maskedUserEmail}`);
        throw new ForbiddenException('Seuls les administrateurs peuvent marquer un rendez-vous comme terminé');
      }
    }

    this.logger.log(`Modification rendez-vous ID: ${maskedId} par utilisateur: ${maskedUserEmail}, Données: ${JSON.stringify(maskedUpdateData)}`);
    
    return this.rendezvousService.update(id, updateDto, userEmail, isAdmin);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Mettre à jour le statut d\'un rendez-vous (admin)',
    description: 'Changer le statut d\'un rendez-vous (admin uniquement). IMPORTANT : Un rendez-vous ne peut être marqué comme "Terminé" que si sa date/heure est passée ou aujourd\'hui.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID du rendez-vous', 
    example: '507f1f77bcf86cd799439011' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Statut mis à jour',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        status: 'Terminé',
        avisAdmin: 'Favorable',
        updatedAt: '2024-01-02T10:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Statut invalide, avis admin manquant pour "Terminé", ou tentative de marquer un rendez-vous futur comme terminé'
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé (admin uniquement)' })
  @ApiResponse({ status: 404, description: 'Rendez-vous non trouvé' })
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('avisAdmin') avisAdmin?: string,
  ) {
    if (!id || id.trim() === '') {
      this.logger.warn('ID de rendez-vous non fourni pour le changement de statut');
      throw new BadRequestException('ID du rendez-vous requis');
    }

    if (!status || status.trim() === '') {
      this.logger.warn('Statut non fourni pour le changement de statut');
      throw new BadRequestException('Le statut est requis');
    }

    if (!Object.values(RENDEZVOUS_STATUS).includes(status as any)) {
      this.logger.warn(`Statut invalide: ${status}`);
      throw new BadRequestException(`Statut invalide. Valeurs autorisées: ${Object.values(RENDEZVOUS_STATUS).join(', ')}`);
    }

    // Validation supplémentaire pour le statut "Terminé"
    if (status === RENDEZVOUS_STATUS.COMPLETED) {
      // L'avis admin est obligatoire pour "Terminé"
      if (!avisAdmin || avisAdmin.trim() === '') {
        this.logger.warn('Avis admin manquant pour le statut "Terminé"');
        throw new BadRequestException('L\'avis admin est obligatoire pour marquer un rendez-vous comme terminé');
      }
      
      // Vérifier que l'avis admin est valide
      if (!Object.values(ADMIN_OPINION).includes(avisAdmin as any)) {
        this.logger.warn(`Avis admin invalide: ${avisAdmin}`);
        throw new BadRequestException(`Avis admin invalide. Valeurs autorisées: ${Object.values(ADMIN_OPINION).join(', ')}`);
      }
    }

    const userEmail = req.user?.email;
    const maskedId = id.length > 8 ? id.substring(0, 4) + '***' + id.slice(-4) : '***';
    const maskedUserEmail = this.maskEmail(userEmail || '');
    const maskedAvis = avisAdmin ? '***' : 'non fourni';
    
    this.logger.log(`Changement statut rendez-vous ID: ${maskedId} par admin: ${maskedUserEmail}, Statut: ${status}, Avis: ${maskedAvis}`);
    
    return this.rendezvousService.updateStatus(id, status, avisAdmin, userEmail);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Annuler un rendez-vous',
    description: 'Annuler un rendez-vous (soft delete - changement de statut en "Annulé") (compte requis)'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID du rendez-vous', 
    example: '507f1f77bcf86cd799439011' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Rendez-vous annulé',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        status: 'Annulé',
        cancelledAt: '2024-01-02T10:00:00.000Z',
        cancelledBy: 'user',
        cancellationReason: 'Annulé par l\'utilisateur',
        updatedAt: '2024-01-02T10:00:00.000Z'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Impossible d\'annuler à moins de 2h' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé à annuler ce rendez-vous ou pas de compte' })
  @ApiResponse({ status: 404, description: 'Rendez-vous non trouvé' })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (!id || id.trim() === '') {
      this.logger.warn('ID de rendez-vous non fourni pour l\'annulation');
      throw new BadRequestException('ID du rendez-vous requis');
    }

    const userEmail = req.user?.email;
    const isAdmin = req.user?.role === UserRole.ADMIN;
    const maskedId = id.length > 8 ? id.substring(0, 4) + '***' + id.slice(-4) : '***';
    const maskedUserEmail = this.maskEmail(userEmail || '');
    
    if (!isAdmin && !userEmail) {
      this.logger.error('Email utilisateur non trouvé dans le token pour l\'annulation');
      throw new BadRequestException('Email utilisateur non trouvé dans le token');
    }

    this.logger.log(`Suppression rendez-vous ID: ${maskedId} par ${isAdmin ? 'admin' : 'utilisateur'}: ${maskedUserEmail}`);
    
    return this.rendezvousService.removeWithPolicy(id, userEmail, isAdmin);
  }

  @Put(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Confirmer un rendez-vous',
    description: 'Confirmer un rendez-vous en attente (admin uniquement)'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID du rendez-vous', 
    example: '507f1f77bcf86cd799439011' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Rendez-vous confirmé',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        status: 'Confirmé',
        updatedAt: '2024-01-02T10:00:00.000Z'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Rendez-vous non en attente ou déjà passé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Non autorisé à confirmer ce rendez-vous' })
  @ApiResponse({ status: 404, description: 'Rendez-vous non trouvé' })
  async confirmRendezvous(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (!id || id.trim() === '') {
      this.logger.warn('ID de rendez-vous non fourni pour la confirmation');
      throw new BadRequestException('ID du rendez-vous requis');
    }

    const userEmail = req.user?.email;
    const maskedId = id.length > 8 ? id.substring(0, 4) + '***' + id.slice(-4) : '***';
    const maskedUserEmail = this.maskEmail(userEmail || '');
    
    this.logger.log(`Confirmation rendez-vous ID: ${maskedId} par admin: ${maskedUserEmail}`);
    
    return this.rendezvousService.confirmByUser(id, userEmail, true);
  }


  @Get('stats/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques des rendez-vous (admin)' })
  async getRendezvousStats() {
    return this.rendezvousService.getStats();
  }

  @Get(':id/check-availability')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Vérifier la disponibilité en temps réel',
    description: 'Vérifier si un créneau est disponible pour modification'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID du rendez-vous', 
    example: '507f1f77bcf86cd799439011' 
  })
  @ApiQuery({ 
    name: 'date', 
    required: false, 
    type: String, 
    description: 'Nouvelle date (format: YYYY-MM-DD)',
    example: '2024-12-26'
  })
  @ApiQuery({ 
    name: 'time', 
    required: false, 
    type: String, 
    description: 'Nouvelle heure (format: HH:MM)',
    example: '11:00'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Disponibilité vérifiée',
    schema: {
      example: {
        available: true,
        message: 'Créneau disponible'
      }
    }
  })
  async checkAvailability(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Query('date') date?: string,
    @Query('time') time?: string,
  ) {
    if (!id) {
      this.logger.warn('ID de rendez-vous non fourni pour la vérification de disponibilité');
      throw new BadRequestException('ID du rendez-vous requis');
    }

    if (!date && !time) {
      this.logger.warn('Date et heure non fournies pour la vérification de disponibilité');
      throw new BadRequestException('Date ou heure requise pour la vérification');
    }

    const rdv = await this.rendezvousService.findOne(id, req.user?.email, req.user?.role === UserRole.ADMIN);
    if (!rdv) {
      const maskedId = id.length > 8 ? id.substring(0, 4) + '***' + id.slice(-4) : '***';
      this.logger.warn(`Rendez-vous non trouvé pour vérification de disponibilité: ${maskedId}`);
      throw new NotFoundException('Rendez-vous non trouvé');
    }

    const checkDate = date || rdv.date;
    const checkTime = time || rdv.time;
    const maskedId = id.length > 8 ? id.substring(0, 4) + '***' + id.slice(-4) : '***';

    this.logger.log(`Vérification disponibilité pour rendez-vous ID: ${maskedId}, Date: ${checkDate}, Heure: ${checkTime}`);

    const isAvailable = await this.rendezvousService.checkRealTimeAvailability(checkDate, checkTime, id);

    return {
      available: isAvailable,
      message: isAvailable ? 'Créneau disponible' : 'Créneau déjà pris'
    };
  }
}