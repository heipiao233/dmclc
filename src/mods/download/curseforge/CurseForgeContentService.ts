import got, { Got, SearchParameters } from "got";
import { Launcher } from "../../../launcher.js";
import { MinecraftVersion } from "../../../version.js";
import { Content, ContentService, ContentType, ContentVersion, ContentVersionDependContent, SortField } from "../ContentService.js";
import { Algorithm, CurseForgeMod, CurseForgeModFile, RelationType } from "./CurseForgeModels.js";

const contentTypeToCurseForge = {
    [ContentType.MOD]: 6,
    [ContentType.RESOURCE_PACK]: 12,
    [ContentType.WORLD]: 17,
    [ContentType.MODPACK]: 4471,
    [ContentType.SHADER]: 4546,
};

const sortFieldToCurseForge = {
    [SortField.DATE_CREATED]: 1,
    [SortField.LAST_UPDATED]: 3,
    [SortField.RELEVANCE]: 2,
    [SortField.DOWNLOADS]: 6,
};

const loaderToCurseForge: Record<string, number> = {
    forge: 1,
    fabric: 2,
    quilt: 3
};

export class CurseForgeContentVersion implements ContentVersionDependContent {
    dependencyType = "content" as const;

    constructor(private model: CurseForgeModFile, private got: Got) {
        //
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
export default class CurseForgeContentService implements ContentService {
    private got: Got;
    constructor(private launcher: Launcher) {
        this.got = got.extend({
            prefixUrl: "https://api.curseforge.com/v1/",
            headers: {
                "x-api-key": "$2a$10$VhDVvjRWDxOlbRnuqi1GEOCxcZ.fZGRLf2kg7pdN8i4dowykR4huy"
            }
        });
    }

    async searchContent(name: string, skip: number, limit: number, type: ContentType, sortField: SortField, forVersion?: MinecraftVersion | undefined): Promise<Content[]> {
        if (type === ContentType.DATA_PACK) return [];
        const searchParams: SearchParameters = {
            gameId: 432,
            classId: contentTypeToCurseForge[type],
            searchFilter: name,
            index: skip,
            pageSize: limit,
            sortField: sortFieldToCurseForge[sortField]
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

}