import { FabricLikeModule } from "../fabriclike/fabriclike.js";
import { QuiltVersionInfo } from "./quilt_version_info.js";
import { McInstallation } from "../../schemas.js";
export class QuiltModule extends FabricLikeModule<QuiltVersionInfo> {
    name = "quilt";
    metaURL = "https://meta.quiltmc.org/v3";
    loaderMaven = "https://maven.quiltmc.org/repository/release/";
    hashedMaven = "https://maven.quiltmc.org/repository/release/";
    writeMore (mcVersion: McInstallation, versionInfo: QuiltVersionInfo): McInstallation {
        mcVersion.libraries.push({
            name: versionInfo.hashed.maven,
            url: this.hashedMaven
        });
        return mcVersion;
    }
}
