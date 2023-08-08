import fs from "fs";
import got from "got";
import StreamZip from "node-stream-zip";
import { tmpdir } from "os";
import { Launcher } from "../../launcher.js";
import { ModDisplayInfo, ModInfo } from "../../mods/mod.js";
import { MCVersion } from "../../schemas.js";
import { merge } from "../../utils/MergeVersionJSONs.js";
import { transformJSON } from "../../utils/transformJSON.js";
import { MinecraftVersion } from "../../version.js";
import { FabricModJson } from "../fabric_schemas.js";
import { Loader, ModLoadingIssue } from "../loader.js";
import { FabricLikeVersionInfo } from "./fabriclike_version_info.js";
import { SemanticVersionImpl } from "./version/SemanticVersionImpl.js";
import { VersionParser } from "./version/VersionParser.js";
import { VersionPredicate } from "./version/VersionPredicate.js";
import { VersionPredicateParser } from "./version/VersionPredicateParser.js";
export abstract class FabricLikeLoader<T extends FabricLikeVersionInfo, M> implements Loader<M | FabricModJson> {
    abstract loaderMaven: string;
    abstract metaURL: string;
    intermediaryMaven = "https://maven.fabricmc.net/";
    protected readonly launcher: Launcher;
    constructor (launcher: Launcher) {
        this.launcher = launcher;
    }
    abstract checkMods(mods: ModInfo<M>[], mc: string, loader: string): ModLoadingIssue[];
    abstract findInVersion(MCVersion: MCVersion): string | undefined;
    abstract getModInfo(mod: M | FabricModJson): ModDisplayInfo;
    
    async findModInfos(path: string): Promise<ModInfo<FabricModJson | M>[]> {
        const zip = new StreamZip.async({
            file: path
        });
        const entry = await zip.entry("fabric.mod.json");
        if(entry === undefined)return [];
        const result: ModInfo<FabricModJson | M>[] = [];
        const json: FabricModJson = JSON.parse(transformJSON((await zip.entryData(entry)).toString()));
        if(json.jars !== undefined){
            for (const jar of json.jars) {
                const paths = jar.file.split("/");
                const filename = `${tmpdir()}/${paths[paths.length-1]}`;
                await zip.extract(jar.file, filename);
                result.push(...await this.findModInfos(filename));
            }
        }
        await zip.close();
        const info = new ModInfo("fabric", json, this.launcher);
        info.data = json;
        result.push(info);
        return result;
    }

    private readonly cachedLoaderVersions: Map<string, T> = new Map();
    /**
     * 
     * @throws {@link FormattedError}
     * @param MCVersion - Minecraft version.
     * @returns Loader versions.
     */
    async getSuitableLoaderVersions (MCVersion: MinecraftVersion): Promise<string[]> {
        if(MCVersion.extras.version === "Unknown") {
            await this.launcher.error("loaders.minecraft_version_unknown");
            return [];
        }
        const versions: T[] = JSON.parse((await got(`${this.metaURL}/versions/loader/${encodeURIComponent(MCVersion.extras.version)}`)).body);
        const result: string[] = [];
        versions.forEach(v => {
            this.cachedLoaderVersions.set(`${MCVersion.extras.version}-${v.loader.version}`, v);
            result.push(v.loader.version);
        });
        return result;
    }

    async install (MCVersion: MinecraftVersion, version: string): Promise<boolean> {
        if(MCVersion.extras.version === "Unknown") {
            await this.launcher.error("loaders.minecraft_version_unknown");
            return false;
        }
        const versionInfo: T = this.cachedLoaderVersions.get(`${MCVersion}-${version}`) ??
            await got(`${this.metaURL}/versions/loader/${encodeURIComponent(MCVersion.extras.version)}/${encodeURIComponent(version)}`).json();
        const mcVersion: MCVersion = JSON.parse(fs.readFileSync(`${this.launcher.rootPath}/versions/${MCVersion.name}/${MCVersion.name}.json`).toString());
        if (mcVersion.mainClass === versionInfo.launcherMeta.mainClass.client) return true;
        const newVersion: MCVersion = await got(`${this.metaURL}/versions/loader/${encodeURIComponent(MCVersion.extras.version)}/${encodeURIComponent(version)}/profile/json`).json();
        MCVersion.versionObject = merge(mcVersion, newVersion);
        fs.writeFileSync(`${MCVersion.versionRoot}/${MCVersion.name}.json`, JSON.stringify(MCVersion.versionObject));
        return true;
    }
}

/**
 * See net.fabricmc.loader.impl.game.minecraft.McVersionLookup#normalizeVersion
 * @param mc - Original Minecraft version.
 */
export function normalizeVersion(mc: string): string {
    let matcher;
    if((matcher = mc.match(/(.*)_experimental-snapshot-(.*)/))) {
        return `${matcher[1]}-Experimetal.${matcher[2]}`;
    } else if ((matcher = mc.match(/(.*)-rc\d+/))) {
        const release = matcher[1];
        let rcBuild = matcher[2];
        if(release === "1.16") {
            const build: number = parseInt(rcBuild);
            rcBuild = (build+8).toString();
        }
        return `${release}-rc.${rcBuild}`;
    } else if ((matcher = mc.match(/(.*)-pre\d+/))) {
        const release = matcher[1];
        const legacy = VersionPredicateParser.parseOne("<=1.16").test(SemanticVersionImpl.of(release, false));
        if(legacy) {
            return `${release}-rc.${matcher[2]}`;
        } else return `${release}-beta.${matcher[2]}`;
    } else if ((matcher = mc.match(/^(\d+)w(\d+)(.)$/))) {
        return `${getSnapshotTarget(parseInt(matcher[1]), parseInt(matcher[2]))}-alpha.${matcher[1]}.${matcher[2]}.${matcher[3]}`;
    } else if (mc.includes("combat")) {
        return getCombatVersion(mc);
    } else if (mc === "15w14a") {
        return "1.8.4-alpha.15.14.a+loveandhugs";
    } else if (mc.match(/^\d\.\d+(\.\d+)?$/)) {
        return mc;
    } else if (mc.startsWith("b1.")) {
        return `1.0.0-beta.${mc.substring(3)}`;
    } else if (mc.startsWith("a1.")) {
        return `1.0.0-alpha.${mc.substring(3)}`;
    } else if (mc.startsWith("inf-")) {
        return `0.31.${mc.substring(4)}`;
    } else if (mc.startsWith("c0.")) {
        return mc.substring(1);
    } else if (mc.startsWith("rd-")) {
        let version = mc.substring(3);
        if (version === "20090515") version = "150000";
        return `0.0.0-rd.${version}`;
    } else if (mc === "1.RV-Pre1") {
        return "1.9.2-rv+trendy";
    } else if (mc === "3D Shareware v1.34 / 62337d1d00cf4d86a03b975208d8c323") {
        return "1.14-alpha.19.13.shareware";
    } else if (mc === "20w14infinite") {
        return "1.16-alpha.20.13.inf";
    } else return "1.145.14";
}

/**
 * Copied from net.fabricmc.loader.impl.game.minecraft.McVersionLookup#getRelease
 * Copyright Notice:
 * Copyright 2016 FabricMC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function getSnapshotTarget(year: number, week: number): string {
    if (year == 22 && week >= 42 || year >= 23) {
        return "1.19.3";
    } else if (year == 22 && week == 24) {
        return "1.19.1";
    } else if (year == 22 && week >= 11 && week <= 19) {
        return "1.19";
    } else if (year == 22 && week >= 3 && week <= 7) {
        return "1.18.2";
    } else if (year == 21 && week >= 37 && week <= 44) {
        return "1.18";
    } else if (year == 20 && week >= 45 || year == 21 && week <= 20) {
        return "1.17";
    } else if (year == 20 && week >= 27 && week <= 30) {
        return "1.16.2";
    } else if (year == 20 && week >= 6) {
        return "1.16";
    } else if (year == 19 && week >= 34) {
        return "1.15";
    } else if (year == 18 && week >= 43 || year == 19 && week <= 14) {
        return "1.14";
    } else if (year == 18 && week >= 30 && week <= 33) {
        return "1.13.1";
    } else if (year == 17 && week >= 43 || year == 18 && week <= 22) {
        return "1.13";
    } else if (year == 17 && week == 31) {
        return "1.12.1";
    } else if (year == 17 && week >= 6 && week <= 18) {
        return "1.12";
    } else if (year == 16 && week == 50) {
        return "1.11.1";
    } else if (year == 16 && week >= 32 && week <= 44) {
        return "1.11";
    } else if (year == 16 && week >= 20 && week <= 21) {
        return "1.10";
    } else if (year == 16 && week >= 14 && week <= 15) {
        return "1.9.3";
    } else if (year == 15 && week >= 31 || year == 16 && week <= 7) {
        return "1.9";
    } else if (year == 14 && week >= 2 && week <= 34) {
        return "1.8";
    } else if (year == 13 && week >= 47 && week <= 49) {
        return "1.7.4";
    } else if (year == 13 && week >= 36 && week <= 43) {
        return "1.7.2";
    } else if (year == 13 && week >= 16 && week <= 26) {
        return "1.6";
    } else if (year == 13 && week >= 11 && week <= 12) {
        return "1.5.1";
    } else if (year == 13 && week >= 1 && week <= 10) {
        return "1.5";
    } else if (year == 12 && week >= 49 && week <= 50) {
        return "1.4.6";
    } else if (year == 12 && week >= 32 && week <= 42) {
        return "1.4.2";
    } else if (year == 12 && week >= 15 && week <= 30) {
        return "1.3.1";
    } else if (year == 12 && week >= 3 && week <= 8) {
        return "1.2.1";
    } else if (year == 11 && week >= 47 || year == 12 && week <= 1) {
        return "1.1";
    }

    return "";
}

function getCombatVersion(mc: string): string {
    switch(mc){
    case "1.14.3 - Combat Test / 5d5e0be06e714f03bba436c42db4c85b":
        // The first Combat Test, forked from 1.14.3 Pre-Release 4
        return "1.14.3-rc.4.combat.1";

    case "1.14_combat-0":
        // The second Combat Test, forked from 1.14.4
        return "1.14.5-combat.2";

    case "1.14_combat-3":
        // The third Combat Test, forked from 1.14.4
        return "1.14.5-combat.3";

    case "1.15_combat-1":
        // The fourth Combat Test, forked from 1.15 Pre-release 3
        return "1.15-rc.3.combat.4";

    case "1.15_combat-6":
        // The fifth Combat Test, forked from 1.15.2 Pre-release 2
        return "1.15.2-rc.2.combat.5";

    case "1.16_combat-0":
        // The sixth Combat Test, forked from 1.16.2 Pre-release 3
        return "1.16.2-beta.3.combat.6";

    case "1.16_combat-1":
        // Private testing Combat Test 7, forked from 1.16.2
        return "1.16.3-combat.7";

    case "1.16_combat-2":
        // Private testing Combat Test 7b, forked from 1.16.2
        return "1.16.3-combat.7.b";

    case "1.16_combat-3":
        // The seventh Combat Test 7c, forked from 1.16.2
        return "1.16.3-combat.7.c";

    case "1.16_combat-4":
        // Private testing Combat Test 8(a?), forked from 1.16.2
        return "1.16.3-combat.8";

    case "1.16_combat-5":
        // The eighth Combat Test 8b, forked from 1.16.2
        return "1.16.3-combat.8.b";

    case "1.16_combat-6":
        // The ninth Combat Test 8c, forked from 1.16.2
        return "1.16.3-combat.8.c";
    default:
        return "11.45.14-1919810";
    }
}

export function checkMatch(current: string, required: string | string[]): boolean {
    if(current === "Provided") return true;
    let p: Set<VersionPredicate>;
    const currentV = VersionParser.parse(current, false);
    if(required instanceof Array) {
        p = VersionPredicateParser.parse(required);
    } else p = new Set([VersionPredicateParser.parseOne(required)]);
    let res = true;
    for (const i of p) {
        res &&= i.test(currentV);
    }
    return res;
}

export function formatDepVersion(version: string | string[]): string {
    if(version instanceof Array) {
        return version.map(formatDepVersion).join("\nor\n");
    }
    const v = VersionPredicateParser.parseOne(version);
    return v.toString();
}
