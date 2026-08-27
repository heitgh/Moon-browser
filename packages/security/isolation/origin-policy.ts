export interface OriginPolicy{readonly origin:string;readonly allowScripts:boolean;readonly allowStorage:boolean;readonly allowPopups:boolean;readonly allowMixedContent:boolean;readonly allowedOrigins:readonly string[];}
export const DEFAULT_ORIGIN_POLICY:Omit<OriginPolicy,"origin">={allowScripts:true,allowStorage:true,allowPopups:false,allowMixedContent:false,allowedOrigins:[]};
export function sameOrigin(left:string,right:string):boolean{try{return new URL(left).origin===new URL(right).origin;}catch{return false;}}
