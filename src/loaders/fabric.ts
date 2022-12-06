import { MCVersion } from "../schemas.js";
import { FabricLikeLoader } from "./fabriclike/fabriclike.js";
import { FabricLikeVersionInfo } from "./fabriclike/fabriclike_version_info.js";
export class FabricLoader extends FabricLikeLoader<FabricLikeVersionInfo> {
    metaURL = "https://meta.fabricmc.net/v2";
    loaderMaven = "https://maven.fabricmc.net/";
    findInVersion(MCVersion: MCVersion): string | null {
        let ret: string | null = null;
        MCVersion.libraries.forEach(i=>{
            if(i.name.includes(":fabric-loader:")){
                ret = i.name.split(":")[2];
            }
        });
        return ret;
    }
}
