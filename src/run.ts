import fs from "fs";
import cp from "child_process";
import iconv from "iconv-lite";
import { Argument, checkRules, McInstallation } from "./schemas.js";
import { mkdirs } from "./utils/mkdirs.js";
import { tmpdir } from "os";
import { Launcher } from "./launcher.js";
import { Account } from "./auth/account.js";
import { expandMavenId } from "./utils/maven.js";
export class RunMinecraft {
    launcher: Launcher;
    constructor (launcher: Launcher) {
        this.launcher = launcher;
    }

    getInstalledVersions (): string[] {
        if (!fs.existsSync("./versions")) {
            mkdirs("./versions");
            return [];
        }
        const value = fs.readdirSync("./versions").filter((value) => {
            return fs.existsSync(`./versions/${value}/${value}.json`);
        });
        return value;
    }

    getClassPath (versionObject: McInstallation, versionName: string): string[] {
        const res: string[] = [];
        versionObject.libraries.filter(i => i.rules === undefined || checkRules(i.rules)).forEach((i) => {
            if (i.downloads === undefined) {
                res.push(`./libraries/${expandMavenId(i.name)}`);
            } else {
                if (typeof (i.downloads.artifact) === "object")res.push(`./libraries/${i.downloads.artifact.path}`);
                if (typeof (i.downloads.classifiers) === "object" && this.launcher.natives in i.downloads.classifiers) {
                    res.push(`${tmpdir()}/${this.launcher.name}_natives/${i.downloads.classifiers[this.launcher.natives].path}`);
                }
            }
        });
        if (!versionObject.mainClass.startsWith("cpw"))res.push(`./versions/${versionName}/${versionName}.jar`);// Forge
        return res;
    }

    parseArgument (arg: string | Argument, versionObject: McInstallation, versionName: string, account: Account, argOverrides: Map<string, string>): string {
        let argVal: string;
        if (typeof arg === "object") {
            if (arg.value instanceof Array)argVal = arg.value.join(" ");
            else argVal = arg.value;
        } else argVal = arg;
        argVal = argVal.replaceAll("${version_name}", `${this.launcher.name}`)
            .replaceAll("${game_directory}", ".")
            .replaceAll("${assets_root}", "./assets")
            .replaceAll("${assets_index_name}", versionObject.assets)
            .replaceAll("${auth_uuid}", `${account.getUUID()}`)
            .replaceAll("${version_type}", `${this.launcher.name}`)
            .replaceAll("${natives_directory}", "./natives")
            .replaceAll("${launcher_name}", `${this.launcher.name}`)
            .replaceAll("${launcher_version}", "0.1")
            .replaceAll("${library_directory}", "./libraries/")
            .replaceAll("${classpath_separator}", this.launcher.separator)
            .replaceAll("${classpath}", this.getClassPath(versionObject, versionName).join(this.launcher.separator));
        argOverrides.forEach((v, k) => {
            argVal = argVal.replaceAll("${" + k + "}", v);
        });
        return argVal;
    }

    async getArguments (versionObject: McInstallation, versionName: string, account: Account): Promise<string[]> {
        const res: string[] = [];
        const args = await account.getLaunchGameArgs();
        if (versionObject.arguments !== undefined) {
            versionObject.arguments.jvm.map(async i => {
                if (typeof (i) === "string") {
                    res.push(this.parseArgument(i, versionObject, versionName, account, args));
                }
            });
            res.push(versionObject.mainClass);
            versionObject.arguments.game.map(async i => {
                if (typeof (i) === "string") {
                    res.push(this.parseArgument(i, versionObject, versionName, account, args));
                }
            });
        } else {
            res.push("-cp " + this.getClassPath(versionObject, versionName).join(this.launcher.separator));
            res.push(versionObject.mainClass);
        }
        return res;
    }

    async runInstalledVersion (name: string, account: Account): Promise<void> {
        await account.prepareLaunch();
        const versionObject: McInstallation = JSON.parse(fs.readFileSync(`${this.launcher.rootPath.toString()}/versions/${name}/${name}.json`).toString());
        await this.launcher.installer.install_json(name, versionObject);
        const args = await this.getArguments(versionObject, name, account);
        const allArguments = (await account.getLaunchJVMArgs()).concat(args);
        console.log(allArguments.join(" "));
        const proc = cp.execFile(this.launcher.usingJava, allArguments, { cwd: this.launcher.rootPath.toString(), encoding: "base64" });
        proc.stdout?.on("data", (chunk) => {
            console.log(iconv.decode(Buffer.from(chunk, "base64"), "gbk"));
        });
        proc.stderr?.on("data", (chunk) => {
            console.error(iconv.decode(Buffer.from(chunk, "base64"), "gbk"));
        });
        await new Promise<void>((resolve, reject) => {
            proc.on("close", (code) => {
                if (code === 0)resolve();
                reject(code);
            });
        });
    }
}
