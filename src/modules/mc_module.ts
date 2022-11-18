export interface ModuleType {
  getSuitableModuleVersions: (MCVersion: string) => Promise<string[]>
  install: (MCVersion: string, MCName: string, version: string) => Promise<void>
}
