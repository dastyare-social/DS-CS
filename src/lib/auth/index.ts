import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, openAPI, username } from "better-auth/plugins";
import { db } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verifications,
} from "@/lib/db/schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      users,
      accounts,
      sessions,
      verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // disableSignUp: true, // NOTE: don't use this — it throws for auth.api.signUpEmail()
    // too (i.e. scripts/bootstrap-admin.ts), not just HTTP requests, so the admin bootstrap
    // would break. Public sign-up is blocked below instead via databaseHooks.
    requireEmailVerification: false,
  },
  user: {
    changeEmail: {
      enabled: false,
    },
    deleteUser: {
      enabled: false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (_user, ctx) => {
          // ctx.request only exists when the endpoint was hit over HTTP. A direct
          // server-side call (auth.api.signUpEmail from scripts/bootstrap-admin.ts)
          // has no request object, so it passes through; anything coming through
          // the actual /api/auth/sign-up/email HTTP route gets rejected.
          if (ctx?.request) {
            throw new APIError("BAD_REQUEST", {
              message: "Signup is disabled",
            });
          }
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 10, // time window in seconds
    max: 100, // max requests in the window
  },
  session: {
    freshAge: 60 * 5, // 5 minutes (the session is fresh if created within the last 5 minutes)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds
    },
  },
  plugins: [
    openAPI({ path: "/docs", theme: "mars", nonce: "PRO" }),
    username({
      minUsernameLength: 5,
    }),
    bearer(),
  ],
});