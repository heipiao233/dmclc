import fs from 'fs';
import fsPromises from 'fs/promises';
import StreamZip, { StreamZipAsync } from 'node-stream-zip';
import path from 'path';
import { Launcher } from '../../../launcher.js';
import { downloadAll } from '../../../utils/downloads.js';
import { LoaderInfo } from "../../../version.js";
import { Modpack, ModpackFormat } from "../Modpack.js";
import { ModrinthModpackIndexV1 } from "./ModrinthModpackSchemas.js";

export class ModrinthModpack implements Modpack {
    private unzipDir?: string;
    constructor(private zipFile: StreamZipAsync, private manifest: ModrinthModpackIndexV1, private launcher: Launcher) {
        
    }
    async downloadMods(mcdir: string): Promise<boolean> {
        const map = new Map();
        for (const i of this.manifest.files) {
            if (i.env) {
                if (i.env.client === "unsupported") continue;
            }
            const outPath = `${mcdir}/${i.path}`;
            if (!path.resolve(outPath).startsWith(path.resolve(mcdir))) await this.launcher.error("mod.modpack.invalid");
            const dir = path.dirname(outPath);
            map.set(i.downloads[0], outPath)
        }
        return await downloadAll(map, this.launcher);
    }
    async getOverrideDirs(): Promise<string[]> {
        if (this.unzipDir === undefined) {
            this.unzipDir = await fsPromises.mkdtemp(this.manifest.name);
            this.zipFile.extract(null, this.unzipDir);
        }
        const ret = [];
        if (fs.existsSync(`${this.unzipDir}/overrides`)) {
            ret.push(`${this.unzipDir}/overrides`);
        }
        if (fs.existsSync(`${this.unzipDir}/client-overrides`)) {
            ret.push(`${this.unzipDir}/client-overrides`);
        }
        return ret;
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
        return loaders.filter(v => v[0]!=="minecraft").map(v => {
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
    async readModpack(file: string, launcher: Launcher): Promise<Modpack> {
        const zip = new StreamZip.async({
            file
        });
        const index: ModrinthModpackIndexV1 = JSON.parse((await zip.entryData("modrinth.index.json")).toString());

        return new ModrinthModpack(zip, index, launcher);
    }
    
    async checkModpack(file: string, launcher: Launcher): Promise<boolean> {
        const zip = new StreamZip.async({
            file
        });
        for (let key in (await zip.entries())) {
            if (key === "modrinth.index.json") return true;
        }
        return false;
    }
}
