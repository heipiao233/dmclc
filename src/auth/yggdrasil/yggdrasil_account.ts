import got from "got";
import { MinecraftVersion } from "../../version.js";
import { Account } from "../account.js";
import { YggdrasilUserData } from "./yggdrasil_data.js";

type ATCT = {
    accessToken: string,
    clientToken: string
};
export abstract class YggdrasilAccount<T extends YggdrasilUserData> implements Account<T> {
    data: T;
    protected root: string;
    constructor(data: T, root: string) {
        this.data = data;
        this.root = root;
    }

    abstract prepareLaunch(): Promise<void>
    abstract getLaunchJVMArgs(mc: MinecraftVersion): Promise<string[]>
    async getLaunchGameArgs(): Promise<Map<string, string>> {
        const map: Map<string, string> = new Map();
        const at = await this.getAccessToken();
        map.set("auth_access_token", at);
        map.set("auth_session", at);
        map.set("auth_player_name", this.data.name!);
        map.set("user_type", "mojang");
        map.set("user_properties", "{}");
        return map;
    }

    getUserExtraContent(): string[] {
        return ["username", "password", "profileId"];
    }

    async readUserExtraContent(content: Map<string, string>): Promise<void> {
        const profileId: number = Number.parseInt(content.get("profileId")!);
        const res: ATCT & {
            availableProfiles: {
                id: string,
                name: string
            }[]
        } = await got.post(this.data.apiurl + "/authserver/authenticate", {
            json: {
                username: content.get("username"),
                password: content.get("password"),
                requestUser: true,
                agent: {
                    name: "Minecraft",
                    version: 1
                }
            }
        }).json();
        this.data.accessToken = res.accessToken;
        this.data.clientToken = res.clientToken;
        this.data.uuid = res.availableProfiles[profileId].id;
        this.data.name = res.availableProfiles[profileId].name;
        const meta: {
            meta: {
                serverName: string
            }
        } = await got(this.data.apiurl!).json();
        this.data.serverName = meta.meta.serverName;
    }

    async check(): Promise<boolean> {
        const req = await got.post(this.data.apiurl + "/authserver/validate", {
            json: {
                accessToken: this.data.accessToken,
                clientToken: this.data.clientToken
            }
        });
        if(req.statusCode === 204) {
            return true;
        }
        return await this.refresh();
    }

    private async refresh(): Promise<boolean> {
        const req = await got.post<ATCT>(this.data.apiurl + "/authserver/refresh", {
            json: {
                accessToken: this.data.accessToken,
                clientToken: this.data.clientToken
            },
            responseType: "json"
        });
        if(req.statusCode < 200 || req.statusCode >= 300) {
            return false;
        }
        const res: ATCT = req.body;
        this.data.accessToken = res.accessToken;
        this.data.clientToken = res.clientToken;
        return true;
    }

    getUUID(): string {
        return this.data.uuid!;
    }

    async getAccessToken(): Promise<string> {
        return this.data.accessToken!;
    }
}
