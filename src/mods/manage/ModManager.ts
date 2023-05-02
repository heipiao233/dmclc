import fsPromises from 'fs/promises';
import { Launcher } from '../../launcher';
import { ModLoadingIssue } from '../../loaders/loader';
import { download } from '../../utils/downloads';
import { MinecraftVersion } from '../../version';
import { Content, ContentType, ContentVersion } from '../download/ContentService';
import { ModJarInfo } from '../mod';
export default class ModManager {
    constructor(public version: MinecraftVersion, private launcher: Launcher) {
        
    }

    async saveInfo(): Promise<void> {}

    async findMods(): Promise<ModJarInfo[]> {
        const moddir = `${this.version.versionLaunchWorkDir}/mods`;
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
        if(this.version.extras.loaders.length===0)return [];
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

    async installMod(mod: Content) {
        this.installModVersion((await mod.listVersions(this.version))[0]);
    }
    async installModVersion(version: ContentVersion) {
        const url = await version.getVersionFileURL();
        const moddir = `${this.version.versionLaunchWorkDir}/mods`
        download(url, `${moddir}/${await version.getVersionFileName()}`, this.launcher);
        if (version.dependencyType === "version") {
            for (const i of await version.listDependencies()) {
                await this.installModVersion(i);
            }
        } else {
            for (const i of await version.listDependencies()) {
                await this.installMod(i);
            }
        }
    }
}