export type IntelligenceContextKind="page"|"tab"|"workspace"|"session"|"memory";
export interface IntelligenceContextFragment{readonly id:string;readonly kind:IntelligenceContextKind;readonly content:string;readonly tokensEstimate:number;readonly sensitivity:"public"|"private"|"sensitive";readonly relevance:number;readonly metadata?:Readonly<Record<string,unknown>>;}
export interface IntelligenceContextRequest{readonly query:string;readonly tabId?:string;readonly workspaceId?:string;readonly sessionId?:string;readonly maxTokens:number;}
export interface IntelligenceContextSource{readonly id:string;readonly kind:IntelligenceContextKind;collect(request:IntelligenceContextRequest,signal?:AbortSignal):Promise<readonly IntelligenceContextFragment[]>;}
