import fs from "fs";
import * as http_request from "./utils/http_request.js";
import { VersionInfo, VersionInfos } from "./schemas.js";
import { Launcher } from "./launcher.js";
import { DMCLCExtraVersionInfo, MinecraftVersion } from "./version.js";
import { mkdirs } from "fs-extra";
/**
 * Install new Minecraft versions.
 * @public
 */
export class Installer {
    launcher: Launcher;
    /**
     * Creates a new Installer.
     * @param launcher - The using launcher.
     */
    constructor(launcher: Launcher) {
        this.launcher = launcher;
    }

    /**
     * Get all the versions from the network.
     * @returns All the versions.
     */
    async getVersionList(): Promise<VersionInfos> {
        // url:https://launchermeta.mojang.com/mc/game/version_manifest.json
        const versions: VersionInfos = JSON.parse(await http_request.get("https://launchermeta.mojang.com/mc/game/version_manifest.json", this.launcher.mirror));
        return versions;
    }

    /**
     * 
     * @param ver - The version to install.
     * @param versionName - The {@link MinecraftVersion.name} of the new version.
     * @returns The new version.
     */
    async install(ver: VersionInfo, versionName: string): Promise<MinecraftVersion> {
        const content = await http_request.get(ver.url, this.launcher.mirror);
        const obj = JSON.parse(content);
        obj.id = versionName;
        await mkdirs(`${this.launcher.rootPath}/versions/${versionName}`);
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionName}/${versionName}.json`, JSON.stringify(obj));
        const extras: DMCLCExtraVersionInfo = {
            version: ver.id,
            loaders: [],
            enableIndependentGameDir: false
        };
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionName}/dmclc_extras.json`, JSON.stringify(extras));
        const version = MinecraftVersion.fromVersionName(this.launcher, versionName);
        version.completeVersionInstall();
        return version;
    }
}
