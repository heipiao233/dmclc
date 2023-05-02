import { StreamZipAsync } from "node-stream-zip";
import { LoaderInfo } from "../../../version";
import { Modpack, ModpackFormat } from "../Modpack";
import { ModrinthModpackIndexV1 } from "./ModrinthModpackSchemas";

export class ModrinthModpack implements Modpack {
    constructor(private manifest: ModrinthModpackIndexV1) {
        
    }
    async downloadMods(moddir: string): Promise<void> {
        this.manifest.files
    }
    getOverrideDirs(): Promise<string[]> {
        throw new Error("Method not implemented.");
    }
    getName(): string {
        return this.manifest.name;
    }
    getSummary(): string {
        return this.manifest.summary ?? "Loerm ipusm...";
    }
    getVersion(): string {
        return this.manifest.versionId;
    }
    getLoaders(): LoaderInfo[] {
        const loaders = Object.entries(this.manifest.dependencies);
        return loaders.map(v => {
            return {
                name: v[0].replace("-loader", ""),
                version: v[1]
            }
        });
    }
    getMinecraftVersion(): string {
        return this.manifest.dependencies.minecraft;
    }
    
}

export class ModrinthModpackFormat implements ModpackFormat {
    async readModpack(file: string): Promise<Modpack> {
        const zip = new StreamZipAsync({
            file
        });
        const index: ModrinthModpackIndexV1 = JSON.parse((await zip.entryData("modrinth.index.json")).toString());

        return new ModrinthModpack(index);
    }
    
}
