export interface MoonExtensionMetadata{readonly id:string;readonly name:string;readonly version:string;readonly description?:string;}
export interface MoonExtensionLifecycle{activate():void|Promise<void>;deactivate():void|Promise<void>;}
export interface MoonExtensionModule{readonly metadata:MoonExtensionMetadata;readonly lifecycle:MoonExtensionLifecycle;}
export type Disposable=()=>void;
