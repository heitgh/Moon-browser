import type { AiRequest } from "../ai/ai-request.js";import type { AiResponse } from "../ai/ai-response.js";import type { AiStream } from "../ai/ai-stream.js";
export interface AiProviderCapabilities{readonly streaming:boolean;readonly tools:boolean;readonly vision:boolean;readonly maxContextTokens:number;readonly models:readonly string[];}
export interface AiProvider{readonly id:string;readonly name:string;capabilities():Promise<AiProviderCapabilities>;complete(request:AiRequest):Promise<AiResponse>;stream?(request:AiRequest):Promise<AiStream>;healthCheck():Promise<boolean>;}
