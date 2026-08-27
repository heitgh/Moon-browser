export type AiRole="system"|"user"|"assistant"|"tool";
export interface AiMessage{readonly role:AiRole;readonly content:string;readonly name?:string;readonly toolCallId?:string;}
export interface AiToolDefinition{readonly name:string;readonly description:string;readonly inputSchema:Readonly<Record<string,unknown>>;}
export interface AiRequest{readonly id:string;readonly model?:string;readonly messages:readonly AiMessage[];readonly tools?:readonly AiToolDefinition[];readonly temperature?:number;readonly maxOutputTokens?:number;readonly stream?:boolean;readonly metadata?:Readonly<Record<string,unknown>>;readonly signal?:AbortSignal;}
