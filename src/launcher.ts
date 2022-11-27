import os from "os";
import { Installer } from "./install.js";
import { ModuleType } from "./modules/mc_module.js";
import { FabricModule } from "./modules/fabric.js";
import { QuiltModule } from "./modules/quilt/quilt.js";
import { ForgeModule } from "./modules/forge/forge.js";
import { Version } from "./version.js";
import fs from "fs";
import { mkdirsSync } from "fs-extra";
import { Account } from "./auth/account.js";
import { AuthlibInjectorAccount } from "./auth/ali_account.js";
import { MinecraftUniversalLoginAccount } from "./auth/mul_account.js";
import { MicrosoftAccount } from "./auth/microsoft/microsoft_account.js";
import { OfflineAccount } from "./auth/offline_account.js";
export class Launcher {
    rootPath: string;
    systemType = os.platform();
    separator: string;
    natives: "linux" | "osx" | "windows";
    mirror = "bmclapi2.bangbang93.com";
    installer: Installer = new Installer(this);
    name: string;
    moduleTypes: Map<string, ModuleType> = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountTypes: Map<string, (data: never) => Account<any>> = new Map();
    usingJava: string;
    installedVersions: Map<string, Version>;
    constructor (rootPath: string, name: string, javaExec: string) {
        this.name = name;
        this.rootPath = rootPath;
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
        this.moduleTypes.set("fabric", new FabricModule(this));
        this.moduleTypes.set("quilt", new QuiltModule(this));
        this.moduleTypes.set("forge", new ForgeModule(this));
        this.accountTypes.set("microsoft", (data)=>new MicrosoftAccount(data));
        this.accountTypes.set("offline", (data)=>new OfflineAccount(data));
        this.accountTypes.set("authlib_injector", (data)=>new AuthlibInjectorAccount(data, this.rootPath));
        this.accountTypes.set("minecraft_universal_login", (data)=>new MinecraftUniversalLoginAccount(data, this.rootPath));
        this.installedVersions = this.getInstalledVersions();
    }
    getInstalledVersions(): Map<string, Version> {
        const value = new Map<string, Version>();
        if (!fs.existsSync(`${this.rootPath}/versions`)) {
            mkdirsSync(`${this.rootPath}/versions`);
            return new Map();
        }
        fs.readdirSync(`${this.rootPath}/versions`)
            .filter(value=>fs.existsSync(`${this.rootPath}/versions/${value}/${value}.json`))
            .forEach(name=>value.set(name, Version.fromVersionName(this, name)));
        return value;
    }
}
