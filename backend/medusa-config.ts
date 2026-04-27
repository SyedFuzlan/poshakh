import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Fail fast on missing required env vars
import './src/config/env'

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET!,
      cookieSecret: process.env.COOKIE_SECRET!,
    },
    // Override express-loader's production defaults (secure:true, sameSite:"none")
    // which drop session cookies over plain HTTP in Docker local dev.
    cookieOptions: {
      sameSite: "lax" as const,
      secure: false,
    },
  }
})
