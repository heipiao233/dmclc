import got, { Got } from "got";
import { Launcher } from "../../../launcher.js";
import { MinecraftVersion } from "../../../version.js";
import { Content, ContentService, ContentType, ContentVersion, ContentVersionDependContentVersion, SortField } from "../ContentService.js";
import { ModrinthVersionModel, SearchResult } from "./ModrinthModels.js";

const contentTypeToModrinth = {
    [ContentType.MODPACK]: "modpack",
    [ContentType.MOD]: "mod",
    [ContentType.RESOURCE_PACK]: "resourcepack",
    [ContentType.DATA_PACK]: "datapack",
    [ContentType.SHADER]: "shader",
};

const sortFieldToModrinth = {
    [SortField.DATE_CREATED]: "newest",
    [SortField.LAST_UPDATED]: "updated",
    [SortField.RELEVANCE]: "relevance",
    [SortField.DOWNLOADS]: "downloads",
};

export class ModrinthContentVersion implements ContentVersionDependContentVersion {
    dependencyType = "version" as const;

    constructor(private model: ModrinthVersionModel, private got: Got) {
    }

    async listDependencies(): Promise<ContentVersion[]> {
        const dependencies = [];
        for (const i of this.model.dependencies) {
            if (i.dependency_type === "optional" || i.dependency_type === "required") {
                dependencies.push(new ModrinthContentVersion(await got("version/" + i.version_id).json(), this.got));
            }
        }
        return dependencies;
    }
    async getVersionFileURL(): Promise<string> {
        for (const i of this.model.files) {
            if (i.primary) {
                return i.url;
            }
        }
        return this.model.files[0].url;
    }

    async getVersionFileSHA1(): Promise<string> {
        for (const i of this.model.files) {
            if (i.primary) {
                return i.hashes.sha1;
            }
        }
        return this.model.files[0].url;
    }
    
}
export class ModrinthContent implements Content {
    constructor(private launcher: Launcher, private got: Got, private slug: string) {

    }
    async listVersions(forVersion?: MinecraftVersion | undefined): Promise<ContentVersion[]> {
        let searchParams = {};
        if (forVersion) {
            const loaders: string[] = [];
            forVersion.extras.loaders.forEach((v) => {
                loaders.push(v.name);
            });
            searchParams = {
                loaders: JSON.stringify(loaders),
                game_versions: forVersion.extras.version
            };
        }
        const versions: ModrinthVersionModel[] = await this.got(`project/${this.slug}/version`, {
            searchParams
        }).json();
        return versions.map((v) => {
            return new ModrinthContentVersion(v, this.got);
        });
    }
}
export default class ModrinthContentService implements ContentService {
    private got: Got;
    constructor(private launcher: Launcher) {
        this.got = got.extend({
            prefixUrl: "https://api.modrinth.com/v2/",
            headers: {
                "user-agent": `${this.launcher.name}, using heipiao233/dmclc/${this.launcher.version} (contact@launcher.com)`
            }
        });
    }

    async searchContent(name: string, skip: number, limit: number, type: ContentType, sortField: SortField, forVersion?: MinecraftVersion | undefined): Promise<Content[]> {
        if (type === ContentType.WORLD) return [];
        const facets = [
            ["project_type:" + contentTypeToModrinth[type]]
        ];
        if (forVersion) {
            facets.push(["versions:"+forVersion.extras.version]);
            const loaders: string[] = [];
            forVersion.extras.loaders.forEach((v) => {
                loaders.push("categories:"+v.name);
            });
            facets.push(loaders);
        }
        const res: {
            hits: SearchResult[]
        } = await this.got("search", {
            searchParams: {
                query: name,
                facets: JSON.stringify(facets),
                offset: skip,
                limit,
                index: sortFieldToModrinth[sortField]
            }
        }).json();
        const result = [];
        for (const i of res.hits) {
            result.push(new ModrinthContent(this.launcher, this.got, i.slug));
        }
        return result;
    }

}