import type { ParsedIntent } from "./intent-parser.js";
export interface NavigationAction{readonly id:string;readonly type:ParsedIntent["intent"];readonly arguments:Readonly<Record<string,unknown>>;readonly requiresConfirmation:boolean;}
export class ActionPlanner{plan(intent:ParsedIntent):readonly NavigationAction[]{if(intent.intent==="unknown")return[];return[{id:`navigation-action-${Date.now()}`,type:intent.intent,arguments:intent.target?{target:intent.target}:{},requiresConfirmation:["close-tab"].includes(intent.intent)}];}}
