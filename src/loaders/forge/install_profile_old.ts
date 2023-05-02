import { MCVersion } from "../../schemas";

type InstallerInformation = {
    filePath: string;
    path: string;
}

export type InstallerProfileOld = {
    versionInfo: MCVersion;
    install: InstallerInformation;
}
