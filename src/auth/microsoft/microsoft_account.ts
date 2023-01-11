import { got } from "got";
import open from "open";
import { setTimeout as sleep } from "timers/promises";
import { FormattedError } from "../../errors/FormattedError.js";
import { Launcher } from "../../launcher.js";
import copy from "../../utils/copy.js";
import { Account } from "../account.js";
import { MicrosoftUserData } from "./microsoft_user_data.js";
const client_id = "71dd081b-dc92-4d36-81ac-3a2bde5527ba";
const scope = "XboxLive.signin offline_access";
type STEP1_1 = {
    device_code: string,
    user_code: string,
    verification_uri: string;
    interval: number;
    expires_in: number;
}

type STEP1_2 = STEP1 | {
    error: "authorization_pending" | "authorization_declined" | "expired_token" | "slow_down";
};
type STEP1 = {
    access_token: string;
    refresh_token: string;
}
type STEP2 = {
    token: string;
    uhs: string;
}
type STEP6 = {
    id: string;
    name: string;
}
export class MicrosoftAccount implements Account<MicrosoftUserData> {
    constructor (public data: MicrosoftUserData, private launcher: Launcher) {}

    private async step1_new(): Promise<STEP1> {
        const device_response: STEP1_1 = await got.post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode", {
            form: {
                client_id,
                scope
            }
        }).json();
        copy(device_response.user_code);
        open(device_response.verification_uri);
        let interval = device_response.interval;
        const startTime = Date.now() / 1000;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            await sleep(Math.max(interval, 1) * 1000);
            const estimatedTime = Date.now() / 1000 - startTime;
            if (estimatedTime >= device_response.expires_in) {
                throw new FormattedError(this.launcher.i18n("accounts.microsoft.timeout"));
            }
            const tokenResponse: STEP1_2 = await got.post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
                form: {
                    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                    code: device_response.device_code,
                    client_id
                },
                throwHttpErrors: false,
                retry: {
                    limit: 5
                }
            }).json();
            if ("error" in tokenResponse) {
                switch (tokenResponse.error) {
                case "expired_token": 
                    throw new FormattedError(this.launcher.i18n("accounts.microsoft.timeout"));
                case "authorization_declined":
                    throw new FormattedError(this.launcher.i18n("accounts.microsoft.canceled"));
                case "slow_down":
                    interval += 5;
                    break;
                }
            } else return tokenResponse;
        }
    }

    private async step1_refresh(): Promise<string> {
        const res: { access_token: string } = await got.post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
            form: {
                client_id,
                grant_type: "refresh_token",
                refresh_token: this.data.refresh_token!
            }
        }).json();
        return res.access_token;
    }

    private async step2_xbl (accessToken: string): Promise<STEP2> {
        const reqBody = {
            Properties: {
                AuthMethod: "RPS",
                SiteName: "user.auth.xboxlive.com",
                RpsTicket: "d=" + accessToken
            },
            RelyingParty: "http://auth.xboxlive.com",
            TokenType: "JWT"
        };
        const res: {
            Token: string,
            DisplayClaims: {
                xui: {
                    uhs: string
                }[]
            }
        } = await got("https://user.auth.xboxlive.com/user/authenticate", {
            method: "POST",
            json: reqBody
        }).json();
        return (
            {
                token: res.Token,
                uhs: res.DisplayClaims.xui[0].uhs
            }
        );
    }

    private async step3_xsts(xblToken: string): Promise<string> {
        const reqBody = {
            Properties: {
                SandboxId: "RETAIL",
                UserTokens: [xblToken]
            },
            RelyingParty: "rp://api.minecraftservices.com/",
            TokenType: "JWT"
        };
        const res: {Token: string} = await got("https://xsts.auth.xboxlive.com/xsts/authorize", {
            method: "POST",
            body: JSON.stringify(reqBody)
        }).json();
        return res.Token;
    }

    private async step4_login(xstsToken: string, uhs: string): Promise<string> {
        const reqBody = {
            identityToken: `XBL3.0 x=${uhs};${xstsToken}`
        };
        const res: {access_token: string} = await got("https://api.minecraftservices.com/authentication/login_with_xbox", {
            method: "POST",
            body: JSON.stringify(reqBody)
        }).json();
        return res.access_token;
    }

    private async step5_check(MCAccessToken: string): Promise<boolean> {
        const obj: { items: unknown[] } = (await got("https://api.minecraftservices.com/entitlements/mcstore", {
            headers: {
                Authorization: `Bearer ${MCAccessToken}`
            }
        }).json());
        return obj.items.length !== 0;
    }

    private async step6_uuid_name(MCAccessToken: string): Promise<STEP6> {
        return await got("https://api.minecraftservices.com/minecraft/profile", {
            headers: {
                Authorization: `Bearer ${MCAccessToken}`
            }
        }).json();
    }

    async check(): Promise<boolean> {
        return await this.refresh();
    }
    
    private async refresh(): Promise<boolean> {
        const at=(await this.step1_refresh());
        if (!at) return false;
        await this.nextSteps(at);
        return true;
    }

    getUUID(): string {
        return this.data.uuid!;
    }

    getUserExtraContent(): Record<string, string> {
        return {};
    }

    async readUserExtraContent(): Promise<void> {
        const val = await this.step1_new();
        await this.nextSteps(val.access_token);
        this.data.refresh_token = val.refresh_token;
    }

    private async nextSteps(access_token: string) {
        const tu = await this.step2_xbl(access_token);
        const xsts = await this.step3_xsts(tu.token);
        const MCAccessToken = await this.step4_login(xsts, tu.uhs);
        if (!await this.step5_check(MCAccessToken)) {
            throw new FormattedError(this.launcher.i18n("accounts.microsoft.no_minecraft_in_account"));
        }
        const un = await this.step6_uuid_name(MCAccessToken);
        console.log(un);
        this.data.accessToken = MCAccessToken;
        this.data.name = un.name;
        this.data.uuid = un.id;
    }

    async prepareLaunch (): Promise<void> {
        // We don't need to do anything using this method.
    }

    async getLaunchJVMArgs(): Promise<string[]> {
        return [];
    }

    async getLaunchGameArgs (): Promise<Map<string, string>> {
        const map: Map<string, string> = new Map();
        await this.refresh();
        const at = this.data.accessToken!;
        map.set("auth_access_token", at);
        map.set("auth_session", at);
        map.set("auth_player_name", this.data.name!);
        map.set("user_type", "mojang");
        map.set("user_properties", "{}");
        return map;
    }

    toString (): string {
        return `${this.data.name} (${this.launcher.i18n("accounts.microsoft.name")})`;
    }
}
