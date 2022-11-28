import { YggdrasilAccount } from "./yggdrasil/yggdrasil_account.js";
import fs from "fs";
import { download } from "../utils/downloads.js";
import { YggdrasilUserData } from "./yggdrasil/yggdrasil_data.js";

export declare class MinecraftUniversalLoginUserData extends YggdrasilUserData {
    serverID: string;
}
export class MinecraftUniversalLoginAccount extends YggdrasilAccount<MinecraftUniversalLoginUserData> {
    constructor (data: MinecraftUniversalLoginUserData, root: string) {
        super(data, root);
    }

    getUserExtraContent(): string[] {
        return super.getUserExtraContent().concat(["serverID"]);
    }

    async readUserExtraContent(content: Map<string, string>): Promise<void> {
        this.data.serverID = content.get("serverID")!;
        this.data.apiurl = "https://auth.mc-user.com:233/" + this.data.serverID;
        super.readUserExtraContent(content);
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
