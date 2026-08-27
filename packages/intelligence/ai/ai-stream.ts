import type { AiResponse,AiToolCall,AiUsage } from "./ai-response.js";
export type AiStreamEvent={readonly type:"text";readonly delta:string}|{readonly type:"tool-call";readonly toolCall:AiToolCall}|{readonly type:"usage";readonly usage:AiUsage}|{readonly type:"done";readonly response:AiResponse}|{readonly type:"error";readonly error:unknown};
export interface AiStream extends AsyncIterable<AiStreamEvent>{cancel(reason?:unknown):void;}
