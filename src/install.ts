import fs from "fs";
import * as http_request from "./utils/http_request.js";
import { VersionInfo, VersionInfos } from "./schemas.js";
import { Launcher } from "./launcher.js";
import { DMCLCExtraVersionInfo, Version } from "./version.js";
import { mkdirs } from "fs-extra";
export class Installer {
    launcher: Launcher;
    constructor(launcher: Launcher) {
        this.launcher = launcher;
    }

    async getVersionList(): Promise<VersionInfos> {
        // url:https://launchermeta.mojang.com/mc/game/version_manifest.json
        const versions: VersionInfos = JSON.parse(await http_request.get("https://launchermeta.mojang.com/mc/game/version_manifest.json", this.launcher.mirror));
        return versions;
    }

    async install(ver: VersionInfo, versionName: string): Promise<Version> {
        const content = await http_request.get(ver.url, this.launcher.mirror);
        await mkdirs(`${this.launcher.rootPath}/versions/${versionName}`);
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionName}/${versionName}.json`, content);
        const version = Version.fromVersionName(this.launcher, versionName);
        version.completeVersionInstall();
        const extras: DMCLCExtraVersionInfo = {
            version: ver.id,
            modules: [],
            enableIndependentGameDir: false
        };
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionName}/dmclc_extras.json`, JSON.stringify(extras));
        return version;
    }
}
