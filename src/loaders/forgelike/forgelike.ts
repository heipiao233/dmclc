import { execFileSync } from "child_process";
import compressing from "compressing";
import fs from "fs";
import fsextra from "fs-extra";
import got from "got";
import { ArtifactVersion, ComparableVersion, VersionRange } from "maven-artifact-version";
import StreamZip from "node-stream-zip";
import nodePath from "path";
import toml from "toml";
import { parseStringPromise } from "xml2js";
import { Launcher, } from "../../launcher.js";
import { ModDisplayInfo, ModInfo } from "../../mods/mod.js";
import { MCVersion } from "../../schemas.js";
import { merge } from "../../utils/MergeVersionJSONs.js";
import { checkFile } from "../../utils/check_file.js";
import { downloadIntoStream } from "../../utils/downloads.js";
import { expandMavenId } from "../../utils/maven.js";
import { transformJSON } from "../../utils/transformJSON.js";
import { MinecraftVersion } from "../../version.js";
import { Loader, ModLoadingIssue } from "../loader.js";
import { ForgeJarJarJson, ForgeMcmodInfo, ForgeMcmodInfoOne, ForgeModsToml, StoreData } from "./forge_schemas.js";
import { InstallerProfileNew } from "./install_profile_new.js";
import { InstallerProfileOld } from "./install_profile_old.js";
import * as fsPromises from "fs/promises";
import * as streamPromises from "stream/promises";
let temp = (await import("temp")).track();

export abstract class ForgeLikeLoader implements Loader<StoreData | ForgeMcmodInfoOne> {
    private readonly launcher: Launcher;
    protected abstract readonly mavenArtifactURL: string;
    protected abstract readonly supportsOld: boolean;
    abstract name: string;
    constructor (launcher: Launcher) {
        this.launcher = launcher;
    }
    
    abstract findInVersion(MCVersion: MCVersion): string | undefined;
    abstract getArchiveBaseName(MCVersion: string): string;
    abstract matchVersion(loader: string, mc: string): boolean;

    async getSuitableLoaderVersions (MCVersion: MinecraftVersion): Promise<string[]> {
        if(MCVersion.extras.version === "Unknown") {
            await this.launcher.error("loaders.minecraft_version_unknown");
        }
        const [, major, minor] = MCVersion.extras.version.split(".");
        const majorn = parseInt(major);
        const minorn = parseInt(minor);
        if (majorn < 5 || (majorn === 5 && minorn != 2) ) {
            return [];
        }
        const res = await got(`${this.mavenArtifactURL}/${this.getArchiveBaseName(MCVersion.extras.version)}/maven-metadata.xml`);
        const obj = await parseStringPromise(res.body);
        const versions: string[] = obj.metadata.versioning[0].versions[0].version;
        return versions.filter((v: string) => this.matchVersion(v, MCVersion.extras.version));
    }

    async install (MCVersion: MinecraftVersion, version: string): Promise<boolean> {
        if(MCVersion.extras.version === "Unknown") {
            await this.launcher.error("loaders.minecraft_version_unknown");
            return false;
        }
        let abn = this.getArchiveBaseName(MCVersion.extras.version);
        const path = temp.createWriteStream({prefix: `${abn}-${version}_installer`, suffix: ".jar"});
        if (!await downloadIntoStream(`${this.mavenArtifactURL}/${abn}/${version}/${abn}-${version}-installer.jar`, path, this.launcher)) {
            return false;
        }
        path.end();
        const installerPath = await temp.mkdir(`${abn}_installer`);
        await compressing.zip.uncompress(path.path, installerPath);
        const metadata: InstallerProfileNew | InstallerProfileOld = JSON.parse(fs.readFileSync(`${installerPath}/install_profile.json`).toString());
        
        if("processors" in metadata){ // 1.13+
            if ("MOJMAPS" in metadata.data) {
                const id = metadata.data.MOJMAPS.client.substring(1, metadata.data.MOJMAPS.client.length - 1);
                await MCVersion.completeLibraries([
                    {
                        downloads: {
                            artifact: Object.assign({
                                path: expandMavenId(id)
                            }, MCVersion.versionObject.downloads.client_mappings),
                        },
                        name: id,
                    },
                ]);
            }
            if (fs.existsSync(`${installerPath}/maven`)) await fsextra.copy(`${installerPath}/maven`, `${this.launcher.rootPath}/libraries`);
            if (!await MCVersion.completeLibraries(metadata.libraries)) {
                return false;
            }
            const target: MCVersion = MCVersion.versionObject;
            const source: MCVersion = JSON.parse(fs.readFileSync(`${installerPath}/version.json`).toString());
            const result = merge(target, source);
            MCVersion.versionObject = result;
            await MCVersion.completeLibraries(source.libraries);
            
            for (const item of metadata.processors) {
                if (item.args.includes("DOWNLOAD_MOJMAPS")) {
                    continue;
                }
                if (item.sides === undefined || item.sides.includes("client")) {
                    let res = false;
                    if ("outputs" in item) {
                        const outputs = item.outputs;
                        res = true;
                        for (const k in outputs) {
                            if (Object.prototype.hasOwnProperty.call(outputs, k)) {
                                const v = outputs[k];
                                res &&= await checkFile(this.transformArguments(k, installerPath, MCVersion, metadata), this.transformArguments(v, installerPath, MCVersion, metadata));
                            }
                        }
                    }
                    if (res) continue;
                    const jar = `${this.launcher.rootPath}/libraries/${expandMavenId(item.jar)}`;
                    const args = ["-cp",
                        `${item.classpath.map((i) => {
                            return `${this.launcher.rootPath}/libraries/${expandMavenId(i)}`;
                        }).join(nodePath.delimiter)}${nodePath.delimiter}${jar}`,
                        await getMainClass(jar),
                        ...item.args.map((v) => this.transformArguments(v, installerPath, MCVersion, metadata))];
                    execFileSync(this.launcher.usingJava, args);
                }
            }
            fs.writeFileSync(`${this.launcher.rootPath}/versions/${MCVersion.name}/${MCVersion.name}.json`, JSON.stringify(result));
        } else if (this.supportsOld) { // 1.12-
            const target: MCVersion = MCVersion.versionObject;
            const source: MCVersion = metadata.versionInfo;
            const result = merge(target, source);
            MCVersion.versionObject = result;
            fs.writeFileSync(`${this.launcher.rootPath}/versions/${MCVersion.name}/${MCVersion.name}.json`, JSON.stringify(result));
            fsextra.copyFile(`${installerPath}/${metadata.install.filePath}`, `${this.launcher.rootPath}/libraries/${expandMavenId(metadata.install.path)}`);
        }
        fsPromises.rm(installerPath, {recursive: true, force: true});
        return false;
    }

    transformArguments (arg: string, installerPath: string, MCVersion: MinecraftVersion, metadata: InstallerProfileNew): string {
        return arg.replaceAll(/\{(.+?)\}/g, (v, a) => {
            if (a === "SIDE") return "client";
            if (a === "MINECRAFT_JAR") return `${MCVersion.versionRoot}/${MCVersion.name}.jar`;
            if (a === "BINPATCH") return `${installerPath}/data/client.lzma`;
            return metadata.data[a].client;
        }).replaceAll(/\[(.+?)\]/g, (v, a) => `${this.launcher.rootPath}/libraries/${expandMavenId(a)}`);
    }
    async findModInfos(path: string): Promise<ModInfo<StoreData | ForgeMcmodInfoOne>[]> {
        const zip = new StreamZip.async({
            file: path
        });
        const ret: ModInfo<StoreData | ForgeMcmodInfoOne>[] = [];
        const jarJarEntry = await zip.entry("META-INF/jarjar/metadata.json");
        if(jarJarEntry) {
            const data: ForgeJarJarJson = JSON.parse(transformJSON((await zip.entryData(jarJarEntry)).toString()));
            for (const jarObj of data.jars) {
                const file = temp.createWriteStream();
                streamPromises.pipeline(await zip.stream(jarObj.path), file);
                file.close();
                ret.push(...await this.findModInfos(file.path as string));
            }
        }
        const newEntry = await zip.entry("META-INF/mods.toml");
        if(newEntry){
            const data: ForgeModsToml = toml.parse((await zip.entryData(newEntry)).toString());
            for (const i of data.mods) {
                if(i.version === "${file.jarVersion}"){
                    i.version = await getVersion(zip);
                }
                if(data.dependencies)
                    ret.push(new ModInfo(this.name, {
                        info: i,
                        deps: data.dependencies[i.modId],
                        jar: data
                    }, this.launcher));
                else
                    ret.push(new ModInfo(this.name, {
                        info: i,
                        jar: data
                    }, this.launcher));
            }
        }
        if (!this.supportsOld) return ret;
        const oldEntry = await zip.entry("mcmod.info");
        if(oldEntry) {
            const data: ForgeMcmodInfo = JSON.parse(transformJSON((await zip.entryData(oldEntry)).toString()));
            for (const i of data) {
                ret.push(new ModInfo("forge", i, this.launcher));
            }
        }
        await zip.close();
        return ret;
    }
    checkMods(mods: ModInfo<StoreData | ForgeMcmodInfoOne>[], mc: string, loader: string): ModLoadingIssue[] {
        const ret: ModLoadingIssue[] = [];
        loader = loader.split("-").pop()!;
        const modIdVersions: Record<string, string> = {
            minecraft: mc,
            forge: loader,
            Forge: loader
        };
        for (const mod of mods) {
            if("info" in mod.data){
                if (!modIdVersions[mod.data.info.modId] || new ComparableVersion(modIdVersions[mod.data.info.modId]).compareTo(new ComparableVersion(mod.data.info.version)) < 0)
                    modIdVersions[mod.data.info.modId] = mod.data.info.version;
            } else {
                if (!modIdVersions[mod.data.modid] || new ComparableVersion(modIdVersions[mod.data.modid]).compareTo(new ComparableVersion(mod.data.version ?? "999.999.999")) < 0)
                    modIdVersions[mod.data.modid] = mod.data.version ?? "";
            }
        }
        for (const mod of mods) {
            if("info" in mod.data){
                if(mod.data.deps)
                    for (const dep of mod.data.deps) {
                        if(dep.mandatory) {
                            const range = VersionRange.createFromVersionSpec(dep.versionRange);
                            if(!(dep.modId in modIdVersions&&range?.containsVersion(ArtifactVersion.of(modIdVersions[dep.modId])))) {
                                ret.push(new ModLoadingIssue("error", "dependencies.dependency_wrong_missing",
                                    {
                                        source: mod.data.info.modId,
                                        target: dep.modId,
                                        targetVersion: dep.versionRange
                                    }));
                            }
                        }
                    }
            } else if(parseInt(mc.split(".")[1])<=12 && this.supportsOld) {
                if(mod.data.useDependencyInformation) {
                    if(mod.data.requiredMods)
                        for (const dep of mod.data.requiredMods) {
                            if(dep.includes("@")) {
                                const [depid, depver] = dep.split("@");
                                const range = VersionRange.createFromVersionSpec(depver);
                                if(!(depid in modIdVersions&&range?.containsVersion(ArtifactVersion.of(modIdVersions[depid])))) {
                                    ret.push(new ModLoadingIssue("error", "dependencies.dependency_wrong_missing",
                                        {
                                            source: mod.data.modid,
                                            target: depid,
                                            targetVersion: depver
                                        }));
                                }
                            } else {
                                if(!(dep in modIdVersions)){
                                    ret.push(new ModLoadingIssue("error", "dependencies.dependency_wrong_missing",
                                        {
                                            source: mod.data.modid,
                                            target: dep,
                                            targetVersion: this.launcher.i18n("misc.any")
                                        }));
                                }
                            }
                        }
                }
                if(mod.data.mcversion && !(mod.data.mcversion === mc)) {
                    ret.push(new ModLoadingIssue("error", "dependencies.minecraft_wrong",
                        {
                            source: mod.data.modid,
                            current: mc,
                            need: mod.data.mcversion
                        }));
                }
            }
        }
        return ret;
    }

    getModInfo(mod: StoreData | ForgeMcmodInfoOne): ModDisplayInfo {
        if("info" in mod) {
            return {
                id: mod.info.modId,
                version: mod.info.version,
                name: mod.info.displayName,
                description: mod.info.description,
                license: mod.jar.license,
                isJIJLib: false
            };
        }
        return {
            id: mod.modid,
            version: mod.version ?? "",
            name: mod.name,
            description: mod.description,
            isJIJLib: false
        };
    }
}
async function getMainClass (jar: string): Promise<string> {
    /* eslint-disable new-cap */
    const zip = new StreamZip.async({
        file: jar
    });
    const ret = (await zip.entryData("META-INF/MANIFEST.MF")).toString().split("\n").filter(i => i.startsWith("Main-Class:"))[0].replaceAll("Main-Class:", "").trim();
    await zip.close();
    return ret;
}

async function getVersion (jar: StreamZip.StreamZipAsync): Promise<string> {
    /* eslint-disable new-cap */
    return (await jar.entryData("META-INF/MANIFEST.MF")).toString().split("\n").filter(i => i.startsWith("Implementation-Version:"))[0]?.replaceAll("Implementation-Version:", "").trim();
}
