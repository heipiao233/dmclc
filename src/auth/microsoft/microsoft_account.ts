import { Account } from "../account.js";
import { MicrosoftUserData } from "./microsoft_data.js";
import { got } from "got";
declare class STEP1 {
    access_token: string;
    refresh_token: string;
}
declare class STEP2 {
    token: string;
    uhs: string;
}
declare class STEP6 {
    id: string;
    name: string;
}
export class MicrosoftAccount implements Account {
    private data: MicrosoftUserData;
    constructor (data: MicrosoftUserData) {
        this.data = data;
    }

    async step1 (code: string): Promise<STEP1> {
        const res = await got("https://login.live.com/oauth20_token.srf", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: genQS({
                client_id: "00000000402b5328",
                code,
                grant_type: "authorization_code",
                redirect_uri: "https://login.live.com/oauth20_desktop.srf",
                scope: "service::user.auth.xboxlive.com::MBI_SSL"
            })
        });
        return JSON.parse(res.body);
    }

    async step2_xbl (accessToken: string): Promise<STEP2> {
        const reqBody = {
            Properties: {
                AuthMethod: "RPS",
                SiteName: "user.auth.xboxlive.com",
                RpsTicket: accessToken
            },
            RelyingParty: "http://auth.xboxlive.com",
            TokenType: "JWT"
        };
        const res = await got("https://user.auth.xboxlive.com/user/authenticate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(reqBody)
        });
        const obj = JSON.parse(res.body);
        return (
            {
                token: obj.Token,
                uhs: obj.DisplayClaims.xui[0].uhs
            }
        );
    }

    async step3_xsts (xblToken: string): Promise<string> {
        const reqBody = {
            Properties: {
                SandboxId: "RETAIL",
                UserTokens: [xblToken]
            },
            RelyingParty: "rp://api.minecraftservices.com/",
            TokenType: "JWT"
        };
        const res = await got("https://xsts.auth.xboxlive.com/xsts/authorize", {
            method: "POST",
            body: JSON.stringify(reqBody)
        });
        const obj = JSON.parse(res.body);
        return obj.Token;
    }

    async step4_login (xstsToken: string, uhs: string): Promise<string> {
        const reqBody = {
            identityToken: `XBL3.0 x=${uhs};${xstsToken}`
        };
        const res = await got("https://api.minecraftservices.com/authentication/login_with_xbox", {
            method: "POST",
            body: JSON.stringify(reqBody)
        });
        const obj = JSON.parse(res.body);
        return obj.access_token;
    }

    async step5_check (MCAccessToken: string): Promise<boolean> {
        const res = await got("https://api.minecraftservices.com/entitlements/mcstore", {
            headers: {
                Authorization: `Bearer ${MCAccessToken}`
            }
        });
        return res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300;
    }

    async step6_uuid_name (MCAccessToken: string): Promise<STEP6> {
        const res = await got("https://api.minecraftservices.com/minecraft/profile", {
            headers: {
                Authorization: `Bearer ${MCAccessToken}`
            }
        });
        return JSON.parse(res.body);
    }

    async verify (): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

    getUUID (): string {
        return this.data.uuid;
    }

    getUserExtraContent (): string[] {
        return ["ms_code"];
    }

    async readUserExtraContent (content: Map<string, string>): Promise<void> {
        const MSCode = content.get("ms_code");
        if (MSCode === undefined) { throw new Error("No Microsoft OAuth code"); }

        const val = await this.step1(MSCode);
        const tu = await this.step2_xbl(val.access_token);
        const xsts = await this.step3_xsts(tu.token);
        const MCAccessToken = await this.step4_login(xsts, tu.uhs);
        if (!await this.step5_check(MCAccessToken)) {
            throw new Error("Account doesn't have Minecraft.");
        }
        const un = await this.step6_uuid_name(MCAccessToken);
        console.log(un);
        this.data.accessToken = MCAccessToken;
        this.data.name = un.name;
        this.data.uuid = un.id;
    }

    async prepareLaunch (): Promise<void> {
        // We don't need to do anything when use this method.
    }

    async getLaunchJVMArgs (): Promise<string[]> {
        return [];
    }

    async getLaunchGameArgs (): Promise<Map<string, string>> {
        const map: Map<string, string> = new Map();
        const at = this.data.accessToken;
        map.set("auth_access_token", at);
        map.set("auth_session", at);
        map.set("auth_player_name", this.data.name);
        map.set("user_type", "mojang");
        map.set("user_properties", "{}");
        return map;
    }
}

function genQS (obj: {[index: string]: string}): string {
    let ret = "";
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            const encodedValue = encodeURIComponent(value);
            const encodedKey = encodeURIComponent(key);
            ret = ret.concat(`${encodedKey}=${encodedValue}&`);
        }
    }
    ret = ret.substring(0, ret.length - 1);
    return ret;
}
