import { registerAs } from "@nestjs/config";

export interface AppConfig {
  // Base
  nodeEnv: string;
  port: number;
  
  // Database
  mongoUri: string;
  
  // JWT
  jwtSecret: string;
  jwtExpiresIn: string;
  
  // Email Configuration
  emailHost: string;
  emailPort: number;
  emailSecure: boolean;
  emailUser: string;
  emailPass: string;
  emailFrom: string;
  
  // Application
  appName: string;
  frontendUrl: string;
  backendUrl: string;
  adminEmail: string;
  
  // File Upload
  uploadDir: string;
  loadDir: string;
  maxFileSize: number;
  
  // Security
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitWindow: number;
  
  // Email retry configuration
  emailMaxRetries: number;
  emailRetryDelay: number;
  emailConnectionTimeout: number;
}

export default registerAs("app", (): AppConfig => ({
  // Base
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.PORT),
  
  // Database
  mongoUri: process.env.MONGODB_URI,
  
  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  
  // Email Configuration
  emailHost: process.env.EMAIL_HOST,
  emailPort: parseInt(process.env.EMAIL_PORT),
  emailSecure: process.env.EMAIL_SECURE === 'false',
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,
  emailFrom: process.env.EMAIL_USER ,
  
  // Application
  appName: process.env.APP_NAME,
  frontendUrl: process.env.FRONTEND_URL,
  backendUrl: process.env.BACKEND_URL,
  adminEmail: process.env.EMAIL_USER,
  
  // File Upload
  uploadDir: process.env.UPLOAD_DIR,
  loadDir: process.env.LOAD_DIR,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE), // 10MB
  
  // Security
  corsOrigins: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : ['https://panameconsulting.com'],
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '18000000'), // 30 minutes
  
  // Email retry configuration
  emailMaxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || '3'),
  emailRetryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '10000'),
  emailConnectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT || '30000'),
}));