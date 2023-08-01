import fs from 'fs';
import fsPromises from 'fs/promises';
import StreamZip, { StreamZipAsync } from 'node-stream-zip';
import { Launcher } from '../../../launcher.js';
import { downloadAll } from '../../../utils/downloads.js';
import { LoaderInfo } from "../../../version.js";
import CurseForgeContentService from '../../download/curseforge/CurseForgeContentService.js';
import { Modpack, ModpackFormat } from "../Modpack.js";
import { CurseForgeModpackSchema as CurseForgeModpackManifest } from './CurseForgeModpackSchemas.js';

export class CurseForgeModpack implements Modpack {
    private unzipDir?: string;
    constructor(private zipFile: StreamZipAsync, private manifest: CurseForgeModpackManifest, private launcher: Launcher) {
        
    }
    async downloadMods(mcdir: string): Promise<boolean> {
        const map = new Map();
        for (const i of this.manifest.files) {
            if (!i.required) {
                continue;
            }
            const cf: CurseForgeContentService = this.launcher.contentServices.get("curseforge") as CurseForgeContentService;
            const version = await cf.getContentVersion(i.projectID, i.fileID);
            if (!(typeof await version.getVersionFileURL() == "string")) continue;
            map.set(await version.getVersionFileURL(), `${mcdir}/mods/${await version.getVersionFileName()}`);
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
        return "Loerm ipusm...";
    }
    getVersion(): string {
        return this.manifest.version;
    }
    getLoaders(): LoaderInfo[] {
        const loaders = this.manifest.minecraft.modLoaders;
        return loaders.map(v => {
            return {
                name: v.id.split('-')[0],
                version: v.id.split('-')[1]
            }
        });
    }
    getMinecraftVersion(): string {
        return this.manifest.minecraft.version;
    }
    
}

export class CurseForgeModpackFormat implements ModpackFormat {
    async readModpack(file: string, launcher: Launcher): Promise<Modpack> {
        const zip = new StreamZip.async({
            file
        });
        const index: CurseForgeModpackManifest = JSON.parse((await zip.entryData("manifest.json")).toString());

        return new CurseForgeModpack(zip, index, launcher);
    }
    
    async checkModpack(file: string, launcher: Launcher): Promise<boolean> {
        const zip = new StreamZip.async({
            file
        });
        for (let key in (await zip.entries())) {
            if (key === "manifest.json") return true;
        }
        return false;
    }
}
