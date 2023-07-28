import fsPromises from 'fs/promises';
import got, { Got, SearchParameters } from "got";
import { murmur2 } from 'murmurhash2';
import { Launcher } from "../../../launcher.js";
import { MinecraftVersion } from "../../../version.js";
import { Content, ContentService, ContentType, ContentVersion, ContentVersionDependContent, Screenshot } from "../ContentService.js";
import { Algorithm, CurseForgeMod, CurseForgeModFile, RelationType } from "./CurseForgeModels.js";

const loaderToCurseForge: Record<string, number> = {
    forge: 1,
    fabric: 2,
    quilt: 3
};

const CurseForgeContentType = {
    [ContentType.MODPACK]: 4471,
    [ContentType.SHADER]: 4546,
    [ContentType.MOD]: 6,
    [ContentType.RESOURCE_PACK]: 12,
    [ContentType.WORLD]: 17
};

export const CurseForgeSortField = {
    FEATURED: 1,
    POPULARITY: 2,
    LAST_UPDATED: 3,
    NAME: 4,
    AUTHOR: 5,
    TOTAL_DOWNLOADS: 6,
    CATEGORY: 7,
    GAME_VERSION: 8
};

const white = [0x9, 0xa, 0xd, 0x20]

export class CurseForgeContentVersion implements ContentVersionDependContent {
    dependencyType = "content" as const;

    constructor(private model: CurseForgeModFile, private got: Got) {
        //
    }

    async getContent(): Promise<Content> {
        const response: {data: CurseForgeMod} = await this.got("mods/" + this.model.modId).json();
        return new CurseForgeContent(response.data, this.got);
    }
    async getVersionFileName(): Promise<string> {
        return this.model.fileName;
    }
    async getVersionNumber(): Promise<string> {
        return this.model.fileDate;
    }
    async getVersionChangelog(): Promise<string> {
        const res: {
            data: string
        } = await this.got(`mods/${this.model.modId}/files/${this.model.id}/changelog`).json();
        return res.data;
    }
    async getVersionFileSHA1(): Promise<string> {
        return this.model.hashes[0].algo === Algorithm.SHA1 ? this.model.hashes[0].value : this.model.hashes[1].value;
    }

    async listDependencies(): Promise<Content[]> {
        const result = [];
        for (const i of this.model.dependencies) {
            if (i.relationType === RelationType.RequiredDependency) {
                const response: {data: CurseForgeMod} = await this.got("mods/" + i.modId).json();
                result.push(new CurseForgeContent(response.data, this.got));
            }
        }
        return result;
    }

    async getVersionFileURL(): Promise<string> {
        return this.model.downloadUrl;
    }
}
export class CurseForgeContent implements Content {
    constructor(private model: CurseForgeMod, private got: Got) {
        //
    }
    async isLibrary(): Promise<boolean> {
        return this.model.categories.findIndex(v => v.slug === "library-api") != -1;
    }
    async getBody(): Promise<string> {
        const res: {
            data: string
        } = await this.got(`mods/${this.model.id}/description`).json();
        return res.data;
    }
    async getTitle(): Promise<string> {
        return this.model.name;
    }
    async getDescription(): Promise<string> {
        return this.model.summary;
    }
    async getIconURL(): Promise<string> {
        return this.model.logo.url;
    }
    async getURLs(): Promise<Map<string, string>> {
        return new Map([
            ["issues", this.model.links.issuesUrl],
            ["source", this.model.links.sourceUrl],
            ["website", this.model.links.websiteUrl],
            ["wiki", this.model.links.wikiUrl]
        ]);
    }
    async getScreenshots(): Promise<Screenshot[]> {
        return this.model.screenshots;
    }
    async getOtherInformation(): Promise<Map<string, string>> {
        const res: Map<string, string> = new Map();
        if (this.model.downloadCount) {
            res.set("downloads", this.model.downloadCount.toString());
        }
        if (this.model.authors) {
            res.set("authors", this.model.authors.join(", "));
        }
        if (this.model.dateCreated) {
            res.set("published", this.model.dateCreated);
        }
        if (this.model.dateModified) {
            res.set("modified", this.model.dateModified);
        }
        if (this.model.dateReleased) {
            res.set("updated", this.model.dateReleased);
        }
        return res;
    }
    async listVersions(forVersion?: MinecraftVersion | undefined): Promise<ContentVersion[]> {
        const searchParams: SearchParameters = {};
        if (forVersion) {
            searchParams.gameVersion = forVersion.extras.version;
            searchParams.modLoaderType = loaderToCurseForge[forVersion.extras.loaders[0].name];
        }
        const files: {
            data: CurseForgeModFile[],
        } = await this.got(`mods/${this.model.id}/files`, {searchParams}).json();
        return files.data.filter(v => v.isAvailable).map(v => new CurseForgeContentVersion(v, this.got));
    }
}
export default class CurseForgeContentService implements ContentService<number> {
    private got: Got;
    constructor(private launcher: Launcher) {
        this.got = got.extend({
            prefixUrl: "https://api.curseforge.com/v1/",
            headers: {
                "x-api-key": "$2a$10$VhDVvjRWDxOlbRnuqi1GEOCxcZ.fZGRLf2kg7pdN8i4dowykR4huy"
            }
        });
    }
    async getVersionFromFile(path: string): Promise<ContentVersion | null> {
        const out: Buffer = Buffer.of();
        const content = await fsPromises.readFile(path);
        content.filter(i => !white.includes(i)).forEach(content.writeUInt8);
        const response: {
            data: {
                exactMatches: {
                    file: CurseForgeModFile
                }[]
            }
        } = await this.got.post("v1/fingerprints", {
            json: {
                fingerprints: [murmur2(out.toString(), 1)]
            }
        }).json();
        if (response.data.exactMatches.length === 0) return null;
        return new CurseForgeContentVersion(response.data.exactMatches[0].file, this.got);
    }
    getDefaultSortField(): number {
        return CurseForgeSortField.FEATURED;
    }
    getUnsupportedContentTypes(): ContentType[] {
        return [ContentType.DATA_PACK];
    }
    getSortFields(): Record<string, number> {
        return CurseForgeSortField;
    }

    async searchContent(name: string, skip: number, limit: number, type: ContentType, sortField: number, forVersion?: MinecraftVersion | undefined): Promise<Content[]> {
        if (type === ContentType.DATA_PACK) return [];
        const searchParams: SearchParameters = {
            gameId: 432,
            classId: CurseForgeContentType[type],
            searchFilter: name,
            index: skip,
            pageSize: limit,
            sortField: sortField
        };
        if (forVersion) {
            searchParams.gameVersion = forVersion.extras.version;
            searchParams.modLoaderType = loaderToCurseForge[forVersion.extras.loaders[0].name];
        }
        const response: {
            data: CurseForgeMod[]
        } = await this.got("mods/search", {
            searchParams
        }).json();
        return response.data.map(v => new CurseForgeContent(v, this.got));
    }

    async getContentVersion(projectID: number, fileID: number): Promise<CurseForgeContentVersion> {
        const response: {
            data: CurseForgeModFile
        } = await this.got(`mods/${projectID}/files/${fileID}`).json();
        return new CurseForgeContentVersion(response.data, this.got);
    }
}