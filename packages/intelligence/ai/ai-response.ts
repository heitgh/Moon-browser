export interface AiUsage{readonly inputTokens:number;readonly outputTokens:number;readonly totalTokens:number;}
export interface AiToolCall{readonly id:string;readonly name:string;readonly arguments:unknown;}
export interface AiResponse{readonly id:string;readonly requestId:string;readonly model:string;readonly content:string;readonly toolCalls:readonly AiToolCall[];readonly finishReason:"stop"|"length"|"tool-calls"|"cancelled"|"error";readonly usage?:AiUsage;readonly createdAt:number;}
