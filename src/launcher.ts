import compressing from "compressing";
import fs from "fs";
import { mkdirsSync } from "fs-extra";
import * as i18next from "i18next";
import FsBackend, { FsBackendOptions } from "i18next-fs-backend";
import os from "os";
import path from "path";
import { Account } from "./auth/account";
import { AuthlibInjectorAccount } from "./auth/ali_account";
import { MicrosoftAccount } from "./auth/microsoft/microsoft_account";
import { MinecraftUniversalLoginAccount } from "./auth/mul_account";
import { OfflineAccount } from "./auth/offline_account";
import { FormattedError } from "./errors/FormattedError";
import { Installer } from "./install";
import { FabricLoader } from "./loaders/fabric";
import { VersionParser } from "./loaders/fabriclike/version/VersionParser";
import { ForgeLoader } from "./loaders/forge/forge";
import { Loader } from "./loaders/loader";
import { QuiltLoader } from "./loaders/quilt/quilt";
import ContentService from "./mods/download/ContentService";
import CurseForgeContentService from "./mods/download/curseforge/CurseForgeContentService";
import ModrinthContentService from "./mods/download/modrinth/ModrinthContentService";
import { ModpackFormat } from "./mods/modpack/Modpack";
import { ModrinthModpackFormat } from "./mods/modpack/modrinth/ModrinthModpack";
import { Library } from "./schemas";
import { download } from "./utils/downloads";
import { MinecraftVersion } from "./version";
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
    private realRootPath = "";
    version = "3.9.0-alpha.1";
    /**
     * Create a new Launcher object.
     * @throws {@link FormattedError}
     * @param rootPath - path to .minecraft
     * @param name - Launcher name.
     * @param javaExec - {@link Launcher.usingJava}
     */
    protected constructor (rootPath: string, public name: string, javaExec: string,
        public clientId: string,
        public downloader?: (url: string, filename: fs.PathLike, oldURL: string) => Promise<void>,
        public copy?: (arg: string) => void) {
        this.rootPath = fs.realpathSync(rootPath);
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
        this.accountTypes.set("microsoft", (data)=>new MicrosoftAccount(data, this));
        this.accountTypes.set("offline", (data)=>new OfflineAccount(data, this));
        this.accountTypes.set("authlib_injector", (data)=>new AuthlibInjectorAccount(data, this));
        this.accountTypes.set("minecraft_universal_login", (data)=>new MinecraftUniversalLoginAccount(data, this));
        this.contentServices.set("modrinth", new ModrinthContentService(this));
        this.contentServices.set("curseforge", new CurseForgeContentService(this));
        this.modpackFormats.set("modrinth", new ModrinthModpackFormat());
    }

    /**
     * Create a new Launcher object.
     * @throws {@link FormattedError}
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
        downloader?: (url: string, filename: fs.PathLike, oldURL: string) => Promise<void>,
        copy?: (arg: string) => void
    ): Promise<Launcher> {
        const launcher = new Launcher(rootPath, name, javaExec, clientId, downloader, copy);
        await launcher.init();
        return launcher;
    }

    private async init(lang = "en_us") {
        // HMCL, pioneer of cross-architecture launcher.
        if(os.platform() === "linux") {
            if(process.arch !== "x64" && process.arch !== "ia32") {
                await download("https://raw.githubusercontent.com/huanghongxun/HMCL/javafx/HMCL/src/main/resources/assets/natives.json", "./natives.json", this);
                const specialNatives = JSON.parse((await fs.promises.readFile("./natives.json")).toString())[this.getArchString()];
                this.archInfo = {
                    specialArch: process.arch,
                    specialNatives
                };
            }
        }
        if (!fs.existsSync("./locales") || (await fs.promises.readFile("./locales/version")).toString().trim() !== this.version) {
            await download("https://heipiao233.github.io/dmclc/locales.tar.gz", "./locales.tar.gz", this);
            await compressing.tgz.uncompress("./locales.tar.gz", ".");
        }
        this.i18n = await i18next.use(FsBackend).init<FsBackendOptions>({
            lng: lang,
            backend: {
                loadPath: path.join(process.cwd(), "./locales/{{lng}}.json")
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
}