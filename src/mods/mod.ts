import { Launcher } from "../launcher.js";

export type ModDisplayInfo = {
    id: string,
    version: string,
    name?: string,
    description?: string,
    license?: string
}

export class ModInfo<T> {
    constructor(public loader: string, public data: T) {}

    getInfo(launcher: Launcher): ModDisplayInfo {
        return launcher.loaders.get(this.loader)!.getModInfo(this.data);
    }
}

export class ModJarInfo {
    // Some mod jars may have two or more manifests for many loaders.
    // For example, there are both META-INF/mods.toml and fabric.mod.json in a jar.
    manifests: ModInfo<unknown>[] = [];
    private constructor(public path: string) {
        // do nothing
    }
    static async of(path: string, launcher: Launcher, loaders: string[]): Promise<ModJarInfo> {
        const obj = new ModJarInfo(path);
        for (const name of loaders) {
            const loader = launcher.loaders.get(name)!;
            obj.manifests.push(...await loader.findModInfos(path));
        }
        return obj;
    }
}