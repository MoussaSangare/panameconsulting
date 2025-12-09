// auth.constants.ts - Version corrigée
export const AuthConstants = {
  // JWT Configuration
  MAX_SESSION_DURATION_MS: 30 * 60 * 1000, // 30 minutes maximum
  JWT_EXPIRATION: '15m', // Access token: 15 minutes
  REFRESH_TOKEN_EXPIRATION: '10m', // Refresh token: 10 minutes

  // Durées pour calculs (en secondes)
  ACCESS_TOKEN_EXPIRATION_SECONDS: 15 * 60, // 15 minutes = 900 secondes
  REFRESH_TOKEN_EXPIRATION_SECONDS: 10 * 60, // 10 minutes = 600 secondes

  SESSION_EXPIRATION_SECONDS: 30 * 60, // 30 minutes
  SESSION_EXPIRATION_MS: 30 * 60 * 1000,

  // Token Configuration
  RESET_TOKEN_EXPIRATION_MS: 3600000, // 1 heure

  // Security Configuration
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_ATTEMPTS_TTL_MINUTES: 30,
  MIN_PASSWORD_LENGTH: 8,
  BCRYPT_SALT_ROUNDS: 12,

  // Cleanup Intervals
  TOKEN_BLACKLIST_CLEANUP_INTERVAL: 3600000, // 1 heure
  SESSION_CLEANUP_INTERVAL: 1800000, // 30 minutes

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,

  // ✅ NOUVELLES CONSTANTES AJOUTÉES
  // Durées standardisées
  GLOBAL_LOGOUT_DURATION: "24h", // Durée de déconnexion globale
  
  // Raisons de révocation standardisées
  REVOCATION_REASONS: {
    USER_LOGOUT: "user logout",
    ADMIN_GLOBAL_LOGOUT: "admin global logout 24h",
    SESSION_EXPIRED: "session expired",
    ADMIN_CLEANUP: "admin cleanup",
    ADMIN_REVOKE_ALL: "admin revoke all",
    MANUAL_REVOKE: "manual revoke",
    REVOKE_ALL: "revoke all"
  } as const,

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
  
  // Format de date standard
  DATE_FORMAT: "YYYY-MM-DDTHH:mm:ss.SSSZ",
  
  // Configuration des cookies
  COOKIE_OPTIONS: {
    PRODUCTION: {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      domain: '.panameconsulting.com',
      path: '/',
    },
    DEVELOPMENT: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      path: '/',
    }
  }
} as const;