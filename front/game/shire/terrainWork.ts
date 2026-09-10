import type { TerrainContext } from '@shared/shire/atlas'
import type { Excavation } from '@shared/shire/model'

export interface TerrainWork {key:string;cx:number;cz:number;seed:TerrainContext;edits:Excavation[];revision:number}
export type TerrainResult={key:string;revision:number;stamp:string}&({positions:Float32Array;normals:Float32Array;colors:Float32Array;error?:undefined}|{error:string})
