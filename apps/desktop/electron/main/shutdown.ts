// Nexus Inc. — one deadline for the whole shutdown, with no database close racing a hung flush.
export async function runShutdown(
  steps: readonly { readonly name: string; run(): Promise<void> }[],
  options: { readonly timeoutMs: number; timedOut(stage: string): void; failed(stage: string): void }
): Promise<boolean> {
  let stage = "starting";
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<false>(resolve => {
    timer = setTimeout(() => { expired = true; options.timedOut(stage); resolve(false); }, options.timeoutMs);
  });
  const work = async (): Promise<true> => {
    for (const step of steps) {
      if (expired) return true;
      stage = step.name;
      try { await step.run(); } catch { options.failed(stage); }
    }
    return true;
  };
  try { return await Promise.race([work(), deadline]); }
  finally { clearTimeout(timer); }
}
