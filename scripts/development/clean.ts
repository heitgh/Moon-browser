import { rm } from "node:fs/promises";import { resolve } from "node:path";
const targets=["dist","build","release","coverage"].map(target=>resolve(target));for(const target of targets){await rm(target,{recursive:true,force:true});console.log(`Removed ${target}`);}
