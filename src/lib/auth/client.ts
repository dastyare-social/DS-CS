import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "@better-auth/api-key/client"

export const client = createAuthClient({
  plugins: [apiKeyClient()],
});

export const { signUp, signIn, signOut, useSession } = client;