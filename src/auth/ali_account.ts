import fs from "fs";
import got from "got";
import { checkFile } from "../utils/check_file.js";
import { download } from "../utils/downloads.js";
import { MinecraftVersion } from "../version.js";
import { YggdrasilAccount } from "./yggdrasil/yggdrasil_account.js";
import { YggdrasilUserData } from "./yggdrasil/yggdrasil_data.js";

type AuthlibInjectorArtifact = {
    download_url: string;
    checksums: {
        sha256: string;
    }
}

export class AuthlibInjectorAccount extends YggdrasilAccount<YggdrasilUserData> {

    getUserExtraContent(): Record<string, string> {
        return Object.assign({
            apiurl: this.launcher.i18n("accounts.authlib_injector.apiurl")
        }, super.getUserExtraContent());
    }

    async readUserExtraContent(content: Map<string, string>): Promise<void> {
        this.data.apiurl = await getRealApiUrl(content.get("apiurl")!);
        await super.readUserExtraContent(content);
    }

    async prepareLaunch (): Promise<void> {
        const obj = await got("https://bmclapi2.bangbang93.com/mirrors/authlib-injector/artifact/latest.json").json<AuthlibInjectorArtifact>();
        const sha256 = obj.checksums.sha256;
        const path = `${this.root.toString()}/authlib-injector-latest.jar`;
        if (!fs.existsSync(path) || !checkFile(path, sha256, "sha256")) {
            await download(obj.download_url, path);
        }
    }

    async getLaunchJVMArgs (mc: MinecraftVersion): Promise<string[]> {
        const content = (await got(this.data.apiurl!)).body;
        return [`-javaagent:${mc.extras.enableIndependentGameDir?"../..":"."}/authlib-injector-latest.jar=${this.data.apiurl}`, `-Dauthlibinjector.yggdrasil.prefetched=${Buffer.from(content).toString("base64")}`];
    }
    toString (): string {
        return `${this.data.name} (${this.data.serverName})`;
    }
}
async function getRealApiUrl(input: string): Promise<string> {
    const api = (await got.get(input)).headers["x-authlib-injector-api-location"];
    if(api instanceof Array || api === undefined) return input;
    return new URL(api, input).toString();
}
