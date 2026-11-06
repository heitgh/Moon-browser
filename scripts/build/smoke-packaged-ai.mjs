/* global AbortController */
import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { app } from "electron";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function smoke() {
  const [archive, model] = process.argv.slice(-2).map(path => resolve(path));
  const providerUrl = pathToFileURL(resolve(archive, "dist/types/apps/desktop/electron/ai/ai-provider.js"));
  const { LocalLlamaProvider } = await import(providerUrl.href);
  const provider = new LocalLlamaProvider();
  const input = { modelPath: model, operation: "question", question: "Tell a short story about a dog.", sources: [] };

  let streamed = "";
  let pid = null;
  const answer = await provider.generate(input, {
    signal: new AbortController().signal,
    onChunk: chunk => { streamed += chunk; },
    onPid: value => { pid = value; }
  });
  assert.ok(answer.trim(), "The GGUF model must generate nonempty text");
  assert.equal(answer, streamed, "The stream must match the final response");
  assert.equal(pid, null, "The utility process must exit after generation");

  const cancellation = new AbortController();
  let started = false;
  await assert.rejects(provider.generate(input, {
    signal: cancellation.signal,
    onChunk: () => {},
    onPid: value => {
      pid = value;
      if (value !== null) {
        started = true;
        cancellation.abort();
      }
    }
  }), /Tarefa interrompida/);
  assert.ok(started, "Cancellation must target an actual running utility process");
  assert.equal(pid, null, "The utility process must exit after cancellation");
}

app.whenReady().then(smoke).then(() => {
  console.log("Packaged GGUF generation, streaming, cancellation and cleanup passed.");
  app.exit(0);
}).catch(error => {
  console.error(error);
  app.exit(1);
});
