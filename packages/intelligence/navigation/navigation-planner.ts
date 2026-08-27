import { ActionPlanner,type NavigationAction } from "./action-planner.js";import { IntentParser,type ParsedIntent } from "./intent-parser.js";
export interface AiNavigationPlan{readonly intent:ParsedIntent;readonly actions:readonly NavigationAction[];readonly createdAt:number;}
export class AiNavigationPlanner{constructor(readonly parser=new IntentParser(),readonly planner=new ActionPlanner()){}plan(input:string):AiNavigationPlan{const intent=this.parser.parse(input);return{intent,actions:this.planner.plan(intent),createdAt:Date.now()};}}
