import { execFileSync } from "child_process";
import compressing from "compressing";
import fs from "fs";
import fsextra from "fs-extra";
import got from "got";
import { ArtifactVersion, VersionRange } from "maven-artifact-version";
import StreamZip from "node-stream-zip";
import { tmpdir } from "os";
import toml from "toml";
import { parseStringPromise } from "xml2js";
import { FormattedError } from "../../errors/FormattedError.js";
import { Launcher } from "../../launcher.js";
import { ModDisplayInfo, ModInfo } from "../../mods/mod.js";
import { MCVersion } from "../../schemas.js";
import { download } from "../../utils/downloads.js";
import { expandMavenId } from "../../utils/maven.js";
import { merge } from "../../utils/MergeVersionJSONs.js";
import { MinecraftVersion } from "../../version.js";
import { Loader, ModLoadingIssue } from "../loader.js";
import { ForgeJarJarJson, ForgeMcmodInfo, ForgeMcmodInfoOne, ForgeModsToml, StoreData } from "./forge_schemas.js";
import { InstallerProfileNew } from "./install_profile_new.js";
import { InstallerProfileOld } from "./install_profile_old.js";

export class ForgeLoader implements Loader<StoreData | ForgeMcmodInfoOne> {
    private readonly launcher: Launcher;
    private readonly metadata = "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";
    constructor (launcher: Launcher) {
        this.launcher = launcher;
    }
    
    findInVersion(MCVersion: MCVersion): string | undefined {
        for (const i of MCVersion.libraries) {
            if(i.name.includes(":forge:")){
                return i.name.split(":")[2].split("-")[1];
            }
        }
    }

    async getSuitableLoaderVersions (MCVersion: MinecraftVersion): Promise<string[]> {
        if(MCVersion.extras.version === "Unknown") {
            throw new FormattedError(this.launcher.i18n("loaders.minecraft_version_unknown"));
        }
        const res = await got(this.metadata);
        const obj = await parseStringPromise(res.body);
        const versions: string[] = obj.metadata.versioning[0].versions[0].version;
        return versions.filter((v: string) => v.startsWith(`${MCVersion}-`));
    }

    async install (MCVersion: MinecraftVersion, version: string): Promise<void> {
        if(MCVersion.extras.version === "Unknown") {
            throw new FormattedError(this.launcher.i18n("loaders.minecraft_version_unknown"));
        }
        const path = `${tmpdir()}/forge-${version}-installer.jar`;
        await download(`https://maven.minecraftforge.net/net/minecraftforge/forge/${version}/forge-${version}-installer.jar`, path, this.launcher.mirror);
        const installer = `${tmpdir()}/${this.launcher.name}_forge_installer`;
        await compressing.zip.uncompress(fs.createReadStream(path), installer);
        const metadata0 = JSON.parse(fs.readFileSync(`${installer}/install_profile.json`).toString());
        
        if(Number.parseInt(MCVersion.extras.version.split(".")[1])>12){ // 1.13+
            const metadata1: InstallerProfileNew = metadata0;
            await fsextra.copy(`${installer}/maven`, `${this.launcher.rootPath}/libraries`);
            await MCVersion.completeLibraries(metadata1.libraries);
            const target: MCVersion = JSON.parse(fs.readFileSync(`${this.launcher.rootPath}/versions/${MCVersion.name}/${MCVersion.name}.json`).toString());
            const source: MCVersion = JSON.parse(fs.readFileSync(`${installer}/version.json`).toString());
            const result = merge(target, source);
            await MCVersion.completeLibraries(source.libraries);
            
            for (const item of metadata1.processors) {
                if (item.sides === undefined || item.sides.includes("client")) {
                    const jar = `${this.launcher.rootPath}/libraries/${expandMavenId(item.jar)}`;
                    const args = ["-cp",
                        `${item.classpath.map((i) => {
                            return `${this.launcher.rootPath}/libraries/${expandMavenId(i)}`;
                        }).join(this.launcher.separator)};${jar}`,
                        await getMainClass(jar),
                        ...item.args.map((v) => this.transformArguments(v, MCVersion, metadata1))];
                    console.log(args);
                    console.log(execFileSync(this.launcher.usingJava, args).toString());
                }
            }
            fs.writeFileSync(`${this.launcher.rootPath}/versions/${MCVersion.name}/${MCVersion.name}.json`, JSON.stringify(result));
        } else { // 1.12-
            const metadata1: InstallerProfileOld = metadata0;
            const target: MCVersion = JSON.parse(fs.readFileSync(`${this.launcher.rootPath}/versions/${MCVersion.name}/${MCVersion.name}.json`).toString());
            const source: MCVersion = metadata1.versionInfo;
            const result = merge(target, source);
            fs.writeFileSync(`${this.launcher.rootPath}/versions/${MCVersion.name}/${MCVersion.name}.json`, JSON.stringify(result));
        }
    }

    transformArguments (arg: string, MCVersion: MinecraftVersion, metadata: InstallerProfileNew): string {
        return arg.replaceAll(/\{(.+?)\}/g, (v, a) => {
            if (a === "SIDE") return "client";
            if (a === "MINECRAFT_JAR") return `${MCVersion.versionRoot}/${MCVersion.name}.jar`;
            if (a === "BINPATCH") return `${tmpdir()}/${this.launcher.name}_forge_installer/data/client.lzma`;
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
            const data: ForgeJarJarJson = JSON.parse((await zip.entryData(jarJarEntry)).toString());
            for (const jarObj of data.jars) {
                const jar = jarObj.path;
                const paths = jar.split("/");
                const filename = `${tmpdir()}/${paths[paths.length-1]}`;
                await zip.extract(jar, filename);
                ret.push(...await this.findModInfos(filename));
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
                    ret.push(new ModInfo("forge", {
                        info: i,
                        deps: data.dependencies[i.modId],
                        jar: data
                    }));
                else
                    ret.push(new ModInfo("forge", {
                        info: i,
                        jar: data
                    }));
            }
        }
        const oldEntry = await zip.entry("mcmod.info");
        if(oldEntry) {
            const data: ForgeMcmodInfo = JSON.parse((await zip.entryData(oldEntry)).toString());
            for (const i of data) {
                ret.push(new ModInfo("forge", i));
            }
        }
        await zip.close();
        return ret;
    }
    checkMods(mods: ModInfo<StoreData | ForgeMcmodInfoOne>[], mc: string, loader: string): ModLoadingIssue[] {
        const ret: ModLoadingIssue[] = [];
        const modIdVersions: Record<string, string> = {
            minecraft: mc,
            forge: loader,
            Forge: loader
        };
        for (const mod of mods) {
            if("info" in mod.data){
                modIdVersions[mod.data.info.modId] = mod.data.info.version;
            } else {
                modIdVersions[mod.data.modid] = mod.data.version ?? "";
            }
        }
        for (const mod of mods) {
            if("info" in mod.data){
                if(mod.data.deps)
                    for (const dep of mod.data.deps) {
                        if(dep.mandatory) {
                            const range = VersionRange.createFromVersionSpec(dep.versionRange)!;
                            if(!(dep.modId in modIdVersions&&range.containsVersion(ArtifactVersion.of(modIdVersions[dep.modId])))) {
                                ret.push(new ModLoadingIssue("error", "dependencies.dependency_wrong_missing",
                                    {
                                        source: mod.data.info.modId,
                                        target: dep.modId,
                                        targetVersion: dep.versionRange
                                    }));
                            }
                        }
                    }
            } else if(parseInt(mc.split(".")[1])<=12) {
                if(mod.data.useDependencyInformation) {
                    if(mod.data.requiredMods)
                        for (const dep of mod.data.requiredMods) {
                            if(dep.includes("@")) {
                                const [depid, depver] = dep.split("@");
                                const range = VersionRange.createFromVersionSpec(depver)!;
                                if(!(depid in modIdVersions&&range.containsVersion(ArtifactVersion.of(modIdVersions[depid])))) {
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
                                            targetVersion: this.launcher.i18n("any")
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
            };
        }
        return {
            id: mod.modid,
            version: mod.version ?? "",
            name: mod.name,
            description: mod.description
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
