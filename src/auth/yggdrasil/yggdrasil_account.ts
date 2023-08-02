import got, { Response } from "got";
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

    abstract prepareLaunch(versionDir: string): Promise<boolean>;
    abstract getLaunchJVMArgs(mc: MinecraftVersion): Promise<string[]>;
    async getLaunchGameArgs(): Promise<Map<string, string>> {
        const map: Map<string, string> = new Map();
        const at = await this.getAccessToken();
        map.set("auth_access_token", at);
        map.set("auth_session", at);
        map.set("auth_player_name", this.data.name ?? "Steve");
        map.set("user_type", "mojang");
        map.set("user_properties", "{}");
        return map;
    }

    async login(): Promise<boolean> {
        const content = await this.launcher.askUser({
            username: this.launcher.i18n("accounts.yggdrasil.username"),
            password: this.launcher.i18n("accounts.yggdrasil.password"),
            profileID: this.launcher.i18n("accounts.yggdrasil.profileID")
        });
        const profileID: number = Number.parseInt(content.profileID);
        const res: Response<ATCT & {
            availableProfiles: {
                id: string,
                name: string
            }[]
        }> = await got.post(this.data.apiurl + "/authserver/authenticate", {
            json: {
                username: content.username,
                password: content.password,
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
            await this.launcher.error("accounts.yggdrasil.wrong_email_or_password");
            return false;
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
        } = await got(this.data.apiurl ?? "").json();
        this.data.serverName = meta.meta.serverName;
        return true;
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
        return this.data.uuid ?? "ffffffff-ffff-ffff-ffff-ffffffffffff";
    }

    async getAccessToken(): Promise<string> {
        return this.data.accessToken ?? "LOGIN_FAILS";
    }
}
