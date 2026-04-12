import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import type { RawClaudeEvent } from "./options.js";

export type RawEventLogOption = boolean | string | undefined;

type RawEventRecord = {
  timestamp: string;
  event: Record<string, unknown>;
};

export type RawEventLogger = {
  log: (event: RawClaudeEvent) => Promise<void>;
  close: () => Promise<void>;
};

const noopLogger: RawEventLogger = {
  log: async () => {},
  close: async () => {},
};

export async function createRawEventLogger(
  option: RawEventLogOption,
): Promise<RawEventLogger> {
  if (!option) {
    return noopLogger;
  }

  const dir =
    typeof option === "string"
      ? path.resolve(option)
      : path.resolve(process.cwd(), "logs");

  await mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${createFilename()}.ndjson`);
  const file = await open(filePath, "a");
  let writeChain = Promise.resolve();
  let closed = false;

  return {
    log(event) {
      if (closed) {
        return Promise.resolve();
      }

      const record: RawEventRecord = {
        timestamp: new Date().toISOString(),
        event: serializeRawClaudeEvent(event),
      };

      writeChain = writeChain.then(() =>
        file.appendFile(`${JSON.stringify(record)}\n`, "utf8"),
      );

      return writeChain;
    },
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await writeChain;
      await file.close();
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
