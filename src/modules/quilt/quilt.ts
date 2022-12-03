import { McInstallation } from "../../schemas.js";
import { FabricLikeModule } from "../fabriclike/fabriclike.js";
import { QuiltVersionInfo } from "./quilt_version_info.js";
export class QuiltModule extends FabricLikeModule<QuiltVersionInfo> {
    metaURL = "https://meta.quiltmc.org/v3";
    loaderMaven = "https://maven.quiltmc.org/repository/release/";
    hashedMaven = "https://maven.quiltmc.org/repository/release/";
    findInVersion(MCVersion: McInstallation): string | null {
        let ret: string | null = null;
        MCVersion.libraries.forEach(i=>{
            if(i.name.includes(":quilt-loader:")){
                ret = i.name.split(":")[2];
            }
        });
        return ret;
    }
}
