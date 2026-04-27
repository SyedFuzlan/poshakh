import { cleanEnv, str, url } from "envalid";

export const env = cleanEnv(process.env, {
  DATABASE_URL:            str({ desc: "PostgreSQL connection string" }),
  REDIS_URL:               url({ default: "redis://localhost:6379" }),
  JWT_SECRET:              str({ desc: "JWT signing secret — generate with: openssl rand -base64 32" }),
  COOKIE_SECRET:           str({ desc: "Cookie signing secret — generate with: openssl rand -base64 32" }),
  STORE_CORS:              str(),
  ADMIN_CORS:              str(),
  AUTH_CORS:               str(),
  MSG91_AUTH_KEY:          str({ default: "" }),
  MSG91_TEMPLATE_ID:       str({ default: "" }),
  RAZORPAY_KEY_ID:         str({ default: "" }),
  RAZORPAY_KEY_SECRET:     str({ default: "" }),
  RAZORPAY_WEBHOOK_SECRET: str({ default: "" }),
  RESEND_API_KEY:          str({ default: "" }),
  SENTRY_DSN:              str({ default: "" }),
  NODE_ENV:                str({ choices: ["development", "test", "production"], default: "development" }),
});
