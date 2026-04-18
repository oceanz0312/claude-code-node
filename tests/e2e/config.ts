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
  if (!existsSync(secretsPath)) {
    throw new Error(
      [
        `Missing ${secretsPath}.`,
        "Create it from .env.example.ts before running bun run test:e2e.",
      ].join(" "),
    );
  }

  const moduleUrl = pathToFileURL(secretsPath).href;
  const loaded = (await import(moduleUrl)) as {
    secrets?: unknown;
    default?: unknown;
  };

  const candidate = loaded.secrets ?? loaded.default;
  const secrets = normalizeSecrets(candidate);

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
