import fs from "fs";
import { mkdirsSync } from "fs-extra";
import os from "os";
import { Account } from "./auth/account.js";
import { AuthlibInjectorAccount } from "./auth/ali_account.js";
import { MicrosoftAccount } from "./auth/microsoft/microsoft_account.js";
import { MinecraftUniversalLoginAccount } from "./auth/mul_account.js";
import { OfflineAccount } from "./auth/offline_account.js";
import { Installer } from "./install.js";
import { FabricLoader } from "./loaders/fabric.js";
import { ForgeLoader } from "./loaders/forge/forge.js";
import { Loader } from "./loaders/loader.js";
import { QuiltLoader } from "./loaders/quilt/quilt.js";
import { MinecraftVersion } from "./version.js";
/**
 * The core of DMCLC.
 * @public
 */
export class Launcher {
    /** The path to the ".minecraft" directory. */
    rootPath: string;
    /** @see os.platform */
    systemType = os.platform();
    /** : or ; */
    separator: string;
    natives: "linux" | "osx" | "windows";
    /** BMCLAPI */
    mirror: string | undefined;
    installer: Installer = new Installer(this);
    /** The name of your launcher. */
    name: string;
    /** All loaders. */
    loaders: Map<string, Loader<unknown>> = new Map();
    /** All account types. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountTypes: Map<string, (data: Record<string, unknown>) => Account<any>> = new Map();
    /** Using Java executable */
    usingJava: string;
    /** All installed versions. */
    installedVersions: Map<string, MinecraftVersion>;
    /**
     * Create a new Launcher object.
     * @param rootPath - {@link Launcher.rootPath}
     * @param name - {@link Launcher.name}
     * @param javaExec - {@link Launcher.usingJava}
     */
    constructor (rootPath: string, name: string, javaExec: string) {
        this.name = name;
        this.rootPath = fs.realpathSync(rootPath);
        this.usingJava = javaExec;
        if (this.systemType === "win32") {
            this.separator = ";";
            this.natives = "windows";
        } else {
            this.separator = ":";
            if (this.systemType === "linux") {
                this.natives = "linux";
            } else if(this.systemType === "darwin") {
                this.natives = "osx";
            }else{
                throw new Error("Unsupported platform");
            }
        }
        this.loaders.set("fabric", new FabricLoader(this));
        this.loaders.set("quilt", new QuiltLoader(this));
        this.loaders.set("forge", new ForgeLoader(this));
        this.accountTypes.set("microsoft", (data)=>new MicrosoftAccount(data));
        this.accountTypes.set("offline", (data)=>new OfflineAccount(data));
        this.accountTypes.set("authlib_injector", (data)=>new AuthlibInjectorAccount(data, this.rootPath));
        this.accountTypes.set("minecraft_universal_login", (data)=>new MinecraftUniversalLoginAccount(data, this.rootPath));
        this.installedVersions = this.getInstalledVersions();
    }

    /**
     * Gets all installed versions, no cache.
     * @returns All installed versions.
     */
    getInstalledVersions(): Map<string, MinecraftVersion> {
        const value = new Map<string, MinecraftVersion>();
        if (!fs.existsSync(`${this.rootPath}/versions`)) {
            mkdirsSync(`${this.rootPath}/versions`);
            return new Map();
        }
        fs.readdirSync(`${this.rootPath}/versions`)
            .filter(value=>fs.existsSync(`${this.rootPath}/versions/${value}/${value}.json`))
            .forEach(name=>value.set(name, MinecraftVersion.fromVersionName(this, name)));
        return value;
    }
}
