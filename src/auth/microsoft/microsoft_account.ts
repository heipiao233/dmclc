import { got } from "got";
import { FormattedError } from "../../errors/FormattedError.js";
import { Launcher } from "../../launcher.js";
import { Account } from "../account.js";
import { MicrosoftUserData } from "./microsoft_user_data.js";
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
    constructor (public data: MicrosoftUserData, private launcher: Launcher) {
    }

    private async step1_new(code: string): Promise<STEP1> {
        return (await got.post<STEP1>("https://login.live.com/oauth20_token.srf", {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            form: {
                client_id: "00000000402b5328",
                code: code,
                grant_type: "authorization_code",
                redirect_uri: "https://login.live.com/oauth20_desktop.srf",
                scope: "service::user.auth.xboxlive.com::MBI_SSL"
            },
            responseType: "json"
        })).body;
    }

    private async step1_refresh(): Promise<string> {
        const res: { access_token: string } = await (got.post("https://login.live.com/oauth20_token.srf", {
            form: {
                client_id: "00000000402b5328",
                grant_type: "refresh_token",
                refresh_token: this.data.refresh_token!,
                redirect_uri: "https://login.live.com/oauth20_desktop.srf",
                scope: "service::user.auth.xboxlive.com::MBI_SSL"
            }
        }).json());
        return res.access_token;
    }

    private async step2_xbl (accessToken: string): Promise<STEP2> {
        const reqBody = {
            Properties: {
                AuthMethod: "RPS",
                SiteName: "user.auth.xboxlive.com",
                RpsTicket: accessToken
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
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(reqBody)
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
        const res = await got("https://api.minecraftservices.com/entitlements/mcstore", {
            headers: {
                Authorization: `Bearer ${MCAccessToken}`
            }
        });
        return res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300;
    }

    private async step6_uuid_name(MCAccessToken: string): Promise<STEP6> {
        return await got("https://api.minecraftservices.com/minecraft/profile", {
            headers: {
                Authorization: `Bearer ${MCAccessToken}`
            }
        }).json();
    }

    async check(): Promise<boolean> {
        try {
            await this.refresh();
        }catch{
            return false;
        }
        return true;
    }
    
    private async refresh() {
        const at=(await this.step1_refresh());
        await this.nextSteps(at);
    }

    getUUID(): string {
        return this.data.uuid!;
    }

    getUserExtraContent(): Record<string, string> {
        return {
            "ms_url": "ms_url"
        };
    }

    async readUserExtraContent (content: Map<string, string>): Promise<void> {
        const MSCode = new URL(content.get("ms_url")!).searchParams.get("code")!;
        const val = await this.step1_new(MSCode);
        await this.nextSteps(val.access_token);
        this.data.refresh_token = val.refresh_token;
    }

    private async nextSteps(access_token: string){
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
        return `${this.data.name} (${this.launcher.i18n("accounts.microsoft")})`;
    }
}
