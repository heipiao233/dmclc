import { MinecraftVersion } from "../version.js";
import { UserData } from "./user_data.js";
/**
 * An account.
 * @public
 */
export interface Account<T extends UserData> {
  data: T;
  /**
   * Check if this account can use without input any other information again, and refresh access token.
   */
  check(): Promise<boolean>
  /**
   * Get UUID of this account.
   * @returns UUID.
   */
  getUUID(): string
  /**
   * Specially, if there is ms_url in keys, please use a webview.
   */
  getUserExtraContent(): Record<string, string>
  /**
   * 
   * @param content A map, keys must contain all keys of return values from {@link getUserExtraContent}, values are from user input.
   */
  readUserExtraContent(content: Map<string, string>): Promise<void>
  /**
   * Prepare for launch. For example, download your Java Agent.
   */
  prepareLaunch(): Promise<void>
  /**
   * Get extra JVM arguments. For example, Java Agent.
   */
  getLaunchJVMArgs(mc: MinecraftVersion): Promise<string[]>
  /**
   * Get extra JVM arguments.
   * For example:
   * {
   *   'auth_access_token' => '***',
   *   'user_type' => 'mojang',
   *   'user_properties' => '{}',
   *   'auth_player_name' => 'Steve'
   * }
   */
  getLaunchGameArgs(): Promise<Map<string, string>>
  /**
   * Get localized human-readable string. For example: Steve (Offline), Alex (微软账号).
   */
  toString(): string;
}
