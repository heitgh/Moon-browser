export type AutomationTrigger={readonly type:"manual"}|{readonly type:"schedule";readonly cron:string}|{readonly type:"event";readonly eventType:string};
export interface AutomationDefinition{readonly id:string;readonly pluginId:string;readonly name:string;readonly enabled:boolean;readonly trigger:AutomationTrigger;readonly actions:readonly AutomationAction[];}
export interface AutomationAction{readonly type:string;readonly input:unknown;}
export interface AutomationApi{register(definition:AutomationDefinition):()=>void;run(id:string,input?:unknown):Promise<unknown>;}
