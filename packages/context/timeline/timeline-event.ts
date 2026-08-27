export type TimelineEventType="navigation"|"tab"|"session"|"workspace"|"download"|"note"|"task"|"ai"|"system";
export interface TimelineEvent<T=unknown>{readonly id:string;readonly type:TimelineEventType;readonly title:string;readonly payload:T;readonly timestamp:number;readonly tabId?:string;readonly workspaceId?:string;readonly sessionId?:string;readonly private:boolean;}
