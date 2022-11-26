import { UserData } from "./user_data.js";
import { Version } from "../version.js";
export interface Account<T extends UserData> {
  data: T;
  readSaved: (data: T) => Promise<boolean>
  getUUID: () => string
  getUserExtraContent: () => string[]
  readUserExtraContent: (content: Map<string, string>) => Promise<void>
  prepareLaunch: () => Promise<void>
  getLaunchJVMArgs: (mc: Version) => Promise<string[]>
  getLaunchGameArgs: () => Promise<Map<string, string>>
}
