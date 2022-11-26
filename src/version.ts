import { ChildProcess } from "child_process";
import { Account } from "./auth/account.js";
import cp from "child_process";
import { expandInheritsFrom } from "./utils/expand_inherits_from.js";
import { Launcher } from "./launcher.js";
import { Argument, Asset, AssetIndexInfo, AssetsIndex, checkRules, Library, LibraryArtifact, McInstallation } from "./schemas.js";
import fs, { PathLike } from "fs";
import { download, downloadAll } from "./utils/downloads.js";
import * as http_request from "./utils/http_request.js";
import { checkFile } from "./utils/check_file.js";
import { expandMavenId } from "./utils/maven.js";
import path from "path";
import os from "os";
import compressing from "compressing";
import { mkdirs } from "fs-extra";

export declare class DMCLCExtraVersionInfo {
    version: string;
    modules: ModuleInfo[];
    enableIndependentGameDir: boolean;
}
export declare class ModuleInfo {
    name: string;
    version: string;
}

export class Version {
    private launcher: Launcher;
    private versionObject: McInstallation;
    extras: DMCLCExtraVersionInfo;
    name: string;
    versionRoot: string;
    static fromVersionName(launcher: Launcher, name: string): Version {
        const version = new Version(launcher, expandInheritsFrom(JSON.parse(fs.readFileSync(`${launcher.rootPath}/versions/${name}/${name}.json`).toString()), launcher.rootPath));
        return version;
    }
    constructor(launcher: Launcher, object: McInstallation){
        this.launcher = launcher;
        this.versionObject = object;
        this.name = object.id;
        this.versionRoot = `${this.launcher.rootPath}/versions/${this.name}/`;
        this.extras = JSON.parse(fs.readFileSync(`${this.versionRoot}/dmclc_extras.json`).toString());
    }
    async run(account: Account<never>): Promise<ChildProcess> {
        await account.prepareLaunch();
        await this.completeVersionInstall();
        await this.extractNative(this.versionObject, this.name);
        const args = await this.getArguments(this.versionObject, this.name, account);
        const allArguments = (await account.getLaunchJVMArgs()).concat(args);
        console.log(allArguments.join(" "));
        return cp.execFile(this.launcher.usingJava, allArguments, {
            cwd: this.extras.enableIndependentGameDir
                ? this.versionRoot
                : this.launcher.rootPath.toString(),
            encoding: "base64"
        });
    }
    async completeVersionInstall() {
        if (!fs.existsSync(`${this.versionRoot}/${this.name}.jar`) ||
            !checkFile(`${this.versionRoot}/${this.name}.jar`, this.versionObject.downloads.client.sha1)) {
            await download(this.versionObject.downloads.client.url, `${this.versionRoot}/${this.name}.jar`);
        }
        await this.installAssets(this.versionObject.assetIndex);
        await this.installLibraries(this.versionObject.libraries);
    }
    private async installAssets (asset: AssetIndexInfo): Promise<void> {
        const allDownloads: Map<string, PathLike> = new Map();
        const indexPath = `${this.launcher.rootPath}/assets/indexes/${asset.id}.json`;
        let assetJson: string;
        if (!fs.existsSync(indexPath)) {
            assetJson = await http_request.get(asset.url, this.launcher.mirror);
            await mkdirs(`${this.launcher.rootPath}/assets/indexes`);
            fs.writeFileSync(indexPath, assetJson);
        } else {
            assetJson = fs.readFileSync(indexPath).toString();
        }
        await mkdirs(`${this.launcher.rootPath}/assets/objects`);
        const assetobj: AssetsIndex = JSON.parse(assetJson);
        for (const assid in assetobj.objects) {
            const assitem: Asset = assetobj.objects[assid];
            if (!fs.existsSync(`${this.launcher.rootPath}/assets/objects/${assitem.hash.slice(0, 2)}/${assitem.hash}`) ||
                !checkFile(`${this.launcher.rootPath}/assets/objects/${assitem.hash.slice(0, 2)}/${assitem.hash}`, assitem.hash)) {
                await mkdirs(`${this.launcher.rootPath}/assets/objects/${assitem.hash.slice(0, 2)}`);
                console.log(assid);
                allDownloads.set(`https://resources.download.minecraft.net/${assitem.hash.slice(0, 2)}/${assitem.hash}`, `${this.launcher.rootPath}/assets/objects/${assitem.hash.slice(0, 2)}/${assitem.hash}`);
            }
        }
        await downloadAll(allDownloads, this.launcher.mirror);
    }

    private async installLibraries (liblist: Library[]): Promise<void> {
        const allDownloads: Map<string, PathLike> = new Map();
        liblist.filter((i) => {
            return i.rules === undefined || checkRules(i.rules);
        }
        ).forEach(async (i) => {
            if (i.downloads === undefined) {
                const filePath = expandMavenId(i.name);
                await mkdirs(`${this.launcher.rootPath}/libraries/${path.dirname(filePath)}`);
                let url: string;
                if(i.url===undefined)url = "https://libraries.minecraft.net/";
                else url = i.url;
                allDownloads.set(`${url}${filePath}`, `${this.launcher.rootPath}/libraries/${filePath}`);
            } else {
                const artifacts: LibraryArtifact[]=[];
                if (i.downloads.artifact!==undefined) {
                    artifacts.push(i.downloads.artifact);
                }
                if(i.downloads.classifiers!==undefined) {
                    artifacts.push(i.downloads.classifiers[i.natives![this.launcher.natives].replace("${arch}", os.arch().includes("64")?"64":"32")]);
                }
                artifacts.forEach(async artifact=>{
                    if(!(fs.existsSync(`${this.launcher.rootPath}/libraries/${artifact.path}`)&&checkFile(`${this.launcher.rootPath}/libraries/${artifact.path}`, artifact.sha1))){
                        await mkdirs(`${this.launcher.rootPath}/libraries/${path.dirname(artifact.path)}`);
                        console.log(i.name);
                        allDownloads.set(artifact.url, `${this.launcher.rootPath}/libraries/${artifact.path}`);
                    }
                });
            }
        });
        await downloadAll(allDownloads, this.launcher.mirror);
    }

    private getClassPath (versionObject: McInstallation, versionName: string): string[] {
        const res: string[] = [];
        versionObject.libraries.filter(i => i.rules === undefined || checkRules(i.rules)).forEach((i) => {
            if (i.downloads === undefined) {
                res.push(`./libraries/${expandMavenId(i.name)}`);
            } else if (i.downloads.artifact !== undefined){
                res.push(`./libraries/${i.downloads.artifact.path}`);
            }
        });
        if (!versionObject.mainClass.startsWith("cpw"))res.push(`./versions/${versionName}/${versionName}.jar`);// Forge
        return res;
    }

    private parseArgument (arg: string | Argument, versionObject: McInstallation, versionName: string, account: Account<never>, argOverrides: Map<string, string>): string {
        let argVal: string;
        if (typeof arg === "object") {
            if (arg.value instanceof Array)argVal = arg.value.join(" ");
            else argVal = arg.value;
        } else argVal = arg;
        argVal = argVal.replaceAll("${version_name}", `${this.launcher.name}`)
            .replaceAll("${game_directory}", ".")
            .replaceAll("${assets_root}", "./assets")
            .replaceAll("${assets_index_name}", versionObject.assets)
            .replaceAll("${auth_uuid}", `${account.getUUID()}`)
            .replaceAll("${version_type}", `${this.launcher.name}`)
            .replaceAll("${natives_directory}", `./versions/${versionName}/natives`)
            .replaceAll("${launcher_name}", `${this.launcher.name}`)
            .replaceAll("${launcher_version}", "0.1")
            .replaceAll("${library_directory}", "./libraries/")
            .replaceAll("${classpath_separator}", this.launcher.separator)
            .replaceAll("${classpath}", this.getClassPath(versionObject, versionName).join(this.launcher.separator));
        argOverrides.forEach((v, k) => {
            argVal = argVal.replaceAll("${" + k + "}", v);
        });
        return argVal;
    }

    private async getArguments (versionObject: McInstallation, versionName: string, account: Account<never>): Promise<string[]> {
        const res: string[] = [];
        const args = await account.getLaunchGameArgs();
        if (versionObject.arguments !== undefined) {
            versionObject.arguments.jvm.map(async i => {
                if (typeof (i) === "string") {
                    res.push(this.parseArgument(i, versionObject, versionName, account, args));
                }
            });
            res.push(versionObject.mainClass);
            versionObject.arguments.game.map(async i => {
                if (typeof (i) === "string") {
                    res.push(this.parseArgument(i, versionObject, versionName, account, args));
                }
            });
        } else {
            res.push(`-Djava.library.path=./versions/${versionName}/natives`);
            res.push("-cp", this.getClassPath(versionObject, versionName).join(this.launcher.separator));
            res.push(versionObject.mainClass);
            versionObject.minecraftArguments!.split(" ").map(async i => {
                if (typeof (i) === "string") {
                    res.push(this.parseArgument(i, versionObject, versionName, account, args));
                }
            });
        }
        return res;
    }
    private async extractNative(version: McInstallation, name: string){
        Promise.all(version.libraries.filter(i => i.rules === undefined || checkRules(i.rules))
            .filter(lib=>lib.downloads?.classifiers!==undefined).map(
                async lib=>{
                    const native = lib.downloads!.classifiers[lib.natives![this.launcher.natives].replace("${arch}", os.arch().includes("64")?"64":"32")];
                    const libpath = `${this.launcher.rootPath}/libraries/${native?.path}`;
                    await compressing.zip.uncompress(libpath, `${this.launcher.rootPath}/versions/${name}/natives`);
                }
            ));
    }
    async getSuitableModuleVersions(name: string): Promise<string[]> {
        const module_ = this.launcher.moduleTypes.get(name);
        if (module_ == undefined) {
            throw new Error(`Module not found: ${module_}`);
        }
        return module_.getSuitableModuleVersions(this.extras.version);
    }
    async installModule(name: string, versionID: string, moduleVersion: string): Promise<void> {

        const module_ = this.launcher.moduleTypes.get(name);
        if (module_ == undefined) {
            throw new Error(`Module not found: ${module_}`);
        }
        await module_.install(this.extras.version, versionID, moduleVersion);
        this.extras.modules.push({
            name: name,
            version: moduleVersion
        });
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionID}/dmclc_extras.json`, JSON.stringify(this.extras));
    }
}
