import { TFunction } from "i18next";
import { ModDisplayInfo, ModInfo } from "../mods/mod.js";
import { MCVersion } from "../schemas.js";
import { MinecraftVersion } from "../version.js";

export type IssueLevel = "error" | "warning";

export class ModLoadingIssue {
    constructor(public level: IssueLevel, public message: string, public args: Record<string, string>) {
    }

    toLocalizedString(i18n: TFunction): string {
        return i18n("dependencies." + this.level) + ": " + i18n(this.message, this.args);
    }
}

/**
 * Used to install loaders.
 * @public
 */
export interface Loader<T> {
    /**
     * Get all loader versions that work on the Minecraft version
     * @throws {@link FormattedError}
     * @throws RequestError
     * @param MCVersion - Minecraft version.
     */
    getSuitableLoaderVersions(MCVersion: MinecraftVersion): Promise<string[]>
    /**
     * Install.
     * @throws {@link FormattedError}
     * @throws RequestError
     * @param MCVersion - Minecraft version.
     * @param version - Loader version.
     */
    install(MCVersion: MinecraftVersion, version: string): Promise<boolean>
    /**
     * Get the version installed, or null if not installed or can't find.
     * @param MCVersion - Minecraft version manifest.
     */
    findInVersion(MCVersion: MCVersion): string | undefined
    /**
     * Get all mod informations.
     * @param path - Mod jar.
     * @returns An array of ModInfo<T>.
     */
    findModInfos(path: string): Promise<ModInfo<T>[]>
    /**
     * Check installed mods.
     * @param mods - All the installed mods.
     * @param mc - Minecraft version.
     * @param loader - Loader version.
     */
    checkMods(mods: ModInfo<T>[], mc: string, loader: string): ModLoadingIssue[];
    /**
     * Get mod display info for end user.
     * @param mod - Mod info.
     */
    getModInfo(mod: T): ModDisplayInfo;
}
