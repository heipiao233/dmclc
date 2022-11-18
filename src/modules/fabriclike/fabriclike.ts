import got from "got";
import { ModuleType } from "../mc_module.js";
import { FabricLikeVersionInfo } from "./fabriclike_version_info.js";
import { Launcher } from "../../launcher.js";
import { McInstallation } from "../../schemas.js";
import fs from "fs";
export class FabricLikeModule<T extends FabricLikeVersionInfo> implements ModuleType {
    declare loaderMaven: string;
    declare metaURL: string;
    intermediaryMaven = "https://maven.fabricmc.net/";
    private readonly launcher: Launcher;
    constructor (launcher: Launcher) {
        this.launcher = launcher;
    }

    private readonly cachedLoaderVersions: Map<string, T> = new Map();
    async getSuitableModuleVersions (MCVersion: string): Promise<string[]> {
        const versions: T[] = JSON.parse((await got(`${this.metaURL}/versions/loader/${encodeURIComponent(MCVersion)}`)).body);
        const result: string[] = [];
        versions.forEach(v => {
            this.cachedLoaderVersions.set(`${MCVersion}-${v.loader.version}`, v);
            result.push(v.loader.version);
        });
        return result;
    }

    async install (MCVersion: string, MCName: string, version: string): Promise<void> {
        const versionInfo: T = this.cachedLoaderVersions.get(`${MCVersion}-${version}`) ??
      JSON.parse((await got(`${this.metaURL}/versions/loader/${encodeURIComponent(MCVersion)}/${encodeURIComponent(version)}`)).body);
        let mcVersion: McInstallation = JSON.parse(fs.readFileSync(`${this.launcher.rootPath}/versions/${MCName}/${MCName}.json`).toString());
        if (mcVersion.mainClass === versionInfo.launcherMeta.mainClass.client) return;
        mcVersion.libraries.push(...versionInfo.launcherMeta.libraries.client);
        mcVersion.libraries.push(...versionInfo.launcherMeta.libraries.common);
        mcVersion.libraries.push({
            name: versionInfo.loader.maven,
            url: this.loaderMaven
        });
        mcVersion.libraries.push({
            name: versionInfo.intermediary.maven,
            url: this.intermediaryMaven
        });
        mcVersion = this.writeMore(mcVersion, versionInfo);
        mcVersion.mainClass = versionInfo.launcherMeta.mainClass.client;
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${MCName}/${MCName}.json`, JSON.stringify(mcVersion));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    writeMore (mcVersion: McInstallation, versionInfo: T): McInstallation {
        return mcVersion;
    }
}
