import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import path from "path";

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private configService: ConfigService) {}

  getFileUrl(filename: string): string {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.logger.log(`[${requestId}] Génération d'URL pour le fichier: ${this.maskFilename(filename)}`);

      const baseUrl = this.configService.get("BASE_URL");

      // Validation critique
      if (!baseUrl) {
        this.logger.error(`[${requestId}] BASE_URL non définie dans les variables d'environnement`);
        throw new Error("BASE_URL is not defined in environment variables");
      }

      // Nettoyage de l'URL
      const cleanedBaseUrl = baseUrl.endsWith("/")
        ? baseUrl.slice(0, -1)
        : baseUrl;

      const fileUrl = `${cleanedBaseUrl}/uploads/${filename}`;
      
      this.logger.log(`[${requestId}] URL générée avec succès (domaine: ${this.maskDomain(cleanedBaseUrl)})`);
      
      return fileUrl;
    } catch (error) {
      this.logger.error(`[${requestId}] Erreur lors de la génération de l'URL: ${error.message}`);
      throw error;
    }
  }

  private maskFilename(filename: string): string {
    if (!filename) return 'fichier_inconnu';
    
    const ext = path.extname(filename);
    const nameWithoutExt = filename.replace(ext, '');
    
    if (nameWithoutExt.length <= 2) {
      return nameWithoutExt + '***' + ext;
    }
    
    const maskedName = nameWithoutExt.charAt(0) + 
                      '***' + 
                      nameWithoutExt.charAt(nameWithoutExt.length - 1);
    
    return maskedName + ext;
  }

  private maskDomain(url: string): string {
    if (!url) return 'url_inconnue';
    
    try {
      const domain = new URL(url).hostname;
      const parts = domain.split('.');
      
      if (parts.length >= 2) {
        // Masque le sous-domaine s'il existe
        if (parts.length > 2) {
          parts[0] = '***';
        }
        return parts.join('.');
      }
      
      return domain;
    } catch {
      // Si l'URL n'est pas valide, retourne une version masquée
      return url.length <= 10 ? url : url.substring(0, 5) + '***' + url.substring(url.length - 5);
    }
  }
}