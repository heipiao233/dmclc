import { Launcher } from "../../launcher.js";
import { LoaderInfo } from "../../version.js";

export type LoaderType = "forge" | "fabric" | "quilt";

export interface Modpack {
    getName(): string;
    getSummary(): string;
    getVersion(): string;
    getLoaders(): LoaderInfo[];
    getMinecraftVersion(): string;
    downloadMods(mcdir: string): Promise<boolean>;
    getOverrideDirs(): Promise<string[]>;
}

export interface ModpackFormat {
    /**
     * Reads a modpack.
     * @param file The modpack file
     */
    readModpack(file: string, launcher: Launcher): Promise<Modpack>;
    checkModpack(file: string, launcher: Launcher): Promise<boolean>;
}
