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
  check(): Promise<boolean>;

  login(): Promise<boolean>;

  /**
   * Get UUID of this account.
   * @returns UUID.
   */
  getUUID(): string
  /**
   * Prepare for launch. For example, download your Java Agent.
   */
  prepareLaunch(versionDir: string): Promise<boolean>
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
  /**
   * Get masks for log.
   */
  getTokens(): string[];
}
