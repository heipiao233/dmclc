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

    async login(): Promise<boolean> {
        this.data.serverID = await this.launcher.askUserOne("accounts.minecraft_universal_login.serverID");
        this.data.apiurl = "https://auth.mc-user.com:233/" + this.data.serverID;
        return await super.login();
    }

    async prepareLaunch (): Promise<boolean> {
        const path = `${this.root}/nide8auth.jar`;
        if (!fs.existsSync(path)) {
            return await download("https://login.mc-user.com:233/index/jar", path, this.launcher);
        }
        return true;
    }

    async getLaunchJVMArgs (): Promise<string[]> {
        return [`-javaagent:./nide8auth.jar=${this.data.serverID}`, "-Dnide8auth.client=true"];
    }
    toString (): string {
        return `${this.data.name} (${this.data.serverName})`;
    }
}
