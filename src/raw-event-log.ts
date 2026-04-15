import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import type { RawClaudeEvent } from "./options.js";

export type RawEventLogOption = boolean | string | undefined;

type RawEventRecord = {
  timestamp: string;
  event: Record<string, unknown>;
};

export type RawEventLogger = {
  log: (event: RawClaudeEvent) => void;
  close: () => Promise<void>;
};

const noopLogger: RawEventLogger = {
  log: () => {},
  close: async () => {},
};

export async function createRawEventLogger(
  option: RawEventLogOption,
): Promise<RawEventLogger> {
  if (!option) {
    return noopLogger;
  }

  let dir: string;
  if (typeof option === "string") {
    if (!path.isAbsolute(option)) {
      throw new Error(
        `rawEventLog path must be an absolute path, got: "${option}"`,
      );
    }
    dir = option;
  } else {
    dir = path.resolve(process.cwd(), "agent_logs");
  }

  await mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${createFilename()}.ndjson`);
  const stream = createWriteStream(filePath, {
    flags: "a",
    encoding: "utf8",
  });
  let closed = false;
  let fatalError: Error | null = null;
  let pendingDrain: Promise<void> | null = null;

  stream.on("error", (error) => {
    fatalError = error;
  });

  const ensureDrainPromise = (): Promise<void> => {
    if (!pendingDrain) {
      pendingDrain = once(stream, "drain").then(() => {
        pendingDrain = null;
      });
    }

    return pendingDrain;
  };

  return {
    log(event) {
      if (closed || fatalError) {
        return;
      }

      const record: RawEventRecord = {
        timestamp: new Date().toISOString(),
        event: serializeRawClaudeEvent(event),
      };

      const accepted = stream.write(`${JSON.stringify(record)}\n`);
      if (!accepted) {
        void ensureDrainPromise();
      }
    },
    async close() {
      if (closed) {
        return;
      }
      closed = true;

      if (pendingDrain) {
        await pendingDrain;
      }

      stream.end();
      await once(stream, "close");

      if (fatalError) {
        throw fatalError;
      }
    },
  };
}

function createFilename(): string {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const random = Math.random().toString(36).slice(2, 8);
  return `claude-raw-events-${iso}-${process.pid}-${random}`;
}

function serializeRawClaudeEvent(event: RawClaudeEvent): Record<string, unknown> {
  if (event.type !== "process_error") {
    return { ...event };
  }

  return {
    ...event,
    error: {
      name: event.error.name,
      message: event.error.message,
      stack: event.error.stack,
    },
  };
}
