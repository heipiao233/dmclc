import StreamZip from "node-stream-zip";
import { tmpdir } from "os";
import { Launcher } from "../../launcher.js";
import { ModDisplayInfo, ModInfo } from "../../mods/mod.js";
import { MCVersion } from "../../schemas.js";
import { transformJSON } from "../../utils/transformJSON.js";
import { checkFabricDeps } from "../fabric.js";
import { FabricModJson } from "../fabric_schemas.js";
import { FabricLikeLoader, checkMatch, formatDepVersion, normalizeVersion } from "../fabriclike/fabriclike.js";
import { VersionParser } from "../fabriclike/version/VersionParser.js";
import { ModLoadingIssue } from "../loader.js";
import { DependencyObject, QuiltModJson, QuiltVersionInfo } from "./quilt_schemas.js";
export class QuiltLoader extends FabricLikeLoader<QuiltVersionInfo, QuiltModJson> {
    metaURL = "https://meta.quiltmc.org/v3";
    loaderMaven = "https://maven.quiltmc.org/repository/release/";
    hashedMaven = "https://maven.quiltmc.org/repository/release/";
    findInVersion(MCVersion: MCVersion): string | undefined {
        let ret: string | undefined;
        MCVersion.libraries.forEach(i=>{
            if(i.name.includes(":quilt-loader:")){
                ret = i.name.split(":")[2];
            }
        });
        return ret;
    }
    async findModInfos(path: string): Promise<ModInfo<QuiltModJson | FabricModJson>[]> {
        const zip = new StreamZip.async({
            file: path
        });
        const entry = await zip.entry("quilt.mod.json");
        if(entry === undefined) {
            try {
                return super.findModInfosInZip(zip);
            } finally {
                await zip.close();
            }
        }
        const json: QuiltModJson = JSON.parse(transformJSON((await zip.entryData(entry)).toString()));
        const result: ModInfo<QuiltModJson | FabricModJson>[] = await super.findModInfosInZip(zip);
        if(json.quilt_loader.jars !== undefined){
            for (const jar of json.quilt_loader.jars) {
                const paths = jar.split("/");
                const filename = `${tmpdir()}/${paths[paths.length-1]}`;
                await zip.extract(jar, filename);
                result.push(...await this.findModInfos(filename));
            }
        }
        const info = new ModInfo("quilt", json, this.launcher);
        info.data = json;
        result.push(info);
        await zip.close();
        return result;
    }
    checkMods(mods: ModInfo<QuiltModJson | FabricModJson>[], mc: string, loader: string): ModLoadingIssue[] {
        const modIdVersions: Record<string, string> = {
            minecraft: normalizeVersion(mc),
            quilt_loader: loader,
            fabricloader: "Provided",
            java: "Provided"
        };
        const issues: ModLoadingIssue[] = [];
        for (const mod of mods) {
            if("quilt_loader" in mod.data){
                if (!modIdVersions[mod.data.quilt_loader.id] || VersionParser.parse(modIdVersions[mod.data.quilt_loader.id], false).compareTo(VersionParser.parse(mod.data.quilt_loader.version, false)) <= 0) {
                    modIdVersions[mod.data.quilt_loader.id] = mod.data.quilt_loader.version;
                }
                if(mod.data.quilt_loader.provides){
                    for (const provide of mod.data.quilt_loader.provides) {
                        modIdVersions[provide.id] = provide.version;
                    }
                }
            } else {
                if (!modIdVersions[mod.data.id] || VersionParser.parse(modIdVersions[mod.data.id], false).compareTo(VersionParser.parse(mod.data.version, false)) <= 0) {
                    modIdVersions[mod.data.id] = mod.data.version;
                }
                if(mod.data.provides){
                    for (const provide of mod.data.provides) {
                        modIdVersions[provide] = "Provided";
                    }
                }
            }
        }
        for (const mod of mods) {
            if("quilt_loader" in mod.data){
                const data = mod.data.quilt_loader;
                deps:
                for (const dep of processDeps(data.depends)) {
                    const unlesses = processDeps(dep.unless);
                    for (const unless of unlesses) {
                        if(unless.id in modIdVersions && checkMatch(modIdVersions[unless.id], unless.versions ?? "*")){
                            break deps;
                        }
                    }
                    if(unlesses.length !== 0){
                        if(!(dep.id in modIdVersions) || !checkMatch(modIdVersions[dep.id], dep.versions ?? "*")){
                            if(dep.reason)issues.push(new ModLoadingIssue("error", "dependencies.dependency_wrong_missing_reason_unless",
                                {
                                    source: data.id,
                                    target: dep.id,
                                    targetVersion: formatDepVersion(dep.versions ?? "*", this.launcher),
                                    reason: dep.reason,
                                    unless: formatUnless(unlesses, this.launcher)
                                }));
                            else issues.push(new ModLoadingIssue("error", "dependencies.dependency_wrong_missing_unless",
                                {
                                    source: data.id,
                                    target: dep.id,
                                    targetVersion: formatDepVersion(dep.versions ?? "*", this.launcher),
                                    unless: formatUnless(unlesses, this.launcher)
                                }));
                        }
                    } else {
                        if(!(dep.id in modIdVersions) || !checkMatch(modIdVersions[dep.id], dep.versions ?? "*")){
                            if(dep.reason)issues.push(new ModLoadingIssue("error", "dependencies.dependency_wrong_missing_reason",
                                {
                                    source: data.id,
                                    target: dep.id,
                                    targetVersion: formatDepVersion(dep.versions ?? "*", this.launcher),
                                    reason: dep.reason
                                }));
                            else issues.push(new ModLoadingIssue("error", "dependencies.dependency_wrong_missing",
                                {
                                    source: data.id,
                                    target: dep.id,
                                    targetVersion: formatDepVersion(dep.versions ?? "*", this.launcher)
                                }));
                        }
                    }
                }
                brks:
                for (const brk of processDeps(data.breaks)) {
                    const unlesses = processDeps(brk.unless);
                    for (const unless of unlesses) {
                        if(unless.id in modIdVersions && checkMatch(modIdVersions[unless.id], unless.versions ?? "*")){
                            break brks;
                        }
                    }
                    if(unlesses.length !== 0) {
                        if(brk.id in modIdVersions && checkMatch(modIdVersions[brk.id], brk.versions ?? "*")){
                            if(brk.reason)issues.push(new ModLoadingIssue("error", "dependencies.breaks_exists_reason_unless",
                                {
                                    source: data.id,
                                    target: brk.id,
                                    targetVersion: formatDepVersion(brk.versions ?? "*", this.launcher),
                                    reason: brk.reason,
                                    unless: formatUnless(unlesses, this.launcher)
                                }));
                            else issues.push(new ModLoadingIssue("error", "dependencies.breaks_exists_unless",
                                {
                                    source: data.id,
                                    target: brk.id,
                                    targetVersion: formatDepVersion(brk.versions ?? "*", this.launcher),
                                    unless: formatUnless(unlesses, this.launcher)
                                }));
                        }
                    } else {
                        if(brk.id in modIdVersions && checkMatch(modIdVersions[brk.id], brk.versions ?? "*")){
                            if(brk.reason)issues.push(new ModLoadingIssue("error", "dependencies.breaks_exists_reason",
                                {
                                    source: data.id,
                                    target: brk.id,
                                    targetVersion: formatDepVersion(brk.versions ?? "*", this.launcher),
                                    reason: brk.reason
                                }));
                            else issues.push(new ModLoadingIssue("error", "dependencies.breaks_exists",
                                {
                                    source: data.id,
                                    target: brk.id,
                                    targetVersion: formatDepVersion(brk.versions ?? "*", this.launcher)
                                }));
                        }
                    }
                }
            } else {
                issues.push(...checkFabricDeps(mod.data, modIdVersions, this.launcher));
            }
        }
        return issues;
    }

    
    getModInfo(modJson: QuiltModJson): ModDisplayInfo {
        const meta = modJson.quilt_loader.metadata;
        const res: ModDisplayInfo = {
            id: modJson.quilt_loader.id,
            version: modJson.quilt_loader.version,
            isJIJLib: false
        };
        if(meta) {
            if(meta.description) res.description = meta.description;
            if(meta.name) res.name = meta.name;
            if(meta.license instanceof Array) {
                res.license = meta.license.join(", ");
            } else if(!(meta.license instanceof Object)) {
                res.license = meta.license ?? "ARR";
            } else {
                res.license = meta.license.name;
            }
        }
        return res;
    }
}

function processDeps(deps?: DependencyObject[] | DependencyObject | string): DependencyObject[] {
    let ret: DependencyObject[] = [];
    if(typeof(deps) === "string"){
        ret = [{
            id: deps
        }];
    } else {
        if(deps instanceof Array){
            ret = deps.map(processDeps).flat();
        } else if(deps instanceof Object){
            ret = [deps];
        }
    }
    return ret;
}
function formatUnless(unlesses: DependencyObject[], launcher: Launcher): string {
    return unlesses.map(
        (v) => `${v.id} ${launcher.i18n("misc.version")} ${formatDepVersion(v.versions ?? "*", launcher)}`
    ).join(`\n${launcher.i18n("misc.or")} `);
}

