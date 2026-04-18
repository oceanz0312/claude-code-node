import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RelayEvent } from "claude-code-parser";
import type { RawClaudeEvent } from "../../src/index.ts";

export type TimestampedRawEvent = {
  timestamp: string;
  event: RawClaudeEvent;
};

export type CaseArtifactPayload = {
  caseName: string;
  authMode: string;
  artifactDir: string;
  inputSummary: Record<string, unknown>;
  sessionOptionsSummary: Record<string, unknown>;
  rawEvents: TimestampedRawEvent[];
  relayEvents: RelayEvent[];
  finalResponse: string;
  metadata?: Record<string, unknown>;
};

const runId = createRunId();

export async function createArtifactDir(
  artifactRoot: string,
  caseName: string,
): Promise<string> {
  const dir = path.join(artifactRoot, runId, sanitizeCaseName(caseName));
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function writeCaseArtifacts(
  payload: CaseArtifactPayload,
): Promise<void> {
  await mkdir(payload.artifactDir, { recursive: true });

  const rawEventLogFiles = (await readdir(payload.artifactDir))
    .filter((name) => name.endsWith(".ndjson") && name !== "raw-events.ndjson")
    .sort();

  await writeFile(
    path.join(payload.artifactDir, "input.json"),
    `${JSON.stringify(payload.inputSummary, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    path.join(payload.artifactDir, "relay-events.json"),
    `${JSON.stringify(payload.relayEvents, null, 2)}\n`,
    "utf8",
  );

  const rawEventText = payload.rawEvents.length > 0
    ? `${payload.rawEvents.map((entry) => JSON.stringify(entry)).join("\n")}\n`
    : "";
  await writeFile(
    path.join(payload.artifactDir, "raw-events.ndjson"),
    rawEventText,
    "utf8",
  );

  await writeFile(
    path.join(payload.artifactDir, "final-response.txt"),
    payload.finalResponse,
    "utf8",
  );

  const summary = {
    caseName: payload.caseName,
    authMode: payload.authMode,
    artifactDir: payload.artifactDir,
    rawEventCount: payload.rawEvents.length,
    relayEventCount: payload.relayEvents.length,
    sessionOptionsSummary: payload.sessionOptionsSummary,
    inputSummary: payload.inputSummary,
    rawEventLogFiles,
    metadata: payload.metadata ?? {},
  };

  await writeFile(
    path.join(payload.artifactDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    path.join(payload.artifactDir, "terminal-transcript.txt"),
    buildTerminalTranscript(payload, rawEventLogFiles),
    "utf8",
  );
}

function buildTerminalTranscript(
  payload: CaseArtifactPayload,
  rawEventLogFiles: string[],
): string {
  const lines = [
    `[E2E] case=${payload.caseName}`,
    `[E2E] auth_mode=${payload.authMode}`,
    `[E2E] options=${JSON.stringify(payload.sessionOptionsSummary)}`,
    `[E2E] input=${JSON.stringify(payload.inputSummary)}`,
    `[E2E] raw_event_count=${payload.rawEvents.length}`,
    `[E2E] relay_event_count=${payload.relayEvents.length}`,
    `[E2E] raw_event_log_files=${rawEventLogFiles.join(",") || "<none>"}`,
    `[E2E] final_response=${payload.finalResponse}`,
    `[E2E] artifact_dir=${payload.artifactDir}`,
  ];

  return `${lines.join("\n")}\n`;
}

function createRunId(): string {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  return `${iso}-${process.pid}`;
}

function sanitizeCaseName(caseName: string): string {
  return caseName.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
