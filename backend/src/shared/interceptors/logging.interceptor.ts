import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Logger } from "@nestjs/common";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;

    this.logger.log(
      `Request: ${method} ${url} by ${user?.userId || "anonymous"}`,
    );

    return next.handle().pipe(
      tap(() => {
        if (["POST", "PUT", "DELETE"].includes(method)) {
          this.logger.log(`Critical action performed: ${method} ${url}`);
        }
      }),
    );
  }
}
