import type { MoonEvent } from "@moon/core";import type { AiRequest } from "./ai-request.js";import type { AiResponse } from "./ai-response.js";
export type AiRequestStartedEvent=MoonEvent<"ai:request-started",{readonly request:Omit<AiRequest,"signal">}>;
export type AiRequestCompletedEvent=MoonEvent<"ai:request-completed",{readonly response:AiResponse}>;
export type AiRequestFailedEvent=MoonEvent<"ai:request-failed",{readonly requestId:string;readonly error:unknown}>;
