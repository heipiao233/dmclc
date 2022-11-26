import { UserData } from "./user_data.js";
export interface Account<T extends UserData> {
  readSaved: (data: T) => Promise<boolean>
  getUUID: () => string
  getUserExtraContent: () => string[]
  readUserExtraContent: (content: Map<string, string>) => Promise<void>
  prepareLaunch: () => Promise<void>
  getLaunchJVMArgs: () => Promise<string[]>
  getLaunchGameArgs: () => Promise<Map<string, string>>
}
