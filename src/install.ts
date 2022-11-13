import fs, { PathLike } from "fs";
import * as mkdirs from "./utils/mkdirs.js";
import * as http_request from "./utils/http_request.js";
import * as downloads from "./utils/downloads.js";
import * as path from "path";
import { tmpdir } from "os";
import { dirname } from "path";
import { AssetIndexInfo, McInstallation, Library, VersionInfo, VersionInfos, checkRules, AssetsIndex, Asset } from "./schemas.js";
import { Launcher } from "./launcher.js";
import { checkFile } from "./utils/check_file.js";
import { expandMavenId } from "./utils/maven.js";
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
                await downloads.download(`https://resources.download.minecraft.net/${assitem.hash.slice(0, 2)}/${assitem.hash}`, `${this.launcher.rootPath}/assets/objects/${assitem.hash.slice(0, 2)}/${assitem.hash}`, this.launcher.mirror);
            }
        }
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
                allDownloads.set(`${i.url}${filePath}`, `${this.launcher.rootPath}/libraries/${filePath}`);
            } else {
                if (typeof (i.downloads.artifact) === "object" && (!fs.existsSync(`${this.launcher.rootPath}/libraries/${i.downloads.artifact.path}`) ||
                !checkFile(`${this.launcher.rootPath}/libraries/${i.downloads.artifact.path}`, i.downloads.artifact.sha1))
                ) {
                    mkdirs.mkdirs(`${this.launcher.rootPath}/libraries/${path.dirname(i.downloads.artifact.path)}`);
                    console.log(i.name);
                    allDownloads.set(i.downloads.artifact.url, `${this.launcher.rootPath}/libraries/${i.downloads.artifact.path}`);
                }
                if (typeof (i.downloads.classifiers) === "object" && this.launcher.natives in i.downloads.classifiers) {
                    const pth = `${tmpdir()}/${this.launcher.name}_natives/${i.downloads.classifiers[this.launcher.natives].path}`;
                    mkdirs.mkdirs(dirname(pth));
                    allDownloads.set(i.downloads.classifiers[this.launcher.natives].url, pth);
                }
            }
        });
        await downloads.downloadAll(allDownloads, this.launcher.mirror);
    }

    async install (ver: VersionInfo, versionName: string): Promise<void> {
        const content = await http_request.get(ver.url, this.launcher.mirror);
        const versionObject: McInstallation = JSON.parse(content);
        mkdirs.mkdirs(`${this.launcher.rootPath}/versions/${versionName}`);
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionName}/${versionName}.json`, content);
        await downloads.download(versionObject.downloads.client.url, `${this.launcher.rootPath}/versions/${versionName}/${versionName}.jar`);
        await this.installAssets(versionObject.assetIndex);
        await this.installLibs(versionObject.libraries);
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
