import { Library } from "../../schemas.js";
// Only include fields that we care about.
export type FabricLikeVersionInfo = {
    loader: Version;
    intermediary: Version;
    launcherMeta: LauncherMeta;
}
export type LauncherMeta = {
    libraries: { "client": Library[], "common": Library[] };
    mainClass: { "client": string };
}
export type Version = {
    maven: string;
    version: string;
}
