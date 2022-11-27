import { YggdrasilAccount } from "./yggdrasil/yggdrasil_account.js";
import fs from "fs";
import { download } from "../utils/downloads.js";
import { YggdrasilUserData } from "./yggdrasil/yggdrasil_data.js";

export declare class MinecraftUniversalLoginUserData extends YggdrasilUserData {
    serverID: string;
}
export class MinecraftUniversalLoginAccount extends YggdrasilAccount<MinecraftUniversalLoginUserData> {
    constructor (data: MinecraftUniversalLoginUserData, root: string) {
        data.apiurl = "https://auth.mc-user.com:233/" + data.serverID;
        super(data, root);
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
        return `${this.data.name} - ${this.data.serverID} (Minecraft Universal Login)`;
    }
}
