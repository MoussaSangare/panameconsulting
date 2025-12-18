// auth.constants.ts - Version simplifiée
export const AuthConstants = {
  // JWT Configuration - Valeurs exclusivement 15, 20, 30
  MAX_SESSION_DURATION_MS: 30 * 60 * 1000, // 30 minutes maximum
  JWT_EXPIRATION: '15m', // Access token: 15 minutes
  REFRESH_TOKEN_EXPIRATION: '30m', // Refresh token: 30 minutes

  // Durées pour calculs (en secondes) - Valeurs 15, 20, 30 minutes
  ACCESS_TOKEN_EXPIRATION_SECONDS: 15 * 60, // 15 minutes = 900 secondes
  REFRESH_TOKEN_EXPIRATION_SECONDS: 30 * 60, // 30 minutes = 1800 secondes
  SESSION_EXPIRATION_SECONDS: 30 * 60, // 30 minutes
  SESSION_EXPIRATION_MS: 30 * 60 * 1000,
  REVOCATION_REASONS:{
        SESSION_EXPIRED: "SESSION EXPIRED",
        MANUAL_REVOKE: "MANUAL REVOKE",
        ADMIN_CLEANUP: "ADMIN CLEANUP",
        REVOKE_ALL: "REVOKE ALL"
  },
  // Token Configuration
  RESET_TOKEN_EXPIRATION_MS: 20 * 60 * 1000, // 20 minutes

  // Security Configuration
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_ATTEMPTS_TTL_MINUTES: 30, // 30 minutes
  MIN_PASSWORD_LENGTH: 8,
  BCRYPT_SALT_ROUNDS: 12,
GLOBAL_LOGOUT_DURATION: 24 * 60 * 60 * 1000, // 24h en millisecondes

  // Cleanup Intervals - Valeurs 15, 20, 30 minutes
  TOKEN_BLACKLIST_CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 minutes
  SESSION_CLEANUP_INTERVAL: 15 * 60 * 1000, // 15 minutes

  // Rate Limiting - Valeurs 15, 20, 30 minutes
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,

  // Messages d'erreur standardisés
  ERROR_MESSAGES: {
    COMPTE_DESACTIVE: "COMPTE DESACTIVE",
    COMPTE_TEMPORAIREMENT_DECONNECTE: "COMPTE TEMPORAIREMENT DECONNECTE",
    MAINTENANCE_MODE: "MAINTENANCE MODE",
    PASSWORD_RESET_REQUIRED: "PASSWORD RESET REQUIRED"
  } as const,

  // Configuration sessions
  MAX_ACTIVE_SESSIONS_PER_USER: 5,
  SESSION_CLEANUP_BATCH_SIZE: 1000,
  
  // Configuration des cookies
  COOKIE_OPTIONS: {
    ACCESS_TOKEN: {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      maxAge: 15 * 60 * 1000, // 15 minutes
    },
    REFRESH_TOKEN: {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      maxAge: 30 * 60 * 1000, // 30 minutes
    }
  }
} as const;