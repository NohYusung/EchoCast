export interface WaitForAudioContextRunningParams {
  getState: () => AudioContextState;
  resume: () => Promise<unknown>;
  totalTimeoutMs?: number;
  resumeTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface WaitForAudioContextRunningResult {
  ok: boolean;
  state: AudioContextState;
}

function wait(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => resolve("timeout"), Math.max(0, ms));
  });
}

async function resumeWithTimeout(
  resume: () => Promise<unknown>,
  timeoutMs: number,
): Promise<boolean> {
  const result = await Promise.race([
    resume()
      .then(() => "resumed" as const)
      .catch(() => "failed" as const),
    wait(timeoutMs),
  ]);
  return result === "resumed";
}

export async function waitForAudioContextRunning(
  params: WaitForAudioContextRunningParams,
): Promise<WaitForAudioContextRunningResult> {
  const totalTimeoutMs = Math.max(0, params.totalTimeoutMs ?? 3000);
  const resumeTimeoutMs = Math.max(0, params.resumeTimeoutMs ?? 500);
  const pollIntervalMs = Math.max(0, params.pollIntervalMs ?? 100);
  const startTime = Date.now();

  while (Date.now() - startTime < totalTimeoutMs) {
    const currentState = params.getState();
    if (currentState === "running") {
      return { ok: true, state: currentState };
    }
    if (currentState === "closed") {
      return { ok: false, state: currentState };
    }
    if (currentState === "suspended") {
      await resumeWithTimeout(params.resume, resumeTimeoutMs);
      if (params.getState() === "running") {
        return { ok: true, state: "running" };
      }
    }
    await wait(pollIntervalMs);
  }

  return { ok: params.getState() === "running", state: params.getState() };
}
