import os from "os";
/**
 * @public
 */
export type OSType = "linux"|"windows"|"osx";
/**
 * @public
 */
export type OSPlatform = {
    name: OSType;
    version: string;
    arch: string;
}
/**
 * @public
 */
export function isCurrent(platform: OSPlatform): boolean {
    if (platform === undefined) return true;
    switch (os.platform()) {
    case "darwin":
        return platform.name === "osx";
    case "win32":
        return platform.name === "windows";
    default:
        return platform.name === os.platform();
    }
}
/**
 * @public
 */
export function checkRule(rule: Rule): boolean {
    return rule.action === "allow";
}
/**
 * @public
 */
export function checkRules(rules: Rule[]): boolean {
    return rules.filter(v => isCurrent(v.os)).some(checkRule);
}
/**
 * @public
 */
export type Asset = {
    hash: string;
    size: number;
}
/**
 * @public
 */
export type AssetsIndex = {
    objects: { [index: string]: Asset };
}
/**
 * @public
 */
export type Rule = {
    action: "allow" | "disallow";
    features: { [index: string]: boolean };
    os: OSPlatform;
}
/**
 * @public
 */
export type Argument = {
    rules: Rule[];
    value: string[] | string;
}
/**
 * @public
 */
export type Resource = {
    url: string;
    sha1: string;
    size: number;
}
/**
 * @public
 */
export type ResourceWithID = {
    id: string;
} & Resource
/**
 * @public
 */
export type AssetIndexInfo = {
    totalSize: number;
} & ResourceWithID
/**
 * @public
 */
export type LibraryArtifact = {
    path: string;
} & Resource
/**
 * @public
 */
export type JavaInfo = {
    component: string;
    majorVersion: number;
}

type LibraryBase = {
    name: string;
    rules?: Rule[];
}

type LibraryVanillaNatives = {
    downloads: {
        classifiers: {
            [index: string]: LibraryArtifact;
        };
    };
    natives: {
        [index: string]: string
    };
} & LibraryBase;

type LibraryVanillaAndNewForge = {
    downloads: {
        artifact: LibraryArtifact;
    }
} & LibraryBase;

type LibraryOldForge = {
    checksum?: string[];
    clientreq?: boolean
} & LibraryFabricOldForgeBaseAndLiteLoader;

type LibraryFabricOldForgeBaseAndLiteLoader = {
    url: string;
} & LibraryBase;

/**
 * @public
 */
export type Library = LibraryFabricOldForgeBaseAndLiteLoader | LibraryOldForge | LibraryVanillaAndNewForge
                    | LibraryVanillaNatives | LibraryBase;
// {
//     downloads?: {
//         artifact?: LibraryArtifact
//         classifiers?: {
//             [index: string]: LibraryArtifact
//         }
//     };

//     name: string;
//     serverreq?: boolean;
//     clientreq?: boolean;
//     checksum?: string[];
//     rules?: Rule[];
//     url?: string;
//     natives?: {
//         [index in OSType]: string;
//     };
// }
/**
 * @public
 */
export type LoggingInfo = {
    argument: string;
    file: ResourceWithID;
    type: string;
}
/**
 * @public
 */
type MCVersionBase = {
    inheritsFrom?: string;
    assetIndex: AssetIndexInfo;
    assets: string;
    complianceLevel: number;
    downloads: {
        client: Resource
        client_mappings: Resource
        server: Resource
        server_mappings: Resource
    };

    id: string;
    javaVersion: JavaInfo;
    libraries: Library[];
    logging: {
        client?: LoggingInfo
    };

    mainClass: string;
    minimumLauncherVersion: number;
    releaseTime: string;
    time: string;
    type: "snapshot" | "release" | "old_beta" | "old_alpha";
}
type MCVersionOldArgs = MCVersionBase & {
    minecraftArguments: string;
}
type MCVersionNewArgs = MCVersionBase & {
    arguments: {
        game?: Array<string | Argument>
        jvm?: Array<string | Argument>
    };
}
export type MCVersion = MCVersionNewArgs | MCVersionOldArgs;
/**
 * @public
 */
export type VersionInfo = {
    id: string;
    type: string;
    url: string;
    time: string;
    releaseTime: string;
}
/**
 * @public
 */
export type VersionInfos = {
    latest: {
        release: string
        snapshot: string
    };

    versions: VersionInfo[];
}
