import { ModDisplayInfo, ModInfo } from "../mods/mod.js";
import { MCVersion } from "../schemas.js";
import { checkMatch, FabricLikeLoader, formatDepVersion, normalizeVersion } from "./fabriclike/fabriclike.js";
import { FabricLikeVersionInfo } from "./fabriclike/fabriclike_version_info.js";
import { FabricModJson } from "./fabric_schemas.js";
import { ModLoadingIssue } from "./loader.js";
export class FabricLoader extends FabricLikeLoader<FabricLikeVersionInfo, FabricModJson> {
    metaURL = "https://meta.fabricmc.net/v2";
    loaderMaven = "https://maven.fabricmc.net/";
    findInVersion(MCVersion: MCVersion): string | undefined {
        let ret: string | undefined;
        MCVersion.libraries.forEach(i=>{
            if(i.name.includes(":fabric-loader:")){
                ret = i.name.split(":")[2];
            }
        });
        return ret;
    }
    checkMods(mods: ModInfo<FabricModJson>[], mc: string, loader: string): ModLoadingIssue[] {
        const modIdVersions: Record<string, string> = {
            minecraft: normalizeVersion(mc),
            fabricloader: loader,
            java: "Provided"
        };
        const issues: ModLoadingIssue[] = [];
        for (const mod of mods) {
            if(mod.loader !== "fabric")continue;
            modIdVersions[mod.data.id] = mod.data.version;
            if(mod.data.provides){
                for (const provide of mod.data.provides) {
                    modIdVersions[provide] = "Provided";
                }
            }
        }
        for (const mod of mods) {
            if(mod.loader !== "fabric")break;
            issues.push(...checkFabricDeps(mod.data, modIdVersions));
        }
        return issues;
    }

    getModInfo(mod: FabricModJson): ModDisplayInfo {
        const res: ModDisplayInfo = {
            id: mod.id,
            version: mod.version
        };
        if(mod.description) res.description = mod.description;
        if(mod.name) res.name = mod.name;
        if(mod.license instanceof Array) {
            res.license = mod.license.join(", ");
        } else {
            res.license = mod.license ?? "ARR";
        }
        return res;
    }
}
export function checkFabricDeps(mod: FabricModJson, modIdVersions: Record<string, string>): ModLoadingIssue[] {
    const issues: ModLoadingIssue[] = [];
    for (const id in mod.depends) {
        if(!(id in modIdVersions&&checkMatch(modIdVersions[id], mod.depends[id]))){
            issues.push(new ModLoadingIssue("error", "dependencies.dependency_wrong_missing", {
                source: mod.id,
                target: id,
                targetVersion: formatDepVersion(mod.depends[id])
            }));
        }
    }
    for (const id in mod.recommends) {
        if(!(id in modIdVersions&&checkMatch(modIdVersions[id], mod.recommends[id]))){
            issues.push(new ModLoadingIssue("warning", "dependencies.recommends_wrong_missing", {
                source: mod.id,
                target: id,
                targetVersion: formatDepVersion(mod.recommends[id])
            }));
        }
    }
    for (const id in mod.conflicts) {
        if(id in modIdVersions && checkMatch(modIdVersions[id], mod.conflicts[id])){
            issues.push(new ModLoadingIssue("warning", "dependencies.conflicts_exists", {
                source: mod.id,
                target: id,
                targetVersion: formatDepVersion(mod.conflicts[id])
            }));
        }
    }
    for (const id in mod.breaks) {
        if(id in modIdVersions && checkMatch(modIdVersions[id], mod.breaks[id])){
            issues.push(new ModLoadingIssue("error", "dependencies.breaks_exists", {
                source: mod.id,
                target: id,
                targetVersion: formatDepVersion(mod.breaks[id])
            }));
        }
    }
    return issues;
}
