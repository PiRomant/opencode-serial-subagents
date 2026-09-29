import type { Plugin } from "@opencode-ai/plugin";

let queue: Promise<void> = Promise.resolve();
let releaseActive: (() => void) | undefined;

function releaseQueue(): void {
  const release = releaseActive;
  releaseActive = undefined;
  release?.();
}

export const SerialSubagentsPlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (payload: any) => {
      if (payload?.tool == "task") {
        const previous = queue;
        let releaseNext!: () => void;
        queue = new Promise<void>((resolve) => {
          releaseNext = resolve;
        });
        await previous;
        releaseActive = releaseNext;
      }
    },
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        releaseQueue();
      }
    },
  } as any;
};

export default SerialSubagentsPlugin;