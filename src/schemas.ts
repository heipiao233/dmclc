import os from "os";
/**
 * @internal
 */
export type OSType = "linux"|"windows"|"osx";
/**
 * @internal
 */
export type OSPlatform = {
    name: OSType;
    version: string;
    arch: string;
}
/**
 * @internal
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
 * @internal
 */
export function checkRule(rule: Rule): boolean {
    return rule.action === "allow";
}
/**
 * @internal
 */
export function checkRules(rules: Rule[]): boolean {
    return rules.filter(v => isCurrent(v.os)).some(checkRule);
}
/**
 * @internal
 */
export type Asset = {
    hash: string;
    size: number;
}
/**
 * @internal
 */
export type AssetsIndex = {
    objects: { [index: string]: Asset };
}
/**
 * @internal
 */
export type Rule = {
    action: "allow" | "disallow";
    features: { [index: string]: boolean };
    os: OSPlatform;
}
/**
 * @internal
 */
export type Argument = {
    rules: Rule[];
    value: string[] | string;
}
/**
 * @internal
 */
export type Resource = {
    url: string;
    sha1: string;
    size: number;
}
/**
 * @internal
 */
export type ResourceWithID = {
    id: string;
} & Resource
/**
 * @internal
 */
export type AssetIndexInfo = {
    totalSize: number;
} & ResourceWithID
/**
 * @internal
 */
export type LibraryArtifact = {
    path: string;
} & Resource
/**
 * @internal
 */
export type JavaInfo = {
    component: string;
    majorVersion: number;
}
/**
 * @internal
 */
export type Library = {
    downloads?: {
        artifact: LibraryArtifact
        classifiers: {
            [index: string]: LibraryArtifact
        }
    };

    name: string;
    serverreq?: boolean;
    clientreq?: boolean;
    checksum: string[];
    rules?: Rule[];
    url?: string;
    natives?: {
        [index in OSType]: string;
    };
}
/**
 * @internal
 */
export type LoggingInfo = {
    argument: string;
    file: ResourceWithID;
    type: string;
}
/**
 * @internal
 */
export type MCVersion = {
    inheritsFrom?: string;
    arguments?: {
        game?: Array<string | Argument>
        jvm?: Array<string | Argument>
    };

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
    minecraftArguments?: string;
}
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
