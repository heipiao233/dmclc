import os from "os";
/**
 * @internal
 */
export type OSType = "linux"|"windows"|"osx";
/**
 * @internal
 */
export declare class OSPlatform {
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
export declare class Asset {
    hash: string;
    size: number;
}
/**
 * @internal
 */
export declare class AssetsIndex {
    objects: { [index: string]: Asset };
}
/**
 * @internal
 */
export declare class Rule {
    action: "allow" | "disallow";
    features: { [index: string]: boolean };
    os: OSPlatform;
}
/**
 * @internal
 */
export declare class Argument {
    rules: Rule[];
    value: string[] | string;
}
/**
 * @internal
 */
export declare class Resource {
    url: string;
    sha1: string;
    size: number;
}
/**
 * @internal
 */
export declare class ResourceWithID extends Resource {
    id: string;
}
/**
 * @internal
 */
export declare class AssetIndexInfo extends ResourceWithID {
    totalSize: number;
}
/**
 * @internal
 */
export declare class LibraryArtifact extends Resource {
    path: string;
}
/**
 * @internal
 */
export declare class JavaInfo {
    component: string;
    majorVersion: number;
}
/**
 * @internal
 */
export declare class Library {
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
export declare class LoggingInfo {
    argument: string;
    file: ResourceWithID;
    type: string;
}
/**
 * @internal
 */
export declare class MCVersion {
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
 * @internal
 */
export declare class VersionInfo {
    id: string;
    type: string;
    url: string;
    time: string;
    releaseTime: string;
}
/**
 * @internal
 */
export declare class VersionInfos {
    latest: {
        release: string
        snapshot: string
    };

    versions: VersionInfo[];
}
