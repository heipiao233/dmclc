import { FabricLikeModule } from "./fabriclike/fabriclike.js";
import { FabricLikeVersionInfo } from "./fabriclike/fabriclike_version_info.js";
export class FabricModule extends FabricLikeModule<FabricLikeVersionInfo> {
    metaURL = "https://meta.fabricmc.net/v2";
    loaderMaven = "https://maven.fabricmc.net/";
}
