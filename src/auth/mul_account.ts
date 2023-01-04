import fs from "fs";
import { Launcher } from "../launcher.js";
import { download } from "../utils/downloads.js";
import { YggdrasilAccount } from "./yggdrasil/yggdrasil_account.js";
import { YggdrasilUserData } from "./yggdrasil/yggdrasil_data.js";

export class MinecraftUniversalLoginUserData extends YggdrasilUserData {
    serverID?: string;
}
export class MinecraftUniversalLoginAccount extends YggdrasilAccount<MinecraftUniversalLoginUserData> {
    constructor (data: MinecraftUniversalLoginUserData, launcher: Launcher) {
        super(data, launcher);
    }

    getUserExtraContent(): Record<string, string> {
        return Object.assign({
            serverID: this.launcher.i18n("accounts.minecraft_universal_login.serverID")
        }, super.getUserExtraContent());
    }

    async readUserExtraContent(content: Map<string, string>): Promise<void> {
        this.data.serverID = content.get("serverID")!;
        this.data.apiurl = "https://auth.mc-user.com:233/" + this.data.serverID;
        await super.readUserExtraContent(content);
    }

    async prepareLaunch (): Promise<void> {
        const path = `${this.root}/nide8auth.jar`;
        if (!fs.existsSync(path)) {
            await download("https://login.mc-user.com:233/index/jar", path);
        }
    }

    async getLaunchJVMArgs (): Promise<string[]> {
        return [`-javaagent:./nide8auth.jar=${this.data.serverID}`, "-Dnide8auth.client=true"];
    }
    toString (): string {
        return `${this.data.name} (${this.data.serverName})`;
    }
}
