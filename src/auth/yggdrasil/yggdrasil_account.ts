import got, { Response } from "got";
import { FormattedError } from "../../errors/FormattedError.js";
import { Launcher } from "../../launcher.js";
import { MinecraftVersion } from "../../version.js";
import { Account } from "../account.js";
import { YggdrasilUserData } from "./yggdrasil_data.js";

type ATCT = {
    accessToken: string,
    clientToken: string
};
export abstract class YggdrasilAccount<T extends YggdrasilUserData> implements Account<T> {
    protected root: string;
    constructor(public data: T, protected launcher: Launcher) {
        this.root = launcher.rootPath;
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

    getUserExtraContent(): Record<string, string> {
        return {
            username: this.launcher.i18n("accounts.yggdrasil.username"),
            password: this.launcher.i18n("accounts.yggdrasil.password"),
            profileID: this.launcher.i18n("accounts.yggdrasil.profileID")
        };
    }

    async readUserExtraContent(content: Map<string, string>): Promise<void> {
        const profileID: number = Number.parseInt(content.get("profileID")!);
        const res: Response<ATCT & {
            availableProfiles: {
                id: string,
                name: string
            }[]
        }> = await got.post(this.data.apiurl + "/authserver/authenticate", {
            json: {
                username: content.get("username"),
                password: content.get("password"),
                requestUser: true,
                agent: {
                    name: "Minecraft",
                    version: 1
                }
            },
            throwHttpErrors: false,
            responseType: "json"
        });
        if (res.statusCode === 403) {
            throw new FormattedError(this.launcher.i18n("accounts.yggdrasil.wrong_email_or_password"));
        }
        const obj = res.body;
        this.data.accessToken = obj.accessToken;
        this.data.clientToken = obj.clientToken;
        this.data.uuid = obj.availableProfiles[profileID].id;
        this.data.name = obj.availableProfiles[profileID].name;
        const meta: {
            meta: {
                serverName: string
            }
        } = await got(this.data.apiurl!).json();
        this.data.serverName = meta.meta.serverName;
    }

    async check(): Promise<boolean> {
        const resp = await got.post(this.data.apiurl + "/authserver/validate", {
            json: {
                accessToken: this.data.accessToken,
                clientToken: this.data.clientToken
            },
            throwHttpErrors: false
        });
        if (resp.statusCode === 204) return true;
        return await this.refresh();
    }

    private async refresh(): Promise<boolean> {
        const req = await got.post<ATCT>(this.data.apiurl + "/authserver/refresh", {
            json: {
                accessToken: this.data.accessToken,
                clientToken: this.data.clientToken
            },
            responseType: "json",
            followRedirect: false,
            throwHttpErrors: false
        });
        if(req.statusCode >= 300 || req.statusCode < 200) return false;
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
