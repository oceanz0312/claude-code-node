import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ClaudeCodeOptions, SessionOptions } from "../../src/index.ts";

export type AuthMode = "api-key" | "auth-token";

export type E2ESecrets = {
  model?: string;
  apiKey?: string;
  authToken?: string;
  baseUrl?: string;
};

export type E2EConfig = {
  repoRoot: string;
  artifactRoot: string;
  secrets: E2ESecrets;
  model: string;
  defaultSessionOptions: SessionOptions;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const artifactRoot = path.resolve(import.meta.dirname, "artifacts");
const secretsPath = path.resolve(repoRoot, ".env.ts");

let cachedConfig: Promise<E2EConfig> | null = null;

export async function loadE2EConfig(): Promise<E2EConfig> {
  if (!cachedConfig) {
    cachedConfig = loadConfigInternal();
  }

  return cachedConfig;
}

export function getClientOptions(
  secrets: E2ESecrets,
  authMode: AuthMode,
): ClaudeCodeOptions {
  if (authMode === "api-key") {
    if (!secrets.apiKey) {
      throw new Error(
        `tests/e2e requires secrets.apiKey in ${secretsPath} for api-key cases.`,
      );
    }

    return { apiKey: secrets.apiKey };
  }

  if (!secrets.authToken || !secrets.baseUrl) {
    throw new Error(
      `tests/e2e requires both secrets.authToken and secrets.baseUrl in ${secretsPath} for auth-token cases.`,
    );
  }

  return {
    authToken: secrets.authToken,
    baseUrl: secrets.baseUrl,
  };
}

export async function listAvailableAuthModes(): Promise<AuthMode[]> {
  const config = await loadE2EConfig();
  const modes: AuthMode[] = [];

  if (config.secrets.apiKey) {
    modes.push("api-key");
  }

  if (config.secrets.authToken && config.secrets.baseUrl) {
    modes.push("auth-token");
  }

  return modes;
}

async function loadConfigInternal(): Promise<E2EConfig> {
  const envSecrets = loadSecretsFromEnv();

  let secrets: E2ESecrets;
  if (envSecrets) {
    secrets = envSecrets;
  } else if (existsSync(secretsPath)) {
    const moduleUrl = pathToFileURL(secretsPath).href;
    const loaded = (await import(moduleUrl)) as {
      secrets?: unknown;
      default?: unknown;
    };
    const candidate = loaded.secrets ?? loaded.default;
    secrets = normalizeSecrets(candidate);
  } else {
    throw new Error(
      [
        `Missing ${secretsPath} and no E2E_AUTH_TOKEN / E2E_API_KEY env vars found.`,
        "Either set env vars or create .env.ts from .env.example.ts before running bun run test:e2e.",
      ].join(" "),
    );
  }

  return {
    repoRoot,
    artifactRoot,
    secrets,
    model: secrets.model?.trim() || "sonnet",
    defaultSessionOptions: {
      bare: true,
      settingSources: "",
      verbose: true,
      includePartialMessages: true,
      dangerouslySkipPermissions: true,
    },
  };
}

function loadSecretsFromEnv(): E2ESecrets | null {
  const authToken = getOptionalString(process.env.E2E_AUTH_TOKEN);
  const baseUrl = getOptionalString(process.env.E2E_BASE_URL);
  const apiKey = getOptionalString(process.env.E2E_API_KEY);
  const model = getOptionalString(process.env.E2E_MODEL);

  if (!authToken && !apiKey) return null;

  return { model, apiKey, authToken, baseUrl };
}

function normalizeSecrets(candidate: unknown): E2ESecrets {
  if (!candidate || typeof candidate !== "object") {
    throw new Error(
      `${secretsPath} must export an object named secrets (or default export).`,
    );
  }

  const value = candidate as Record<string, unknown>;

  return {
    model: getOptionalString(value.model),
    apiKey: getOptionalString(value.apiKey),
    authToken: getOptionalString(value.authToken),
    baseUrl: getOptionalString(value.baseUrl),
  };
}

function getOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}
