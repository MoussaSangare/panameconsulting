import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { ProcedureService } from './procedure.service';
import { CreateProcedureDto, CancelProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import { UserRole } from '../schemas/user.schema';
import { Request } from 'express';

// ✅ Interface pour l'utilisateur authentifié
interface AuthenticatedUser {
  email: string;
  role: UserRole;
  id?: string;
  [key: string]: unknown;
}

// ✅ Interface pour la requête avec utilisateur authentifié
interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@ApiTags('procedures')
@Controller('procedures')
@UseGuards(JwtAuthGuard)
export class ProcedureController {
  private readonly logger = new Logger(ProcedureController.name);

  constructor(private readonly procedureService: ProcedureService) {}

  // ==================== ADMIN ONLY ====================

  @Post('admin/create')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Créer une procédure depuis un rendez-vous éligible',
  })
  async createFromRendezvous(@Body() createDto: CreateProcedureDto) {
    this.logger.log(
      `Création procédure depuis rendez-vous ID: ${this.maskId(createDto.rendezVousId)}`,
    );
    return this.procedureService.createFromRendezvous(createDto);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Lister toutes les procédures non supprimées (Admin)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllProcedures(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    if (page < 1) throw new BadRequestException('Le numéro de page doit être supérieur à 0');
    if (limit < 1 || limit > 100)
      throw new BadRequestException('La limite doit être entre 1 et 100');

    this.logger.log(`Liste procédures admin - Page: ${page}, Limit: ${limit}`);
    return this.procedureService.getActiveProcedures(page, limit);
  }

  @Put('admin/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Rejeter une procédure (Admin)' })
  async rejectProcedure(@Param('id') id: string, @Body('reason') reason: string) {
    this.logger.log(`Rejet procédure - ID: ${this.maskId(id)}`);
    return this.procedureService.rejectProcedure(id, reason);
  }

  @Put('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier une procédure (Admin)' })
  async updateProcedure(@Param('id') id: string, @Body() updateDto: UpdateProcedureDto) {
    this.logger.log(`Modification procédure - ID: ${this.maskId(id)}`);
    return this.procedureService.updateProcedure(id, updateDto);
  }

  @Put('admin/:id/steps/:stepName')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier une étape de procédure (Admin)' })
  async updateProcedureStep(
    @Param('id') id: string,
    @Param('stepName') stepName: string,
    @Body() updateDto: UpdateStepDto,
  ) {
    this.logger.log(`Modification étape - Procédure: ${this.maskId(id)}, Étape: ${stepName}`);
    return this.procedureService.updateStep(id, stepName, updateDto);
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer une procédure (Soft Delete)' })
  async deleteProcedure(@Param('id') id: string, @Body('reason') reason?: string) {
    this.logger.log(`Suppression procédure - ID: ${this.maskId(id)}`);
    return this.procedureService.softDelete(id, reason);
  }

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques générales des procédures' })
  async getProceduresOverview() {
    this.logger.log('Récupération statistiques procédures');
    return this.procedureService.getProceduresOverview();
  }

  // ==================== USER & ADMIN ====================

  @Get('user')
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mes procédures' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyProcedures(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    if (!req.user?.email) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const maskedEmail = this.maskEmail(req.user.email);
    this.logger.log(
      `Liste procédures utilisateur - Page: ${page}, Limit: ${limit}, User: ${maskedEmail}`,
    );

    return this.procedureService.getUserProcedures(req.user.email, page, limit);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: "Détails d'une procédure" })
  async getProcedureDetails(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    this.logger.log(`Détails procédure - ID: ${this.maskId(id)}`);
    return this.procedureService.getProcedureDetails(id, req.user);
  }

  @Put(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Annuler ma procédure' })
  async cancelMyProcedure(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() cancelDto: CancelProcedureDto,
  ) {
    this.logger.log(`Annulation procédure - ID: ${this.maskId(id)}`);
    return this.procedureService.cancelProcedure(id, req.user.email, cancelDto.reason);
  }

  // ==================== UTILITY METHODS ====================

  private maskEmail(email: string): string {
    if (!email) return '***';
    const [name, domain] = email.split('@');
    if (!name || !domain) return '***';

    const maskedName =
      name.length > 2
        ? name.substring(0, 2) + '*'.repeat(Math.max(name.length - 2, 1))
        : '*'.repeat(name.length);

    return `${maskedName}@${domain}`;
  }

  private maskId(id: string): string {
    if (!id || id.length < 8) return '***';
    return id.substring(0, 4) + '***' + id.substring(id.length - 4);
  }
}
