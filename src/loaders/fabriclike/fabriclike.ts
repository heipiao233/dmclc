import got from "got";
import { Loader, ModLoadingIssue } from "../loader.js";
import { FabricLikeVersionInfo } from "./fabriclike_version_info.js";
import { Launcher } from "../../launcher.js";
import { MCVersion } from "../../schemas.js";
import fs from "fs";
import { merge } from "../../utils/mergeversionjson.js";
import { Version } from "../../version.js";
import { ModInfo } from "../../mods/mod.js";
import * as semver from "semver";
export abstract class FabricLikeLoader<T extends FabricLikeVersionInfo, M> implements Loader<M> {
    abstract loaderMaven: string;
    abstract metaURL: string;
    intermediaryMaven = "https://maven.fabricmc.net/";
    private readonly launcher: Launcher;
    constructor (launcher: Launcher) {
        this.launcher = launcher;
    }
    abstract checkMods(mods: ModInfo<M>[], mc: string, loader: string): ModLoadingIssue[];
    abstract findInVersion(MCVersion: MCVersion): string | null;
    abstract findModInfos(path: string): Promise<ModInfo<M>[]>;

    private readonly cachedLoaderVersions: Map<string, T> = new Map();
    async getSuitableLoaderVersions (MCVersion: Version): Promise<string[]> {
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
        const mcVersion: MCVersion = JSON.parse(fs.readFileSync(`${this.launcher.rootPath}/versions/${MCVersion.name}/${MCVersion.name}.json`).toString());
        if (mcVersion.mainClass === versionInfo.launcherMeta.mainClass.client) return;
        const newVersion: MCVersion = await got(`${this.metaURL}/versions/loader/${encodeURIComponent(MCVersion.name)}/${encodeURIComponent(version)}/profile/json`).json();
        fs.writeFileSync(`${MCVersion.versionRoot}/${MCVersion.name}.json`, JSON.stringify(merge(mcVersion, newVersion)));
    }
}

export function formatDepVersion(dep: string | string[]): string {
    if(typeof(dep) === "string"){
        return dep.replaceAll(" ", " and ");
    } else {
        return dep.map(formatDepVersion).join("\nor ");
    }
}

export function checkMatch(current: string, required: string | string[]): boolean {
    if(typeof(required) === "string") {
        return !required.split(" ").map(v=>semver.satisfies(current, v)).includes(false);
    }
    return required.map(v=>checkMatch(current, v)).includes(true);
}
