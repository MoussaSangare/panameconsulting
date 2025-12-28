import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  mongoUri: process.env.MONGODB_URI || process.env.MONGODB_URI,
  port: process.env.PORT || process.env.PORT,
  jwtSecret: process.env.JWT_SECRET || process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN,
  adminEmail: process.env.EMAIL_USER || process.env.EMAIL_USER,
  uploadDir: process.env.UPLOAD_DIR || process.env.UPLOAD_DIR,
  loadDir: process.env.LOAD_DIR || process.env.LOAD_DIR,
  emailUser: process.env.EMAIL_USER || process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS || process.env.EMAIL_PASS,
  emailHost: process.env.EMAIL_HOST || process.env.EMAIL_HOST,
  emailPort: process.env.EMAIL_PORT || process.env.EMAIL_PORT,
  emailSecure: process.env.EMAIL_SECURE || process.env.EMAIL_SECURE,
}));
