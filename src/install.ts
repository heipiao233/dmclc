import fs from "fs";
import fsextra, { mkdirs } from 'fs-extra';
import got from "got";
import { FormattedError } from "./errors/FormattedError.js";
import { Launcher } from "./launcher.js";
import { Modpack } from "./mods/modpack/Modpack.js";
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
     * Install.
     * @param ver - The version to install.
     * @param versionName - The {@link Version.name} of the new version.
     * @returns The new version.
     */
    async install(ver: VersionInfo, versionName: string, enableIndependentGameDir: boolean = false): Promise<MinecraftVersion> {
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
        this.launcher.installedVersions.set(versionName, version);
        await version.completeVersionInstall();
        return version;
    }

    /**
     * Install.
     * @param versionId - The version ID.
     * @param name The name of the new version.
     * @returns The new version.
     */
    async installVersion(versionId: string, name: string, enableIndependentGameDir: boolean = false): Promise<MinecraftVersion> {
        const version = (await this.getVersionList()).versions.find(v => v.id === versionId);
        if (version === undefined) throw new FormattedError(`${this.launcher.i18n("version.version_not_found")}${versionId}`);
        return await this.install(version, name);
    }

    /**
     * Install modpack.
     * @param modpack - The modpack.
     * @param name The name of the new version.
     * @returns The new version.
     */
    async installModpack(modpack: Modpack, name: string): Promise<MinecraftVersion> {
        const version = await this.installVersion(modpack.getMinecraftVersion(), name, true);
        for (const loader of modpack.getLoaders()) {
            await version.installLoader(loader.name, loader.version);
        }
        await modpack.downloadMods(`${version.versionLaunchWorkDir}/mods`);
        for (const dir of await modpack.getOverrideDirs()) {
            await fsextra.copy(dir, version.versionLaunchWorkDir);
        }
        return version;
    }
}

function transformNatives(libraries: Library[], launcher: Launcher) {
    if (launcher.archInfo) 
        for (let i = 0; i < libraries.length; i++) {
            if ("natives" in libraries[i]) {
                libraries[i] = launcher.archInfo.specialNatives[libraries[i].name + ":natives"] ?? libraries[i];
            } else {
                libraries[i] = launcher.archInfo.specialNatives[libraries[i].name] ?? libraries[i];
            }
        }
}
