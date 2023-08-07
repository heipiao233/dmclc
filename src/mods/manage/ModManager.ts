import fs from 'fs';
import fsPromises from 'fs/promises';
import { Launcher } from '../../launcher.js';
import { ModLoadingIssue } from '../../loaders/loader.js';
import { download } from '../../utils/downloads.js';
import { MinecraftVersion } from '../../version.js';
import { Content, ContentType, ContentVersion } from '../download/ContentService.js';
import { ModJarInfo } from '../mod.js';
export class ModManager {
    constructor(public version: MinecraftVersion, private launcher: Launcher) {
        
    }

    async saveInfo(): Promise<void> {}

    async findMods(): Promise<ModJarInfo[]> {
        const moddir = `${this.version.versionLaunchWorkDir}/mods`;
        if (!fs.existsSync(moddir) && fs.statSync(moddir).isDirectory()) return [];
        const val: ModJarInfo[] = [];
        for (const mod of await fsPromises.readdir(moddir)) {
            const modJar = `${moddir}/${mod}`;
            if((await fsPromises.stat(modJar)).isFile()&&mod.endsWith(".jar")) {
                val.push(await ModJarInfo.of(modJar, this.launcher, this.version.extras.loaders.map(v=>v.name)));
            }
        }
        return val;
    }

    /**
     * Check mod dependencies. You should warn your users that the result is not always correct.
     * @returns All mod loading issues.
     */
    async checkMods(): Promise<ModLoadingIssue[]> {
        if (this.version.extras.loaders.length===0)return [];
        let moddir = `${this.version.versionLaunchWorkDir}/mods`;
        if (!fs.existsSync(moddir) && fs.statSync(moddir).isDirectory()) return [];
        const loader = this.launcher.loaders.get(this.version.extras.loaders[0].name);
        return loader?.checkMods((await this.findMods()).map(v=>v.manifests).flat(), this.version.extras.version, this.version.extras.loaders[0].version) ?? [];
    }

    async searchMod(name: string, skip: number, limit: number): Promise<Content[]> {
        const result: Content[] = [];
        for (const service of this.launcher.contentServices.values()) {
            result.push(...await service.searchContent(name, skip, limit, ContentType.MOD, service.getDefaultSortField(), this.version));
        }
        return result;
    }

    /**
     * @throws RequestError
     * @param content content
     * @returns true if success
     */
    async installContent(content: Content): Promise<boolean> {
        return this.installContentVersion((await content.listVersions(this.version))[0]);
    }

    /**
     * @throws RequestError
     * @param version content version
     * @returns true if success
     */
    async installContentVersion(version: ContentVersion): Promise<boolean> {
        const url = await version.getVersionFileURL();
        const moddir = `${this.version.versionLaunchWorkDir}/mods`
        if (!await download(url, `${moddir}/${await version.getVersionFileName()}`, this.launcher)) {
            return false;
        }
        let result = true;
        for (const i of await version.listDependencies()) {
            if (i.isVersion) {
                result &&= await this.installContentVersion(i);
            } else {
                result &&= await this.installContent(i);
            }
        }
        return result;
    }
}