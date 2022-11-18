import { ModuleType } from "../mc_module.js";
import { Launcher } from "../../launcher.js";
import { parseStringPromise } from "xml2js";
import { got } from "got";
import { download } from "../../utils/downloads.js";
import { tmpdir } from "os";
import fs from "fs";
import { InstallerProfile } from "./install_profile.js";
import compressing from "compressing";
import { McInstallation } from "../../schemas.js";
import { expandMavenId } from "../../utils/maven.js";
import { execFileSync } from "child_process";
import StreamZip from "node-stream-zip";

export class ForgeModule implements ModuleType {
    private readonly launcher: Launcher;
    private readonly metadata = "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";
    constructor (launcher: Launcher) {
        this.launcher = launcher;
    }

    async getSuitableModuleVersions (MCVersion: string): Promise<string[]> {
        const res = await got(this.metadata);
        const obj = await parseStringPromise(res.body);
        const versions: string[] = obj.metadata.versioning[0].versions[0].version;
        return versions.filter((v: string) => v.startsWith(`${MCVersion}-`));
    }

    async install (MCVersion: string, MCName: string, version: string): Promise<void> {
        const path = `${tmpdir()}/forge-${version}-installer.jar`;
        await download(`https://maven.minecraftforge.net/net/minecraftforge/forge/${version}/forge-${version}-installer.jar`, path, this.launcher.mirror);
        const installer = `${tmpdir()}/${this.launcher.name}_forge_installer`;
        await compressing.zip.uncompress(fs.createReadStream(path), installer);
        const metadata: InstallerProfile = JSON.parse(fs.readFileSync(`${installer}/install_profile.json`).toString());
        await this.launcher.installer.installLibs(metadata.libraries);
        const target: McInstallation = JSON.parse(fs.readFileSync(`${this.launcher.rootPath}/versions/${MCName}/${MCName}.json`).toString());
        const source: McInstallation = JSON.parse(fs.readFileSync(`${installer}/version.json`).toString());
        target.arguments.game.push(...source.arguments.game);
        target.arguments.jvm.push(...source.arguments.jvm);
        target.mainClass = source.mainClass;
        target.libraries.push(...source.libraries);
        await this.launcher.installer.installLibs(source.libraries);
        for (const item of metadata.processors) {
            if (item.sides === undefined || item.sides.includes("client")) {
                const jar = `${this.launcher.rootPath}/libraries/${expandMavenId(item.jar)}`;
                const args = ["-cp",
                    `${item.classpath.map((i) => {
                        return `${this.launcher.rootPath}/libraries/${expandMavenId(i)}`;
                    }).join(this.launcher.separator)};${jar}`,
                    await getMainClass(jar),
                    ...item.args.map((v) => this.transformArguments(v, MCName, metadata))];
                console.log(args);
                console.log(execFileSync(this.launcher.usingJava, args).toString());
            }
        }
        fs.writeFileSync(`${this.launcher.rootPath}/versions/${MCName}/${MCName}.json`, JSON.stringify(target));
    }

    transformArguments (arg: string, MCName: string, metadata: InstallerProfile): string {
        return arg.replaceAll(/\{(.+?)\}/, (v, a) => {
            if (a === "SIDE") return "client";
            if (a === "MINECRAFT_JAR") return `${this.launcher.rootPath}/versions/${MCName}/${MCName}.jar`;
            if (a === "BINPATCH") return `${tmpdir()}/${this.launcher.name}_forge_installer/data/client.lzma`;
            return metadata.data[a].client;
        }).replaceAll(/\[(.+?)\]/, (v, a) => `${this.launcher.rootPath}/libraries/${expandMavenId(a)}`);
    }
}
async function getMainClass (jar: string): Promise<string> {
    /* eslint-disable new-cap */
    const zip = new StreamZip.async({
        file: jar
    });
    return (await zip.entryData("META-INF/MANIFEST.MF")).toString().split("\n").filter(i => i.startsWith("Main-Class:"))[0].replaceAll("Main-Class:", "").trim();
}
