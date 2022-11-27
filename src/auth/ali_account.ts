import { get } from "../utils/http_request.js";
import { YggdrasilAccount } from "./yggdrasil/yggdrasil_account.js";
import fs from "fs";
import { checkFile } from "../utils/check_file.js";
import { download } from "../utils/downloads.js";
import { YggdrasilUserData } from "./yggdrasil/yggdrasil_data.js";
import { Version } from "../version.js";
export class AuthlibInjectorAccount extends YggdrasilAccount<YggdrasilUserData> {
    async prepareLaunch (): Promise<void> {
        const obj = JSON.parse(await get("https://bmclapi2.bangbang93.com/mirrors/authlib-injector/artifact/latest.json", ""));
        const sha256 = obj.checksums.sha256;
        const path = `${this.root.toString()}/authlib-injector-latest.jar`;
        if (!fs.existsSync(path) || !checkFile(path, sha256, "sha256")) {
            await download(obj.download_url, path);
        }
    }

    async getLaunchJVMArgs (mc: Version): Promise<string[]> {
        const content = await get(this.data.apiurl, "");
        return [`-javaagent:${mc.extras.enableIndependentGameDir?"../..":"."}/authlib-injector-latest.jar=${this.data.apiurl}`, `-Dauthlibinjector.yggdrasil.prefetched=${Buffer.from(content).toString("base64")}`];
    }
    toString (): string {
        return `${this.data.name} (Authlib Injector)`;
    }
}
