// secure-logging.middleware.ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class SecureLoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const originalSend = res.send;
    const startTime = Date.now();

    // Intercepter la réponse pour logger
    res.send = function (body) {
      const duration = Date.now() - startTime;

      // ✅ LOGS SÉCURISÉS
      console.log("🌐 API Request:", {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get("User-Agent")?.substring(0, 50), // Limité
      });

      return originalSend.call(this, body);
    };

    next();
  }
}
