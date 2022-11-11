export interface Account<> {
  verify: () => Promise<boolean>
  getUUID: () => string
  getUserExtraContent: () => string[]
  readUserExtraContent: (content: Map<string, string>) => Promise<void>
  prepareLaunch: () => Promise<void>
  getLaunchJVMArgs: () => Promise<string[]>
  getLaunchGameArgs: () => Promise<Map<string, string>>
}
