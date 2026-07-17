import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import YAML from "yaml";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const CONFIG_DIR = path.join(process.cwd(), "config");
const JSON_CONFIG_PATH = path.join(CONFIG_DIR, "app.config.json");
const YAML_CONFIG_PATH = path.join(CONFIG_DIR, "app.config.yml");

function readConfig() {
  if (!process.cwd()) {
    throw new Error("Current working directory is not available.");
  }

  if (JSON_CONFIG_PATH && JSON_CONFIG_PATH) {
    try {
      const raw = readFileSync(JSON_CONFIG_PATH, "utf8");
      return JSON.parse(raw);
    } catch {
      // fall through to YAML if the JSON file is missing or invalid
    }
  }

  try {
    const raw = readFileSync(YAML_CONFIG_PATH, "utf8");
    return YAML.parse(raw);
  } catch (error) {
    throw new Error(`Unable to read admin config from ${JSON_CONFIG_PATH} or ${YAML_CONFIG_PATH}. ${String(error)}`);
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function sanitizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "")
    .replace(/(^[._-]+|[._-]+$)/g, "") || "admin";
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in your environment before running this bootstrap.");
  }

  const config = readConfig();
  const configuredUsername = sanitizeUsername(config?.general?.username || config?.en?.name || email.split("@")[0]);
  const configuredName = config?.en?.name?.trim() || config?.general?.username?.trim() || "Admin User";
  const normalizedEmail = normalizeEmail(email);

  const existingUsers = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    username: users.username,
  }).from(users);

  if (existingUsers.length === 0) {
    const response = await auth.api.signUpEmail({
      body: {
        name: configuredName,
        email: normalizedEmail,
        password,
        username: configuredUsername,
      },
    });

    console.log(`Created admin user ${response.user.email} with username ${response.user.username || configuredUsername}.`);
    return;
  }

  const matchingUser = existingUsers.find((user) => normalizeEmail(user.email) === normalizedEmail);

  if (!matchingUser) {
    const existingSummary = existingUsers.map((user) => user.email).join(", ");
    throw new Error(
      `An admin bootstrap user already exists with a different email. Expected ${normalizedEmail}, found: ${existingSummary || "none"}.`
    );
  }

  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(password);

  const credentialAccounts = (await ctx.internalAdapter.findAccounts(matchingUser.id)).filter(
    (account) => account.providerId === "credential"
  );

  if (credentialAccounts.length > 0) {
    await ctx.internalAdapter.updateAccount(credentialAccounts[0].id, { password: passwordHash });
  } else {
    await ctx.internalAdapter.linkAccount({
      userId: matchingUser.id,
      providerId: "credential",
      accountId: matchingUser.id,
      password: passwordHash,
    });
  }

  const updateFields: Record<string, string> = {};
  if (matchingUser.name !== configuredName) {
    updateFields.name = configuredName;
  }

  if ((matchingUser.username || "") !== configuredUsername) {
    updateFields.username = configuredUsername;
  }

  if (Object.keys(updateFields).length > 0) {
    await ctx.internalAdapter.updateUser(matchingUser.id, updateFields);
  }

  console.log(`Updated admin user ${matchingUser.email} and refreshed the password and profile details.`);
}

main()
  .catch((error) => {
    console.error("[bootstrap-admin] Error:", error);
    process.exit(1);
  });
