import { Launcher } from "../launcher.js";
export type Env = "*" | "client" | "server";
export class ModInfo<T> {
    loader: string;
    data: T;
    constructor(loader: string, data: T){
        this.loader = loader;
        this.data = data;
    }
}

export class ModJarInfo {
    // Some mod jars may have two or more manifests for many loaders.
    // For example, there are both META-INF/mods.toml and fabric.mod.json in a jar.
    manifests: ModInfo<unknown>[] = [];
    static async of(path: string, launcher: Launcher, loaders: string[]): Promise<ModJarInfo> {
        const obj = new ModJarInfo();
        for (const name of loaders) {
            const loader = launcher.loaders.get(name)!;
            obj.manifests.push(...await loader.findModInfos(path));
        }
        return obj;
    }
    private constructor() {
        // do nothing
    }
}