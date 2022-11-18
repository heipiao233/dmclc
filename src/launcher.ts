import os from "os";
import { Installer, ModuleInstaller } from "./install.js";
import { ModuleType } from "./modules/mc_module.js";
import { RunMinecraft } from "./run.js";
import { FabricModule } from "./modules/fabric.js";
import { QuiltModule } from "./modules/quilt/quilt.js";
import { ForgeModule } from "./modules/forge/forge.js";
export class Launcher {
    rootPath: string;
    systemType = os.platform();
    separator: string;
    natives: "natives-linux" | "natives-macos" | "natives-osx" | "natives-windows";
    mirror = "bmclapi2.bangbang93.com";
    usingJava = "C:\\Program Files\\Microsoft\\jdk-17.0.2.8-hotspot\\bin\\java.exe";
    installer: Installer = new Installer(this);
    moduleInstaller: ModuleInstaller = new ModuleInstaller(this);
    runner: RunMinecraft = new RunMinecraft(this);
    name: string;
    moduleTypes: Map<string, ModuleType> = new Map();
    constructor (rootPath: string, name: string) {
        this.name = name;
        this.rootPath = rootPath;
        if (this.systemType === "win32") {
            this.separator = ";";
            this.natives = "natives-windows";
        } else {
            this.separator = ":";
            if (this.systemType === "linux") {
                this.natives = "natives-linux";
            } else {
                this.natives = "natives-macos";
            }
        }
        this.moduleTypes.set("fabric", new FabricModule(this));
        this.moduleTypes.set("quilt", new QuiltModule(this));
        this.moduleTypes.set("forge", new ForgeModule(this));
    }
}
