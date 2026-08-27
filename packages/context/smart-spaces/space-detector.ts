import type { ContextItem } from "../engine/context-engine.js"; import { evaluateSpaceRule,type SpaceRule } from "./space-rules.js";
export interface SpaceDetection {readonly workspaceId:string;readonly ruleId:string;readonly score:number;}
export class SpaceDetector{detect(item:ContextItem,rules:readonly SpaceRule[]):SpaceDetection|undefined{return rules.map(rule=>({workspaceId:rule.workspaceId,ruleId:rule.id,score:evaluateSpaceRule(rule,item)})).filter(result=>result.score>0).sort((a,b)=>b.score-a.score)[0];}}
