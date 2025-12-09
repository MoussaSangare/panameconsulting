import {
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { multerConfig } from "./multer.config";
import { UploadService } from "./upload.service";
import path from "path";

@Controller("/upload")
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor("image", multerConfig))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.logger.log(`[${requestId}] Début de l'upload - Taille: ${file?.size || 0} bytes`);

      // Validation renforcée
      if (!file) {
        this.logger.warn(`[${requestId}] Aucun fichier reçu`);
        throw new HttpException(
          "Aucun fichier téléchargé ou format invalide",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Log sécurisé des informations du fichier
      this.logger.log(
        `[${requestId}] Upload réussi - Nom original: ${this.maskFilename(file.originalname)}, Nouveau nom: ${this.maskFilename(file.filename)}, Type: ${file.mimetype}, Taille: ${file.size} bytes`,
      );

      return {
        success: true,
        url: this.uploadService.getFileUrl(file.filename),
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      // Journalisation détaillée et sécurisée
      this.logger.error(
        `[${requestId}] Échec de l'upload - Erreur: ${error.message}`,
        this.cleanErrorStack(error.stack)
      );

      throw new HttpException(
        error.message || "Erreur lors du traitement du fichier",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private maskFilename(filename: string): string {
    if (!filename) return 'fichier_inconnu';
    
    const ext = path.extname(filename);
    const nameWithoutExt = filename.replace(ext, '');
    
    // Garde seulement les premiers et derniers caractères du nom
    if (nameWithoutExt.length <= 2) {
      return nameWithoutExt + '***' + ext;
    }
    
    const maskedName = nameWithoutExt.charAt(0) + 
                      '***' + 
                      nameWithoutExt.charAt(nameWithoutExt.length - 1);
    
    return maskedName + ext;
  }

  private cleanErrorStack(stack: string): string {
    if (!stack) return 'stack_trace_non_disponible';
    
    // Nettoie les chemins absolus qui pourraient révéler la structure du serveur
    return stack
      .split('\n')
      .slice(0, 3) // Garde seulement les 3 premières lignes
      .map(line => line.replace(/\(.*[\\/]([^\\/]+)\)/, '($1)')) // Correction ici
      .join('\n');
  }
}