import { MCVersion } from "../../schemas.js";

type InstallerInformation = {
    filePath: string;
    path: string;
}

export type InstallerProfileOld = {
    versionInfo: MCVersion;
    install: InstallerInformation;
}
