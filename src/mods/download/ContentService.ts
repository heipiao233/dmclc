import { MinecraftVersion } from "../../version.js";



/**
 * A content version.
 */
export interface ContentVersion {
    getVersionFileURL(): Promise<string>;
    getVersionFileSHA1(): Promise<string>;
    getVersionFileName(): Promise<string>;
    getVersionChangelog(): Promise<string>;
    getVersionNumber(): Promise<string>;
    getContent(): Promise<Content>;
    listDependencies(): Promise<(Content | ContentVersion)[]>;
    isVersion: true;
}

export type Screenshot = {
    url: string,
    title?: string,
    description?: string
}

export enum ContentType {
    MODPACK,
    SHADER,
    MOD,
    RESOURCE_PACK,
    DATA_PACK,
    WORLD
}

/**
 * A Content posting service. For example: Modrinth, CurseForge.
 */
export interface ContentService<SortField> {
    /**
     * @param name Searching string.
     * @param skip The number of results to skip.
     * @param limit The number of results will return.
     * @param forVersion The Minecraft version you download for.
     */
    searchContent(name: string, skip: number, limit: number, type: ContentType, sortField: SortField, forVersion?: MinecraftVersion): Promise<Content[]>;
    getUnsupportedContentTypes(): ContentType[];
    getSortFields(): Record<string, SortField>;
    getDefaultSortField(): SortField;
    getVersionFromFile(path: string): Promise<ContentVersion | null>;
}

export interface Content {
    /**
     * List versions.
     * @param forVersion The Minecraft version you download for.
     */
    listVersions(forVersion?: MinecraftVersion): Promise<ContentVersion[]>;
    getTitle(): Promise<string>;
    getDescription(): Promise<string>;
    getBody(): Promise<string>;
    getIconURL(): Promise<string>;
    getURLs(): Promise<Map<string, string>>;
    getScreenshots(): Promise<Screenshot[]>;
    getOtherInformation(): Promise<Map<string, string>>;
    isLibrary(): Promise<boolean>;
    getType(): ContentType;
    isVersion: false;
}
