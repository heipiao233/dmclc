import fs from 'fs';
import fsPromises from 'fs/promises';
import StreamZip, { StreamZipAsync } from 'node-stream-zip';
import path from 'path';
import { FormattedError } from '../../../errors/FormattedError';
import { Launcher } from '../../../launcher';
import { downloadAll } from '../../../utils/downloads';
import { LoaderInfo } from "../../../version";
import { Modpack, ModpackFormat } from "../Modpack";
import { ModrinthModpackIndexV1 } from "./ModrinthModpackSchemas";

export class ModrinthModpack implements Modpack {
    private unzipDir?: string;
    constructor(private zipFile: StreamZipAsync, private manifest: ModrinthModpackIndexV1, private launcher: Launcher) {
        
    }
    async downloadMods(mcdir: string): Promise<void> {
        const map = new Map();
        for (const i of this.manifest.files) {
            if (i.env) {
                if (i.env.client === "unsupported") continue;
            }
            const outPath = `${mcdir}/${i.path}`;
            if (!path.resolve(outPath).startsWith(mcdir)) throw new FormattedError(this.launcher.i18n("mod.modpack.invalid"))
            map.set(i.downloads[0], outPath)
        }
        Promise.all(downloadAll(map, this.launcher));
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
    async readModpack(file: string, launcher: Launcher): Promise<Modpack> {
        const zip = new StreamZip.async({
            file
        });
        const index: ModrinthModpackIndexV1 = JSON.parse((await zip.entryData("modrinth.index.json")).toString());

        return new ModrinthModpack(zip, index, launcher);
    }
    
}
