import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, headers } = request;


    function mask(value?: string, visible = 2): string {
      if (!value) return "anonymous";
      if (value.length <= visible * 2) return "***";
      return (
        value.slice(0, visible) +
        "***" +
        value.slice(-visible)
      );
    }


    const maskedUserId = mask(user?.userId);
    const maskedAuth = mask(headers?.authorization, 4);

    this.logger.log(
      `Request: ${method} ${url} by ${maskedUserId}`,
    );

    if (headers?.authorization) {
      this.logger.debug(`Auth: ${maskedAuth}`);
    }

    return next.handle().pipe(
      tap(() => {
        if (["POST", "PUT", "DELETE"].includes(method)) {
          this.logger.warn(
            `Critical action: ${method} ${url} by ${maskedUserId}`,
          );
        }
      }),
    );
  }
}
