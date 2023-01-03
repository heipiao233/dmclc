export type ForgeNewMod = {
    modId: string;
    version: string;
    displayName: string;
    displayURL?: string;
    logoFile?: string;
    credits?: string;
    authors?: string;
    description: string;
}
export type Dependency = {
    modId: string;
    mandatory: boolean;
    versionRange: string;
    side: string;
}
export type ForgeModsToml = {
    modLoader: string;
    loaderVersion: string;
    license: string;
    issueTrackerURL: string;
    mods: ForgeNewMod[];
    dependencies?: Record<string, Dependency[]>;
}
export type ForgeMcmodInfoOne = {
    modid: string;
    name: string;
    description?: string;
    version?: string;
    mcversion?: string;
    url?: string;
    authorList?: string[];
    credits?: string;
    logoFile?: string;
    parent?: string;
    useDependencyInformation?: boolean;
    requiredMods?: string[];
};
export type ForgeMcmodInfo = ForgeMcmodInfoOne[];
export type StoreData = {
    info: ForgeNewMod;
    jar: ForgeModsToml;
    deps?: Dependency[];
};
export type ForgeJarJarJson = {
    jars: {
        path: string
    }[];
}
