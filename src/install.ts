import fs from "fs";
import { mkdirs } from "fs-extra";
import got from "got";
import { Launcher } from "./launcher.js";
import { Library, MCVersion, VersionInfo, VersionInfos } from "./schemas.js";
import { transformURL } from "./utils/TransformURL.js";
import { DMCLCExtraVersionInfo, MinecraftVersion } from "./version.js";
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
     * Get all the versions from Mojang.
     * @returns All the versions.
     */
    async getVersionList(): Promise<VersionInfos> {
        const versions: VersionInfos = await got(transformURL("https://launchermeta.mojang.com/mc/game/version_manifest.json", this.launcher.mirror)).json();
        return versions;
    }

    /**
     * 
     * @param ver - The version to install.
     * @param versionName - The {@link Version.name} of the new version.
     * @returns The new version.
     */
    async install(ver: VersionInfo, versionName: string): Promise<MinecraftVersion> {
        const obj = await got(transformURL(ver.url, this.launcher.mirror)).json<MCVersion>();
        obj.id = versionName;
        transformNatives(obj.libraries, this.launcher);
        await mkdirs(`${this.launcher.rootPath}/versions/${versionName}`);
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionName}/${versionName}.json`, JSON.stringify(obj));
        const extras: DMCLCExtraVersionInfo = {
            version: ver.id,
            loaders: [],
            enableIndependentGameDir: false
        };
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${versionName}/dmclc_extras.json`, JSON.stringify(extras));
        const version = MinecraftVersion.fromVersionName(this.launcher, versionName);
        await version.completeVersionInstall();
        return version;
    }
}
function transformNatives(libraries: Library[], launcher: Launcher) {
    if (launcher.specialArch) 
        for (let i = 0; i < libraries.length; i++) {
            if (libraries[i].natives) {
                libraries[i] = launcher.specialNatives![libraries[i].name + ":natives"] ?? libraries[i];
            } else {
                libraries[i] = launcher.specialNatives![libraries[i].name] ?? libraries[i];
            }
        }
}
