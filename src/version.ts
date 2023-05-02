import cp, { ChildProcess } from "child_process";
import compressing from "compressing";
import fs, { PathLike } from "fs";
import { mkdirs } from "fs-extra";
import { readFile, writeFile } from "fs/promises";
import got from "got";
import StreamZip from "node-stream-zip";
import os from "os";
import path from "path";
import { Account } from "./auth/account";
import { FormattedError } from "./errors/FormattedError";
import { Launcher } from "./launcher";
import { Argument, Asset, AssetIndexInfo, AssetsIndex, Library, LibraryArtifact, MCVersion, checkRules } from "./schemas";
import { transformURL } from "./utils/TransformURL";
import { checkFile } from "./utils/check_file";
import { download, downloadAll } from "./utils/downloads";
import { expandInheritsFrom } from "./utils/expand_inherits_from";
import { expandMavenId } from "./utils/maven";

/**
 * @internal
 */
export interface DMCLCExtraVersionInfo {
    version: string;
    loaders: LoaderInfo[];
    enableIndependentGameDir: boolean;
}

/**
 * @internal
 */
export interface LoaderInfo {
    name: string;
    version: string;
}

/**
 * Version.
 * @public
 */
export class MinecraftVersion {
    versionObject: MCVersion;
    extras: DMCLCExtraVersionInfo;
    name: string;
    versionRoot: string;
    versionLaunchWorkDir: string;
    versionJarPath: string;
    /**
     * Creates a new version from name.
     * @param launcher - The launcher instance
     * @param name - The name of this version. The directory name, not always Minecraft version.
     * @returns The new created version object.
     */
    static fromVersionName(launcher: Launcher, name: string, enableIndependentGameDir: boolean = false): MinecraftVersion {
        const version = new MinecraftVersion(launcher, expandInheritsFrom(JSON.parse(fs.readFileSync(`${launcher.rootPath}/versions/${name}/${name}.json`).toString()), launcher.rootPath), enableIndependentGameDir);
        return version;
    }

    /**
     * Creates a new version from JSON object.
     * @param launcher - The launcher instance.
     * @param object - The Version JSON object.
     */
    private constructor(private launcher: Launcher, object: MCVersion, enableIndependentGameDir: boolean) {
        this.versionObject = object;
        this.name = object.id;
        this.versionRoot = `${this.launcher.rootPath}/versions/${this.name}`;
        this.versionJarPath = `${this.versionRoot}/${this.name}.jar`;
        const extraPath = `${this.versionRoot}/dmclc_extras.json`;
        if(!fs.existsSync(extraPath)){
            this.extras = this.detectExtras(enableIndependentGameDir);
            this.saveExtras();
        } else {
            this.extras = JSON.parse(fs.readFileSync(extraPath).toString());
        }
        this.versionLaunchWorkDir = this.extras.enableIndependentGameDir
            ? this.versionRoot
            : this.launcher.rootPath.toString();
    }

    private detectExtras(enableIndependentGameDir: boolean): DMCLCExtraVersionInfo {
        const loaders: LoaderInfo[] = [];
        let version = "Unknown";
        this.launcher.loaders.forEach((v, k)=>{
            const version = v.findInVersion(this.versionObject);
            if(version){
                loaders.push({
                    name: k,
                    version: version
                });
            }
        });
        for (const v of this.versionObject.libraries) {
            if(v.name.includes(":forge:")||v.name.includes(":liteloader:")){
                version = v.name.split(":")[2].split("-")[0];
                break;
            }
        }
        if(version === "Unknown") {
            this.getVersionFromJar();
        }
        return {
            version,
            loaders,
            enableIndependentGameDir
        };
    }
    getVersionFromJar() {
        const zip = new StreamZip({file: this.versionJarPath});
        const entry = zip.entry("version.json");
        if(entry) {
            const obj = JSON.parse((zip.entryDataSync(entry)).toString());
            this.extras.version = obj.id;
        }
        zip.close();
        this.saveExtras();
    }

    /**
     * Run this version!
     * @param account - The using account.
     * @returns The Minecraft process. Both stdout and stderr uses UTF-8.
     */
    async run(account: Account<never>): Promise<ChildProcess> {
        await account.prepareLaunch();
        await this.completeVersionInstall();
        await this.extractNative(this.versionObject, this.name);
        const args = await this.getArguments(this.versionObject, this.name, account);
        const allArguments = ["-Dsun.stdout.encoding=utf-8", "-Dsun.stderr.encoding=utf-8"].concat(await account.getLaunchJVMArgs(this)).concat(args).concat();
        return cp.execFile(this.launcher.usingJava, allArguments, {
            cwd: this.versionLaunchWorkDir
        });
    }

    /**
     * Complete this version installation. Fix wrong libraries, asset files and version.jar. Won't fix version.json.
     */
    async completeVersionInstall() {
        const promises = [];
        if (!fs.existsSync(this.versionJarPath) ||
            !checkFile(this.versionJarPath, this.versionObject.downloads.client.sha1)) {
            promises.push(download(this.versionObject.downloads.client.url, this.versionJarPath, this.launcher));
        }
        promises.push(...(await this.completeAssets(this.versionObject.assetIndex)));
        promises.push(...(await this.completeLibraries(this.versionObject.libraries)));
        return Promise.all(promises);
    }
    private async completeAssets (asset: AssetIndexInfo): Promise<Promise<void>[]> {
        const allDownloads: Map<string, PathLike> = new Map();
        const indexPath = `${this.launcher.rootPath}/assets/indexes/${asset.id}.json`;
        let assetJson;
        if (!fs.existsSync(indexPath)) {
            assetJson = (await got(transformURL(asset.url, this.launcher.mirror))).body;
            await mkdirs(`${this.launcher.rootPath}/assets/indexes`);
            await writeFile(indexPath, assetJson);
        } else {
            assetJson = (await readFile(indexPath)).toString();
        }
        const assetsObjects = `${this.launcher.rootPath}/assets/objects`;
        mkdirs(assetsObjects);
        const assetobj: AssetsIndex = JSON.parse(assetJson);
        for (const assid in assetobj.objects) {
            const assitem: Asset = assetobj.objects[assid];
            if (!fs.existsSync(`${assetsObjects}/${assitem.hash.slice(0, 2)}/${assitem.hash}`) ||
                !checkFile(`${assetsObjects}/${assitem.hash.slice(0, 2)}/${assitem.hash}`, assitem.hash)) {
                mkdirs(`${assetsObjects}/${assitem.hash.slice(0, 2)}`);
                allDownloads.set(`https://resources.download.minecraft.net/${assitem.hash.slice(0, 2)}/${assitem.hash}`, `${assetsObjects}/${assitem.hash.slice(0, 2)}/${assitem.hash}`);
            }
        }
        return downloadAll(allDownloads, this.launcher);
    }

    /**
     * INTERNAL API. MAY BE CHANGE WITHOUT NOTIFY.
     * Fix wrong and missing libraries. Used by Forge installing.
     * @param liblist - All the libraries.
     * @internal
     */
    async completeLibraries (liblist: Library[]): Promise<Promise<void>[]> {
        const allDownloads: Map<string, PathLike> = new Map();
        const used = liblist.filter((i) => {
            return i.rules === undefined || checkRules(i.rules);
        });
        for (const i of used) {
            if (!("downloads" in i)) {
                const filePath = expandMavenId(i.name);
                await mkdirs(`${this.launcher.rootPath}/libraries/${path.dirname(filePath)}`);
                let url: string;
                if (!("url" in i)) url = "https://libraries.minecraft.net/";
                else url = i.url;
                allDownloads.set(`${url}${filePath}`, `${this.launcher.rootPath}/libraries/${filePath}`);
            } else {
                const artifacts: LibraryArtifact[]=[];
                if ("artifact" in i.downloads) {
                    artifacts.push(i.downloads.artifact);
                }
                if ("natives" in i) {
                    artifacts.push(i.downloads.classifiers[i.natives[this.launcher.natives].replaceAll("${arch}", os.arch().includes("64")?"64":"32")]);
                }
                for (const artifact of artifacts) {
                    if(!(fs.existsSync(`${this.launcher.rootPath}/libraries/${artifact.path}`)&&checkFile(`${this.launcher.rootPath}/libraries/${artifact.path}`, artifact.sha1))){
                        await mkdirs(`${this.launcher.rootPath}/libraries/${path.dirname(artifact.path)}`);
                        allDownloads.set(artifact.url, `${this.launcher.rootPath}/libraries/${artifact.path}`);
                    }
                }
            }
        }
        return downloadAll(allDownloads, this.launcher);
    }

    private getClassPath (versionObject: MCVersion, versionName: string): string[] {
        const res: string[] = [];
        versionObject.libraries.filter(i => i.rules === undefined || checkRules(i.rules)).forEach((i) => {
            if (!("downloads" in i)) {
                res.push(`${this.launcher.rootPath}/libraries/${expandMavenId(i.name)}`);
            } else if ("artifact" in i.downloads) {
                res.push(`${this.launcher.rootPath}/libraries/${i.downloads.artifact.path}`);
            }
        });
        if (!versionObject.mainClass.startsWith("cpw"))res.push(`${this.launcher.rootPath}/versions/${versionName}/${versionName}.jar`);// Forge
        return res;
    }

    private parseArgument (arg: string | Argument, versionObject: MCVersion, versionName: string, account: Account<never>, argOverrides: Map<string, string>): string {
        let argVal: string;
        if (typeof arg === "object") {
            if (arg.value instanceof Array)argVal = arg.value.join(" ");
            else argVal = arg.value;
        } else argVal = arg;
        argVal = argVal.replaceAll("${version_name}", `${this.launcher.name}`)
            .replaceAll("${game_directory}", ".")
            .replaceAll("${assets_root}", `${this.launcher.rootPath}/assets`)
            .replaceAll("${assets_index_name}", versionObject.assets)
            .replaceAll("${auth_uuid}", `${account.getUUID()}`)
            .replaceAll("${version_type}", `${this.launcher.name}`)
            .replaceAll("${natives_directory}", `${this.launcher.rootPath}/versions/${versionName}/natives`)
            .replaceAll("${launcher_name}", `${this.launcher.name}`)
            .replaceAll("${launcher_version}", "0.1")
            .replaceAll("${library_directory}", `${this.launcher.rootPath}/libraries/`)
            .replaceAll("${classpath_separator}", path.delimiter)
            .replaceAll("${classpath}", this.getClassPath(versionObject, versionName).join(path.delimiter));
        argOverrides.forEach((v, k) => {
            argVal = argVal.replaceAll("${" + k + "}", v);
        });
        return argVal;
    }

    private async getArguments (versionObject: MCVersion, versionName: string, account: Account<never>): Promise<string[]> {
        const res: string[] = [];
        const args = await account.getLaunchGameArgs();
        if ("arguments" in versionObject) {
            versionObject.arguments.jvm?.map(async i => {
                if (typeof (i) === "string") {
                    res.push(this.parseArgument(i, versionObject, versionName, account, args));
                }
            });
            res.push(versionObject.mainClass);
            versionObject.arguments.game?.map(async i => {
                if (typeof (i) === "string") {
                    res.push(this.parseArgument(i, versionObject, versionName, account, args));
                }
            });
        } else {
            res.push(`-Djava.library.path=${this.launcher.rootPath}/versions/${versionName}/natives`);
            res.push("-cp", this.getClassPath(versionObject, versionName).join(path.delimiter));
            res.push(versionObject.mainClass);
            versionObject.minecraftArguments.split(" ").map(async i => {
                if (typeof (i) === "string") {
                    res.push(this.parseArgument(i, versionObject, versionName, account, args));
                }
            });
        }
        return res;
    }
    private async extractNative(version: MCVersion, name: string){
        Promise.all(version.libraries.filter(i => i.rules === undefined || checkRules(i.rules))
            .map(
                async lib=>{
                    if (!("downloads" in lib)) return;
                    if (!("natives" in lib)) return;
                    const native = lib.downloads.classifiers[lib.natives[this.launcher.natives].replace("${arch}", os.arch().includes("64")?"64":"32")];
                    const libpath = `${this.launcher.rootPath}/libraries/${native?.path}`;
                    await compressing.zip.uncompress(libpath, `${this.launcher.rootPath}/versions/${name}/natives`);
                }
            ));
    }

    /**
     * Get all the installable loader versions on this Minecraft version. Doesn't consider loader conflicts.
     * @throws {@link FormattedError}
     * @param name - The name of loader.
     * @returns The versions of loader.
     */
    async getSuitableLoaderVersions(name: string): Promise<string[]> {
        const loader = this.launcher.loaders.get(name);
        if (loader == undefined) {
            throw new FormattedError(`${this.launcher.i18n("version.loader_not_found")}: ${loader}`);
        }
        return loader.getSuitableLoaderVersions(this);
    }
    /**
     * Install a mod loader.
     * @throws {@link FormattedError}
     * @param name - Loader name.
     * @param loaderVersion - Loader version.
     */
    async installLoader(name: string, loaderVersion: string): Promise<void> {
        const loader = this.launcher.loaders.get(name);
        if (loader == undefined) {
            throw new FormattedError(`${this.launcher.i18n("version.loader_not_found")}${loader}`);
        }
        await loader.install(this, loaderVersion);
        this.extras.loaders.push({
            name: name,
            version: loaderVersion
        });
        this.saveExtras();
    }

    saveExtras() {
        fs.writeFileSync(`${this.versionRoot}/dmclc_extras.json`, JSON.stringify(this.extras));
    }
}
