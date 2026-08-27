import { spawn } from "node:child_process";
const platform=process.argv[2];if(platform&&!['android','ios'].includes(platform))throw new Error("Mobile platform must be android or ios");
await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,["node_modules/typescript/bin/tsc","--project","tsconfig.json","--noEmit"],{stdio:"inherit"});child.once("error",reject);child.once("exit",code=>code===0?resolve():reject(new Error(`Mobile typecheck failed with code ${code}`)));});console.log(`Mobile shared layer validated${platform?` for ${platform}`:""}.`);
