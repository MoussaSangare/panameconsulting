export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  maxSessions: number;
  loginAttempts: number;
  blockDurationMinutes: number;
  passwordResetExpiry: number;
}

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const authConfig: AuthConfig = {
  jwtSecret: getEnv("JWT_SECRET"),
  jwtExpiresIn: getEnv("JWT_EXPIRES_IN", "1h"),
  refreshSecret: getEnv("REFRESH_SECRET"),
  refreshExpiresIn: getEnv("REFRESH_EXPIRES_IN", "7d"),
  maxSessions: parseInt(getEnv("MAX_SESSIONS", "2"), 2),
  loginAttempts: parseInt(getEnv("LOGIN_ATTEMPTS", "5"), 10),
  blockDurationMinutes: parseInt(getEnv("BLOCK_DURATION_MINUTES", "15"), 10),
  passwordResetExpiry: parseInt(getEnv("PASSWORD_RESET_EXPIRY", "60"), 10),
};
