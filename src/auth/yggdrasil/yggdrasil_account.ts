import { Account } from "../account.js";
import { YggdrasilUserData } from "./yggdrasil_data.js";
import * as https from "https";
export abstract class YggdrasilAccount<T extends YggdrasilUserData> implements Account {
    protected data: T;
    protected root: string;
    constructor (data: T, root: string) {
        this.data = data;
        this.root = root;
    }

  abstract prepareLaunch (): Promise<void>
  abstract getLaunchJVMArgs (): Promise<string[]>
  async getLaunchGameArgs (): Promise<Map<string, string>> {
      const map: Map<string, string> = new Map();
      const at = await this.getAccessToken();
      map.set("auth_access_token", at);
      map.set("auth_session", at);
      map.set("auth_player_name", this.data.name!);
      map.set("user_type", "mojang");
      map.set("user_properties", "{}");
      return map;
  }

  getUserExtraContent (): string[] {
      return ["username", "password"];
  }

  async readUserExtraContent (content: Map<string, string>): Promise<void> {
      return await new Promise((resolve) => {
          const req = https.request(this.data.apiurl + "/authserver/authenticate", { method: "POST" }, (res) => {
              const jsondata: string[] = [];
              res.on("data", (chunk) => jsondata.push(chunk));
              res.on("end", () => {
                  const jsonvalue = jsondata.join("");
                  console.log(jsonvalue);
                  const v = JSON.parse(jsonvalue);
                  this.data.accessToken = v.accessToken;
                  this.data.clientToken = v.clientToken;
                  this.data.uuid = v.availableProfiles[0].id;
                  this.data.name = v.availableProfiles[0].name;
                  resolve();
              });
          });
          req.setHeader("Content-Type", "application/json");
          req.write(`{
                "username":"${content.get("username") ?? ""}",
                "password":"${content.get("password") ?? ""}",
                "requestUser":true,
                "agent":{
                    "name":"Minecraft",
                    "version":1
                }
            }`);
          req.end();
      });
  }

  async verify (): Promise<boolean> {
      return await new Promise((resolve) => {
          const req = https.request(this.data.apiurl + "/authserver/validate", { method: "POST" }, (res) => {
              if (res.statusCode === 204)resolve(true);
              resolve(false);
          });
          req.setHeader("Content-Type", "application/json");
          req.write(`{
                "accessToken":"${this.data.accessToken}",
                "clientToken":"${this.data.clientToken}"
            }`);
          req.end();
      });
  }

  getUUID (): string {
      return this.data.uuid??"";
  }

  async getAccessToken (): Promise<string> {
      if (!await this.verify()) {
          return await new Promise((resolve) => {
              const req = https.request(this.data.apiurl + "/authserver/refresh", { method: "POST" }, (res) => {
                  const jsondata: string[] = [];
                  res.on("data", jsondata.push);
                  res.on("end", () => {
                      const jsonvalue = jsondata.join("");
                      const v = JSON.parse(jsonvalue);
                      resolve(v.user.accessToken);
                  });
              });
              req.setHeader("Content-Type", "application/json");
              req.write(`{
                    "accessToken":"${this.data.accessToken}",
                    "clientToken":"${this.data.clientToken}"
                    "requestUser":true,
                }`);
              req.end();
          });
      }
      return this.data.accessToken!;
  }
}
