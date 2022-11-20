import { FabricLikeModule } from "../fabriclike/fabriclike.js";
import { QuiltVersionInfo } from "./quilt_version_info.js";
export class QuiltModule extends FabricLikeModule<QuiltVersionInfo> {
    metaURL = "https://meta.quiltmc.org/v3";
    loaderMaven = "https://maven.quiltmc.org/repository/release/";
    hashedMaven = "https://maven.quiltmc.org/repository/release/";
}
