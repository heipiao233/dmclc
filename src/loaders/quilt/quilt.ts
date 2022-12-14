import * as nsz from "node-stream-zip";
import { tmpdir } from "os";
import { ModInfo } from "../../mods/mod.js";
import { MCVersion } from "../../schemas.js";
import { checkFabricDeps } from "../fabric.js";
import { checkMatch, FabricLikeLoader, formatDepVersion } from "../fabriclike/fabriclike.js";
import { FabricModJson } from "../fabric_schemas.js";
import { ModLoadingIssue } from "../loader.js";
import { DependencyObject, QuiltModJson, QuiltVersionInfo } from "./quilt_schemas.js";
export class QuiltLoader extends FabricLikeLoader<QuiltVersionInfo, QuiltModJson> {
    metaURL = "https://meta.quiltmc.org/v3";
    loaderMaven = "https://maven.quiltmc.org/repository/release/";
    hashedMaven = "https://maven.quiltmc.org/repository/release/";
    findInVersion(MCVersion: MCVersion): string | null {
        let ret: string | null = null;
        MCVersion.libraries.forEach(i=>{
            if(i.name.includes(":quilt-loader:")){
                ret = i.name.split(":")[2];
            }
        });
        return ret;
    }
    async findModInfos(path: string): Promise<ModInfo<QuiltModJson | FabricModJson>[]> {
        const zip = new nsz.async({
            file: path
        });
        const entry = await zip.entry("quilt.mod.json");
        if(entry === undefined)return super.findModInfos(path);
        const result: ModInfo<QuiltModJson | FabricModJson>[] = await super.findModInfos(path);
        const json: QuiltModJson = JSON.parse(zip.entryData(entry).toString());
        if(json.quilt_loader.jars !== undefined){
            for (const jar of json.quilt_loader.jars) {
                const paths = jar.split("/");
                const filename = `${tmpdir()}/${paths[paths.length-1]}`;
                await zip.extract(jar, filename);
                result.push(...await this.findModInfos(filename));
            }
        }
        const info = new ModInfo("quilt", json);
        info.data = json;
        result.push(info);
        return result;
    }
    checkMods(mods: ModInfo<QuiltModJson | FabricModJson>[], mc: string, loader: string): ModLoadingIssue[] {
        const modIdVersions: Record<string, string> = {
            minecraft: mc,
            quilt_loader: loader
        };
        const issues: ModLoadingIssue[] = [];
        for (const mod of mods) {
            if("quilt_loader" in mod.data){
                if(mod.data.quilt_loader.id in modIdVersions) {
                    issues.push(new ModLoadingIssue("error", "dmclc.mods.duplicated", [mod.data.quilt_loader.id]));
                } else {
                    modIdVersions[mod.data.quilt_loader.id] = mod.data.quilt_loader.version;
                }
            } else {
                if(mod.data.id in modIdVersions) {
                    issues.push(new ModLoadingIssue("error", "dmclc.mods.duplicated", [mod.data.id]));
                } else {
                    modIdVersions[mod.data.id] = mod.data.version;
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
                            if(dep.reason)issues.push(new ModLoadingIssue("error", "dmclc.mods.dependency_wrong_missing_reason_unless",
                                [data.id, dep.id, formatDepVersion(dep.versions ?? "*"), dep.reason, formatUnless(unlesses)]));
                            else issues.push(new ModLoadingIssue("error", "dmclc.mods.dependency_wrong_missing_unless",
                                [data.id, dep.id, formatDepVersion(dep.versions ?? "*"), formatUnless(unlesses)]));
                        }
                    } else {
                        if(!(dep.id in modIdVersions) || !checkMatch(modIdVersions[dep.id], dep.versions ?? "*")){
                            if(dep.reason)issues.push(new ModLoadingIssue("error", "dmclc.mods.dependency_wrong_missing_reason",
                                [data.id, dep.id, formatDepVersion(dep.versions ?? "*"), dep.reason]));
                            else issues.push(new ModLoadingIssue("error", "dmclc.mods.dependency_wrong_missing",
                                [data.id, dep.id, formatDepVersion(dep.versions ?? "*")]));
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
                            if(brk.reason)issues.push(new ModLoadingIssue("error", "dmclc.mods.breaks_exists_reason_unless",
                                [data.id, brk.id, formatDepVersion(brk.versions ?? "*"), brk.reason, formatUnless(unlesses)]));
                            else issues.push(new ModLoadingIssue("error", "dmclc.mods.breaks_exists_unless",
                                [data.id, brk.id, formatDepVersion(brk.versions ?? "*"), formatUnless(unlesses)]));
                        }
                    } else {
                        if(brk.id in modIdVersions && checkMatch(modIdVersions[brk.id], brk.versions ?? "*")){
                            if(brk.reason)issues.push(new ModLoadingIssue("error", "dmclc.mods.breaks_exists_reason",
                                [data.id, brk.id, formatDepVersion(brk.versions ?? "*"), brk.reason]));
                            else issues.push(new ModLoadingIssue("error", "dmclc.mods.breaks_exists",
                                [data.id, brk.id, formatDepVersion(brk.versions ?? "*")]));
                        }
                    }
                }
            } else {
                issues.push(...checkFabricDeps(mod.data, modIdVersions));
            }
        }
        return issues;
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
            ret = deps;
        } else if(deps instanceof Object){
            ret = [deps];
        }
    }
    return ret;
}
function formatUnless(unlesses: DependencyObject[]): string {
    return unlesses.map(
        (v) => `${v.id} version ${formatDepVersion(v.versions ?? "*")}`
    ).join("\nor ");
}

