import { ModInfo } from "../mods/mod.js";
import { MCVersion } from "../schemas.js";
import { MinecraftVersion } from "../version.js";

export type IssueLevel = "error" | "warning";

export class ModLoadingIssue {
    level: IssueLevel;
    message: string;
    args: string[];
    constructor(level: IssueLevel, message: string, args: string[]) {
        this.level = level;
        this.message = message;
        this.args = args;
    }
}

/**
 * Used to install loaders.
 * @public
 */
export interface Loader<T> {
    /**
     * Get all loader versions that work on the Minecraft version
     * @param MCVersion - Minecraft version.
     */
    getSuitableLoaderVersions(MCVersion: MinecraftVersion): Promise<string[]>
    /**
     * Install.
     * @param MCVersion - Minecraft version.
     * @param version - Loader version.
     */
    install(MCVersion: MinecraftVersion, version: string): Promise<void>
    /**
     * Get the version installed, or null if not installed or can't find.
     * @param MCVersion - Minecraft version manifest.
     */
    findInVersion(MCVersion: MCVersion): string | undefined
    findModInfos(path: string): Promise<ModInfo<T>[]>
    checkMods(mods: ModInfo<T>[], mc: string, loader: string): ModLoadingIssue[];
}
