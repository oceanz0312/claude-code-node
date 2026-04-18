import path from "node:path";
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
        "E2E requires E2E_API_KEY env var for api-key cases.",
      );
    }

    return { apiKey: secrets.apiKey };
  }

  if (!secrets.authToken || !secrets.baseUrl) {
    throw new Error(
      "E2E requires both E2E_AUTH_TOKEN and E2E_BASE_URL env vars for auth-token cases.",
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
  const secrets = loadSecretsFromEnv();

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

function loadSecretsFromEnv(): E2ESecrets {
  const authToken = getOptionalString(process.env.E2E_AUTH_TOKEN);
  const baseUrl = getOptionalString(process.env.E2E_BASE_URL);
  const apiKey = getOptionalString(process.env.E2E_API_KEY);
  const model = getOptionalString(process.env.E2E_MODEL);

  if (!authToken && !apiKey) {
    throw new Error(
      "No E2E_AUTH_TOKEN or E2E_API_KEY env var found. "
      + "Copy .env.example to .env, fill in values, and run: source .env",
    );
  }

  return { model, apiKey, authToken, baseUrl };
}

function getOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}
