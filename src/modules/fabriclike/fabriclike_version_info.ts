import { Library } from "../../schemas.js";
// Only include fields that we care about.
export declare class FabricLikeVersionInfo {
    loader: Version;
    intermediary: Version;
    launcherMeta: LauncherMeta;
}
export declare class LauncherMeta {
    libraries: { "client": Library[], "common": Library[] };
    mainClass: { "client": string };
}
export declare class Version {
    maven: string;
    version: string;
}
