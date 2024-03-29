import compressing from "compressing";
import fs from "fs";
import { mkdirsSync, remove } from "fs-extra";
import * as i18next from "i18next";
import FsBackend, { FsBackendOptions } from "i18next-fs-backend";
import { marked } from "marked";
import os, { homedir } from "os";
import { pathToFileURL } from "url";
import { Account } from "./auth/account.js";
import { AuthlibInjectorAccount } from "./auth/ali_account.js";
import { MicrosoftAccount } from "./auth/microsoft/microsoft_account.js";
import { MinecraftUniversalLoginAccount } from "./auth/mul_account.js";
import { OfflineAccount } from "./auth/offline_account.js";
import { FormattedError } from "./errors/FormattedError.js";
import { Installer } from "./install.js";
import { FabricLoader } from "./loaders/fabric.js";
import { VersionParser } from "./loaders/fabriclike/version/VersionParser.js";
import { ForgeLoader } from './loaders/forge.js';
import { Loader } from "./loaders/loader.js";
import { NeoForgeLoader } from "./loaders/neoforge.js";
import { QuiltLoader } from "./loaders/quilt/quilt.js";
import { ContentService } from "./mods/download/ContentService.js";
import CurseForgeContentService from "./mods/download/curseforge/CurseForgeContentService.js";
import ModrinthContentService from "./mods/download/modrinth/ModrinthContentService.js";
import { ModpackFormat } from "./mods/modpack/Modpack.js";
import { CurseForgeModpackFormat } from "./mods/modpack/curseforge/CurseForgeModpack.js";
import { ModrinthModpackFormat } from "./mods/modpack/modrinth/ModrinthModpack.js";
import { Library } from "./schemas.js";
import { checkAndDownload, download, downloadIntoStream } from "./utils/downloads.js";
import { MinecraftVersion } from "./version.js";
import envPaths from "env-paths";
import * as fsPromise from "fs/promises";
let temp = (await import("temp")).track();

export interface Progress {
    update(msg: string): void;
    close(): void;
}

class LocalizedProgress implements Progress {
    constructor(private dest: Progress, private t: i18next.TFunction) {
        
    }

    update(msg: string): void {
        this.dest.update(this.t(msg));
    }

    close(): void {
        this.dest.close();
    }
}

export interface LauncherInterface {
    askUser<T extends string>(questions: Record<T, string>, message?: string): Promise<Record<T, string>>;
    askUserOne(localized: string, message?: string): Promise<string>;
    info(message: string, title: string): Promise<void>;
    warn(message: string, title: string): Promise<void>;
    error(message: string, title: string): Promise<void>;
    createProgress(steps: number, title: string, msg: string): Progress;
}

/**
 * The core of DMCLC.
 * @public
 */
export class Launcher {
    /** @see os.platform */
    systemType = os.platform();
    natives: "linux" | "osx" | "windows";
    /** BMCLAPI */
    mirror: string | undefined;
    installer: Installer = new Installer(this);
    /** All loaders. */
    loaders: Map<string, Loader<unknown>> = new Map();
    /** All account types. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountTypes: Map<string, (data: Record<string, unknown>) => Account<any>> = new Map();
    contentServices: Map<string, ContentService<unknown>> = new Map();
    modpackFormats: Map<string, ModpackFormat> = new Map();
    /** Using Java executable */
    usingJava: string;
    /** All installed versions. */
    installedVersions: Map<string, MinecraftVersion> = new Map();
    i18n: i18next.TFunction = i18next.t;
    archInfo?: {
        specialArch: string;
        specialNatives: Record<string, Library>;
    };
    envPaths = envPaths("DMCLC");
    private realRootPath = "";
    static readonly version = "4.4.0-beta.2";
    /**
     * Create a new Launcher object.
     * @throws {@link FormattedError}
     * @param rootPath - path to .minecraft
     * @param name - Launcher name.
     * @param javaExec - {@link Launcher.usingJava}
     */
    protected constructor (rootPath: string, public name: string, javaExec: string,
        public clientId: string,
        private launcherInterface: LauncherInterface,
        public downloader?: (url: string, filename: fs.PathLike, oldURL: string) => Promise<void>,
        public copy?: (arg: string) => void) {
        this.realRootPath = fs.realpathSync(rootPath);
        this.usingJava = javaExec;
        if (this.systemType === "win32") {
            this.natives = "windows";
        } else {
            if (this.systemType === "linux") {
                this.natives = "linux";
            } else if(this.systemType === "darwin") {
                this.natives = "osx";
            }else{
                throw new FormattedError("Unsupported platform.");
            }
        }
        this.loaders.set("fabric", new FabricLoader(this));
        this.loaders.set("quilt", new QuiltLoader(this));
        this.loaders.set("forge", new ForgeLoader(this));
        this.loaders.set("neoforge", new NeoForgeLoader(this));
        this.accountTypes.set("microsoft", (data)=>new MicrosoftAccount(data, this));
        this.accountTypes.set("offline", (data)=>new OfflineAccount(data, this));
        this.accountTypes.set("authlib_injector", (data)=>new AuthlibInjectorAccount(data, this));
        this.accountTypes.set("minecraft_universal_login", (data)=>new MinecraftUniversalLoginAccount(data, this));
        this.contentServices.set("modrinth", new ModrinthContentService(this));
        this.contentServices.set("curseforge", new CurseForgeContentService(this));
        this.modpackFormats.set("modrinth", new ModrinthModpackFormat());
        this.modpackFormats.set("curseforge", new CurseForgeModpackFormat());
        this.refreshInstalledVersion();
    }

    /**
     * Create a new Launcher object.
     * @throws {@link FormattedError}
     * @throws RequestError
     * @param rootPath - path to .minecraft
     * @param name - Launcher name.
     * @param javaExec - {@link Launcher.usingJava}
     * @param clientId - Microsoft identify platform APP id.
     * @param downloader - Custom downloading function.
     * @param copy - Custom clipboard function.
     * @returns Launcher.
     */
    static async create(rootPath: string, name: string, javaExec: string,
        clientId: string,
        launcherInterface: LauncherInterface,
        lang: string = "en_us",
        downloader?: (url: string, filename: fs.PathLike, oldURL: string) => Promise<void>,
        copy?: (arg: string) => void
    ): Promise<Launcher> {
        const launcher = new Launcher(rootPath, name, javaExec, clientId, launcherInterface, downloader, copy);
        await launcher.init(lang);
        return launcher;
    }

    private async init(lang: string) {
        if (fs.existsSync(`${homedir()}/.dmclc`)) {
            await fsPromise.rm(`${homedir()}/.dmclc`, {recursive: true, force: true});
        }
        if(os.platform() === "linux") {
            // Special thanks to HMCL. Sorry for I'm not able to check if this works properly.
            if(process.arch !== "x64" && process.arch !== "ia32") {
                await checkAndDownload("https://raw.githubusercontent.com/huanghongxun/HMCL/javafx/HMCL/src/main/resources/assets/natives.json", `${this.envPaths.cache}/natives.json`, "", this);
                const specialNatives = JSON.parse((await fs.promises.readFile(`${this.envPaths.cache}/natives.json`)).toString())[this.getArchString()];
                this.archInfo = {
                    specialArch: process.arch,
                    specialNatives
                };
            }
        }
        if (!fs.existsSync(`${this.envPaths.cache}/locales`)
            || VersionParser.parseSemantic((await fs.promises.readFile(`${this.envPaths.cache}/locales/version`)).toString().trim())
                .compareTo(VersionParser.parseSemantic(Launcher.version)) < 0) {
            await download("https://heipiao233.github.io/dmclc/locales.tar.gz", `${this.envPaths.cache}/locales.tar.gz`, this);
            await compressing.tgz.uncompress(`${this.envPaths.cache}/locales.tar.gz`, this.envPaths.cache);
        }
        this.i18n = await i18next.use(FsBackend).init<FsBackendOptions>({
            lng: lang,
            backend: {
                loadPath: `${this.envPaths.cache}/locales/{{lng}}.json`
            }
        });
    }

    /**
     * Refresh installed versions.
     */
    refreshInstalledVersion() {
        this.installedVersions.clear();
        if (!fs.existsSync(`${this.rootPath}/versions`)) {
            mkdirsSync(`${this.rootPath}/versions`);
            this.installedVersions.clear();
            return;
        }
        fs.readdirSync(`${this.rootPath}/versions`)
            .filter(value => fs.existsSync(`${this.rootPath}/versions/${value}/${value}.json`))
            .forEach(name => this.installedVersions.set(name, MinecraftVersion.fromVersionName(this, name)));
    }

    /**
     * The path to the ".minecraft" directory.
     */
    public get rootPath(): string {
        return this.realRootPath;
    }

    public set rootPath(path: string) {
        this.realRootPath = fs.realpathSync(path);
        this.refreshInstalledVersion();
    }
    
    private getArchString(): string {
        let arch;
        switch (os.arch()) {
        case "arm":
            arch = "arm32";
            break;
                
        case "arm64" || "aarch64":
            arch = "arm64";
            break;

        case "mips64el":
            arch = "mips64el";
            break;

        case "loongarch64":
            if (VersionParser.parse(os.release(), false).compareTo(VersionParser.parse("5.19", false)) <= 0) {
                arch = "loongarch64_ow";
            } else arch = "loongarch64";
            break;

        default:
            arch = os.arch();
            break;
        }
        return `${this.natives}-${arch}`;
    }

    async removeVersion(version: MinecraftVersion) {
        await remove(version.versionRoot);
        this.refreshInstalledVersion();
    }
    
    async askUser<T extends string>(questions: Record<T, string>, message?: string): Promise<Record<T, string>> {
        return await this.launcherInterface.askUser(questions, message);
    }

    async askUserOne(localizeKey: string, message?: string): Promise<string> {
        return await this.launcherInterface.askUserOne(this.i18n(localizeKey), message);
    }

    async info(message: string, title: string = "misc.info") {
        await this.launcherInterface.info(this.i18n(message), this.i18n(title));
    }

    async warn(message: string, title: string = "misc.warn") {
        await this.launcherInterface.warn(this.i18n(message), this.i18n(title));
    }

    async error(message: string, title: string = "misc.error") {
        await this.launcherInterface.error(this.i18n(message), this.i18n(title));
    }

    createProgress(steps: number, title: string, msg: string): Progress {
        return new LocalizedProgress(this.launcherInterface.createProgress(steps, this.i18n(title), this.i18n(msg)), this.i18n);
    }

    setDownloadImages() {
        let self = this;
        marked.setOptions({
            async walkTokens(token) {
                let url = "";
                try {
                    if (token.type == "image"){
                        url = token.href;
                        let file = temp.createWriteStream();
                        await downloadIntoStream(url, file, self);
                        file.close();
                        token.href = pathToFileURL(file.path as string).toString();
                    } else if (token.type == "html") {
                        if (!token.raw.includes("<img"))
                            return;
                        let m = token.raw.match(/src=\"(.+?)\"/);
                        if (!m || m.length < 2) return;
                        url = m[1];
                        let file = temp.createWriteStream();
                        await downloadIntoStream(url, file, self);
                        file.close();
                        token.raw = token.raw.replaceAll(url, pathToFileURL(file.path as string).toString());
                        token.text = token.text.replaceAll(url, pathToFileURL(file.path as string).toString());
                    }
                } catch {
                    self.launcherInterface.error(self.i18n("content_service.image_load_fail_detail", { url }), "content_service.image_load_fail_title")
                }
            },
            gfm: true,
            async: true
        });
    }
}