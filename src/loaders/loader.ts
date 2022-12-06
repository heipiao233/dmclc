import { MCVersion } from "../schemas.js";
import { Version } from "../version.js";

/**
 * Used to install loaders.
 * @public
 */
export interface Loader {
  getSuitableLoaderVersions: (MCVersion: Version) => Promise<string[]>
  install: (MCVersion: Version, version: string) => Promise<void>
  findInVersion: (MCVersion: MCVersion) => string | null
}
