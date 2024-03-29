import crypto from "crypto";
import fsPromises from "fs/promises";
import got, { Got } from "got";
import { marked } from "marked";
import { Launcher } from "../../../launcher.js";
import { MinecraftVersion } from "../../../version.js";
import { Content, ContentService, ContentType, ContentVersion, Screenshot } from "../ContentService.js";
import { ModrinthFile, ModrinthProject, ModrinthVersionModel, SearchResult } from "./ModrinthModels.js";

const contentTypeToModrinth = {
    [ContentType.MODPACK]: "modpack",
    [ContentType.MOD]: "mod",
    [ContentType.RESOURCE_PACK]: "resourcepack",
    [ContentType.DATA_PACK]: "datapack",
    [ContentType.SHADER]: "shader",
};

const modrinthToContentType = {
    "modpack": ContentType.MODPACK,
    "mod": ContentType.MOD,
    "resourcepack": ContentType.RESOURCE_PACK,
    "datapack": ContentType.DATA_PACK,
    "shader": ContentType.SHADER,
};

export const ModrinthSortField = {
    NEWEST: "newest",
    UPDATED: "updated",
    RELEVANCE: "relevance",
    DOWNLOADS: "downloads",
    FOLLOWS: "follows"
};

export class ModrinthContentVersion implements ContentVersion {
    dependencyType = "version" as const;
    file: ModrinthFile;
    content?: ModrinthContent;
    isVersion = true as const;

    constructor(private model: ModrinthVersionModel, private got: Got, private launcher: Launcher) {
        for (const i of this.model.files) {
            if (i.primary) {
                this.file = i;
            }
        }
        this.file = this.model.files[0];
    }
    async getContent(): Promise<Content> {
        if (!this.content) return this.content = await ModrinthContent.fromSlugOrID(this.launcher, this.got, this.model.project_id);
        return this.content;
    }
    async getVersionFileName(): Promise<string> {
        return this.file.filename;
    }
    async getVersionNumber(): Promise<string> {
        return this.model.version_number;
    }
    async getVersionChangelog(): Promise<string> {
        return await marked(this.model.changelog ?? "");
    }

    async listDependencies(): Promise<(ContentVersion | Content)[]> {
        const dependencies = [];
        for (const i of this.model.dependencies) {
            if (i.dependency_type === "optional" || i.dependency_type === "required") {
                if (i.version_id) {
                    dependencies.push(new ModrinthContentVersion(await this.got("version/" + i.version_id).json(), this.got, this.launcher));
                } else if(i.project_id) {
                    dependencies.push(await ModrinthContent.fromSlugOrID(this.launcher, this.got, i.project_id));
                }
            }
        }
        return dependencies;
    }
    async getVersionFileURL(): Promise<string> {
        return this.file.url;
    }

    async getVersionFileSHA1(): Promise<string> {
        return this.file.hashes.sha1;
    }
    
}
export class ModrinthContent implements Content {
    constructor(private launcher: Launcher, private got: Got, private model: ModrinthProject) {

    }

    isVersion = false as const;

    /**
     * @internal
     * @throws RequestError
     */
    static async fromSlugOrID(launcher: Launcher, got_: Got, slug: string): Promise<ModrinthContent> {
        return new ModrinthContent(launcher, got_, await got_(`project/${slug}`).json());
    }

    getType(): ContentType {
        return modrinthToContentType[this.model.project_type];
    }

    async isLibrary(): Promise<boolean> {
        return this.model.categories.includes("library");
    }
    async getBody(): Promise<string> {
        return await marked(this.model.body ?? "");
    }
    async getScreenshots(): Promise<Screenshot[]> {
        return this.model.gallery;
    }
    async getTitle(): Promise<string> {
        return this.model.title;
    }
    async getDescription(): Promise<string> {
        return this.model.description;
    }
    async getIconURL(): Promise<string> {
        return this.model.icon_url ?? "";
    }
    async getURLs(): Promise<Map<string, string>> {
        const res: Map<string, string> = new Map();
        if (this.model.wiki_url) {
            res.set("wiki", this.model.wiki_url);
        }
        if (this.model.issues_url) {
            res.set("issues", this.model.issues_url);
        }
        if (this.model.source_url) {
            res.set("source", this.model.source_url);
        }
        if (this.model.discord_url) {
            res.set("discord", this.model.discord_url);
        }
        for (const i of this.model.donation_urls ?? []){
            res.set("donate." + i.platform, i.url);
        }
        return res;
    }
    async getOtherInformation(): Promise<Map<string, string>> {
        const res: Map<string, string> = new Map();
        if (this.model.downloads) {
            res.set("downloads", this.model.downloads.toString());
        }
        if (this.model.followers) {
            res.set("followers", this.model.followers.toString());
        }
        if (this.model.license) {
            res.set("license", this.model.license.name);
        }
        if (this.model.published) {
            res.set("published", this.model.published);
        }
        if (this.model.updated) {
            res.set("updated", this.model.updated);
        }
        return res;
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
                game_versions: JSON.stringify([forVersion.extras.version])
            };
        }
        const versions: ModrinthVersionModel[] = await this.got(`project/${this.model.slug}/version`, {
            searchParams
        }).json();
        return versions.map((v) => {
            return new ModrinthContentVersion(v, this.got, this.launcher);
        });
    }

    isVanillaOrCanvasShader(): boolean {
        return this.model.project_type == "shader" && (this.model.loaders.includes("canvas") || this.model.loaders.includes("vanilla"));
    }
}
export default class ModrinthContentService implements ContentService<string> {
    private got: Got;
    constructor(private launcher: Launcher) {
        this.got = got.extend({
            prefixUrl: "https://api.modrinth.com/v2/",
            headers: {
                "user-agent": `${this.launcher.name}, using heipiao233/dmclc/${Launcher.version} (heipiao233@outlook.com)`
            }
        });
    }
    async getVersionFromFile(path: string): Promise<ContentVersion | null> {
        try {
            return new ModrinthContentVersion(await this.got(`version_file/${crypto.createHash("sha1").update(await fsPromises.readFile(path)).digest("hex")}?algorithm=sha1`).json(), this.got, this.launcher);
        } catch (e){
            return null;
        }
    }
    getUnsupportedContentTypes(): ContentType[] {
        return [ContentType.WORLD];
    }
    getSortFields(): Record<string, string> {
        return ModrinthSortField;
    }

    getDefaultSortField(): string {
        return ModrinthSortField.RELEVANCE;
    }

    async searchContent(name: string, skip: number, limit: number, type: ContentType, sortField: string, forVersion?: MinecraftVersion | undefined): Promise<Content[]> {
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
                index: sortField
            }
        }).json();
        const result = [];
        for (const i of res.hits) {
            result.push(ModrinthContent.fromSlugOrID(this.launcher, this.got, i.slug));
        }
        return await Promise.all(result);
    }

}