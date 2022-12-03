import { McInstallation } from "../schemas.js";
import { FabricLikeModule } from "./fabriclike/fabriclike.js";
import { FabricLikeVersionInfo } from "./fabriclike/fabriclike_version_info.js";
export class FabricModule extends FabricLikeModule<FabricLikeVersionInfo> {
    metaURL = "https://meta.fabricmc.net/v2";
    loaderMaven = "https://maven.fabricmc.net/";
    findInVersion(MCVersion: McInstallation): string | null {
        let ret: string | null = null;
        MCVersion.libraries.forEach(i=>{
            if(i.name.includes(":fabric-loader:")){
                ret = i.name.split(":")[2];
            }
        });
        return ret;
    }
}
