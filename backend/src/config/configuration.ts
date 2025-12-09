import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  mongoUri: process.env.MONGODB_URI,
  port: process.env.PORT,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  adminEmail: process.env.EMAIL_USER,
  uploadDir: process.env.UPLOAD_DIR,
  loadDir: process.env.LOAD_DIR,
}));
