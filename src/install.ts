import fs, { PathLike } from "fs";
import * as mkdirs from "./utils/mkdirs.js";
import * as http_request from "./utils/http_request.js";
import * as downloads from "./utils/downloads.js";
import * as path from "path";
import { AssetIndexInfo, McInstallation, Library, VersionInfo, VersionInfos, checkRules, AssetsIndex, Asset, LibraryArtifact } from "./schemas.js";
import { Launcher } from "./launcher.js";
import { checkFile } from "./utils/check_file.js";
import { expandMavenId } from "./utils/maven.js";
import { DMCLCExtraVersionInfo } from "./version.js";
import os from "os";
export class Installer {
    launcher: Launcher;
    constructor (launcher: Launcher) {
        this.launcher = launcher;
    }

    async getVersionList (): Promise<VersionInfos> {
    // url:https://launchermeta.mojang.com/mc/game/version_manifest.json
        const versions: VersionInfos = JSON.parse(await http_request.get("https://launchermeta.mojang.com/mc/game/version_manifest.json", this.launcher.mirror));
        return versions;
    }

    private async installAssets (asset: AssetIndexInfo): Promise<void> {
        const allDownloads: Map<string, PathLike> = new Map();
        const indexPath = `${this.launcher.rootPath}/assets/indexes/${asset.id}.json`;
        let assetJson: string;
        if (!fs.existsSync(indexPath)) {
            assetJson = await http_request.get(asset.url, this.launcher.mirror);
            mkdirs.mkdirs(`${this.launcher.rootPath}/assets/indexes`);
            fs.writeFileSync(indexPath, assetJson);
        } else {
            assetJson = fs.readFileSync(indexPath).toString();
        }
        mkdirs.mkdirs(`${this.launcher.rootPath}/assets/objects`);
        const assetobj: AssetsIndex = JSON.parse(assetJson);
        for (const assid in assetobj.objects) {
            const assitem: Asset = assetobj.objects[assid];
            if (!fs.existsSync(`${this.launcher.rootPath}/assets/objects/${assitem.hash.slice(0, 2)}/${assitem.hash}`) ||
                !checkFile(`${this.launcher.rootPath}/assets/objects/${assitem.hash.slice(0, 2)}/${assitem.hash}`, assitem.hash)) {
                mkdirs.mkdirs(`${this.launcher.rootPath}/assets/objects/${assitem.hash.slice(0, 2)}`);
                console.log(assid);
                allDownloads.set(`https://resources.download.minecraft.net/${assitem.hash.slice(0, 2)}/${assitem.hash}`, `${this.launcher.rootPath}/assets/objects/${assitem.hash.slice(0, 2)}/${assitem.hash}`);
            }
        }
        await downloads.downloadAll(allDownloads, this.launcher.mirror);
    }

    async installLibs (liblist: Library[]): Promise<void> {
        const allDownloads: Map<string, PathLike> = new Map();
        liblist.filter((i) => {
            return i.rules === undefined || checkRules(i.rules);
        }
        ).forEach((i) => {
            if (i.downloads === undefined) {
                const filePath = expandMavenId(i.name);
                mkdirs.mkdirs(`${this.launcher.rootPath}/libraries/${path.dirname(filePath)}`);
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
                artifacts.forEach(artifact=>{
                    if(!(fs.existsSync(`${this.launcher.rootPath}/libraries/${artifact.path}`)&&checkFile(`${this.launcher.rootPath}/libraries/${artifact.path}`, artifact.sha1))){
                        mkdirs.mkdirs(`${this.launcher.rootPath}/libraries/${path.dirname(artifact.path)}`);
                        console.log(i.name);
                        allDownloads.set(artifact.url, `${this.launcher.rootPath}/libraries/${artifact.path}`);
                    }
                });
            }
        });
        await downloads.downloadAll(allDownloads, this.launcher.mirror);
    }

    async install (ver: VersionInfo, versionName: string): Promise<void> {
        const content = await http_request.get(ver.url, this.launcher.mirror);
        const versionObject: McInstallation = JSON.parse(content);
        mkdirs.mkdirs(`${this.launcher.rootPath}/versions/${versionName}`);
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionName}/${versionName}.json`, content);
        await this.install_json(versionName, versionObject);
        const extras: DMCLCExtraVersionInfo = {
            version: ver.id,
            modules: []
        };
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionName}/dmclc_extras.json`, JSON.stringify(extras));
    }

    async install_json (versionName: string, versionObject: McInstallation): Promise<void> {
        if (!fs.existsSync(`${this.launcher.rootPath}/versions/${versionName}/${versionName}.jar`) ||
            !checkFile(`${this.launcher.rootPath}/versions/${versionName}/${versionName}.jar`, versionObject.downloads.client.sha1)) {
            await downloads.download(versionObject.downloads.client.url, `${this.launcher.rootPath}/versions/${versionName}/${versionName}.jar`);
        }
        await this.installAssets(versionObject.assetIndex);
        await this.installLibs(versionObject.libraries);
    }
}

export class ModuleInstaller {
    launcher: Launcher;
    constructor (launcher: Launcher) {
        this.launcher = launcher;
    }
    async getSuitableModuleVersions(name: string, versionID: string): Promise<string[]> {
        const extras: DMCLCExtraVersionInfo = JSON.parse(fs.readFileSync(`${this.launcher.rootPath}/versions/${versionID}/dmclc_extras.json`).toString());
        const module_ = this.launcher.moduleTypes.get(name);
        if(module_==undefined){
            throw new Error(`Module not found: ${module_}`);
        }
        return module_.getSuitableModuleVersions(extras.version);
    }
    async install(name: string, versionID: string, moduleVersion: string): Promise<void> {
        
        const module_ = this.launcher.moduleTypes.get(name);const extras: DMCLCExtraVersionInfo = JSON.parse(fs.readFileSync(`${this.launcher.rootPath}/versions/${versionID}/dmclc_extras.json`).toString());
        if(module_==undefined){
            throw new Error(`Module not found: ${module_}`);
        }
        await module_.install(extras.version, versionID, moduleVersion);
        extras.modules.push({
            name: name,
            version: moduleVersion
        });
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionID}/dmclc_extras.json`, JSON.stringify(extras));
    }
}
