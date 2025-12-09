import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

@Injectable()
export class StorageService {
  private readonly uploadDir = path.join(process.cwd(), "uploads");

  async uploadFile(
    file: Express.Multer.File,
    customName?: string,
  ): Promise<string> {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    const filename = customName || `${Date.now()}-${file.originalname}`;
    const filePath = path.join(this.uploadDir, filename);

    await writeFile(filePath, file.buffer);
    return filename; // Retourne seulement le nom du fichier
  }

  async deleteFile(filename: string): Promise<void> {
    // Supprime le préfixe 'uploads/' s'il existe
    const cleanFilename = filename.replace(/^uploads\//, "");
    const filePath = path.join(this.uploadDir, cleanFilename);

    if (fs.existsSync(filePath)) {
      await unlink(filePath);
    }
  }
}
