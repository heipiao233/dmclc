import got from "got";
import { ModuleType } from "../mc_module.js";
import { FabricLikeVersionInfo } from "./fabriclike_version_info.js";
import { Launcher } from "../../launcher.js";
import { McInstallation } from "../../schemas.js";
import fs from "fs";
import { merge } from "../../utils/mergeversionjson.js";
import { Version } from "../../version.js";
export abstract class FabricLikeModule<T extends FabricLikeVersionInfo> implements ModuleType {
    abstract loaderMaven: string;
    abstract metaURL: string;
    intermediaryMaven = "https://maven.fabricmc.net/";
    private readonly launcher: Launcher;
    constructor (launcher: Launcher) {
        this.launcher = launcher;
    }
    abstract findInVersion(MCVersion: McInstallation): string | null;

    private readonly cachedLoaderVersions: Map<string, T> = new Map();
    async getSuitableModuleVersions (MCVersion: Version): Promise<string[]> {
        if(MCVersion.extras.version === "Unknown") {
            throw new Error("Minecraft Version Unknown");
        }
        const versions: T[] = JSON.parse((await got(`${this.metaURL}/versions/loader/${encodeURIComponent(MCVersion.extras.version)}`)).body);
        const result: string[] = [];
        versions.forEach(v => {
            this.cachedLoaderVersions.set(`${MCVersion}-${v.loader.version}`, v);
            result.push(v.loader.version);
        });
        return result;
    }

    async install (MCVersion: Version, version: string): Promise<void> {
        if(MCVersion.extras.version === "Unknown") {
            throw new Error("Minecraft Version Unknown");
        }
        const versionInfo: T = this.cachedLoaderVersions.get(`${MCVersion}-${version}`) ??
            await got(`${this.metaURL}/versions/loader/${encodeURIComponent(MCVersion.extras.version)}/${encodeURIComponent(version)}`).json();
        const mcVersion: McInstallation = JSON.parse(fs.readFileSync(`${this.launcher.rootPath}/versions/${MCVersion.name}/${MCVersion.name}.json`).toString());
        if (mcVersion.mainClass === versionInfo.launcherMeta.mainClass.client) return;
        const newVersion: McInstallation = await got(`${this.metaURL}/versions/loader/${encodeURIComponent(MCVersion.name)}/${encodeURIComponent(version)}/profile/json`).json();
        fs.writeFileSync(`${MCVersion.versionRoot}/${MCVersion.name}.json`, JSON.stringify(merge(mcVersion, newVersion)));
    }
}
