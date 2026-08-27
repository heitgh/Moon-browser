export interface PluginPanelDefinition{readonly id:string;readonly pluginId:string;readonly title:string;readonly icon?:string;readonly location:"sidebar"|"bottom"|"overlay";readonly render:(container:HTMLElement)=>void|Promise<void>;}
export interface PanelApi{register(panel:PluginPanelDefinition):()=>void;show(id:string):Promise<void>;hide(id:string):void;}
