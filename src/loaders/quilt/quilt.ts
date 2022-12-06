import { MCVersion } from "../../schemas.js";
import { FabricLikeLoader } from "../fabriclike/fabriclike.js";
import { QuiltVersionInfo } from "./quilt_version_info.js";
export class QuiltLoader extends FabricLikeLoader<QuiltVersionInfo> {
    metaURL = "https://meta.quiltmc.org/v3";
    loaderMaven = "https://maven.quiltmc.org/repository/release/";
    hashedMaven = "https://maven.quiltmc.org/repository/release/";
    findInVersion(MCVersion: MCVersion): string | null {
        let ret: string | null = null;
        MCVersion.libraries.forEach(i=>{
            if(i.name.includes(":quilt-loader:")){
                ret = i.name.split(":")[2];
            }
        });
        return ret;
    }
}
