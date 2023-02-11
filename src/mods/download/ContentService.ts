import { MinecraftVersion } from "../../version.js";

interface ContentVersionBase {
    getVersionFileURL(): Promise<string>;
    getVersionFileSHA1(): Promise<string>;
}

/**
 * A content version, dependencies are contents.
 */
export interface ContentVersionDependContent extends ContentVersionBase {
    dependencyType: "content";
    /**
     * List all dependencies.
     */
    listDependencies(): Promise<Content[]>;
}

/**
 * A content version, dependencies are content versions.
 */
export interface ContentVersionDependContentVersion extends ContentVersionBase {
    dependencyType: "version";
    /**
     * List all dependencies.
     */
    listDependencies(): Promise<ContentVersion[]>;
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
 * A content version.
 */
export type ContentVersion = ContentVersionDependContentVersion | ContentVersionDependContent;

/**
 * A Content posting service. For example: Modrinth, CurseForge.
 */
export interface ContentService<SortField> {
    /**
     * @param name Searching string.
     * @param skip How many results to skip.
     * @param limit How many results will return.
     * @param forVersion The Minecraft version you download for.
     */
    searchContent(name: string, skip: number, limit: number, type: ContentType, sortField: SortField, forVersion?: MinecraftVersion): Promise<Content[]>;
    getUnsupportedContentTypes(): ContentType[];
    getSortFields(): Record<string, SortField>;
}

export interface Content {
    /**
     * List versions.
     * @param forVersion The Minecraft version you download for.
     */
    listVersions(forVersion?: MinecraftVersion): Promise<ContentVersion[]>;
}
