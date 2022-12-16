import { UserData } from "./user_data.js";
import { MinecraftVersion } from "../version.js";
/**
 * An account.
 * @public
 */
export interface Account<T extends UserData> {
  data: T;
  /**
   * Check if this account can login.
   */
  check(): Promise<boolean>
  /**
   * Get the UUID of this account.
   * @returns UUID.
   */
  getUUID(): string
  getUserExtraContent(): string[]
  readUserExtraContent(content: Map<string, string>): Promise<void>
  /**
   * @internal
   */
  prepareLaunch(): Promise<void>
  /**
   * @internal
   */
  getLaunchJVMArgs(mc: MinecraftVersion): Promise<string[]>
  /**
   * @internal
   */
  getLaunchGameArgs(): Promise<Map<string, string>>
  /**
   * @internal
   */
  toString(): string;
}
