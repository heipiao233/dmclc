import { MinecraftVersion } from "../version";
import { UserData } from "./user_data";
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
   * If a key is `password`, please mask!
   */
  getUserExtraContent(): Record<string, string>

  /**
   * @throws {@link FormattedError}
   * @param content - A map, keys must contain all keys of return values from {@link Account.getUserExtraContent}, values are from user input.
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
   * \{
   *   'auth_access_token' =\> '***',
   *   'user_type' =\> 'mojang',
   *   'user_properties' =\> '\{\}',
   *   'auth_player_name' =\> 'Steve'
   * \}
   */
  getLaunchGameArgs(): Promise<Map<string, string>>
  /**
   * Get localized human-readable string. For example: Steve (Offline), Alex (微软账号).
   */
  toString(): string;
}
