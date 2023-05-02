import { LoaderInfo } from "../../version";

export type LoaderType = "forge" | "fabric" | "quilt";

export interface Modpack {
    getName(): string;
    getSummary(): string;
    getVersion(): string;
    getLoaders(): LoaderInfo[];
    getMinecraftVersion(): string;
    downloadMods(moddir: string): Promise<void>;
    getOverrideDirs(): Promise<string[]>;
}

export interface ModpackFormat {
    /**
     * Reads a modpack.
     * @param file The modpack file
     */
    readModpack(file: string): Promise<Modpack>;
}
