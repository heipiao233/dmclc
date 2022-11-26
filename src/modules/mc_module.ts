import { Version } from "../version.js";

export interface ModuleType {
  getSuitableModuleVersions: (MCVersion: Version) => Promise<string[]>
  install: (MCVersion: Version, version: string) => Promise<void>
}
