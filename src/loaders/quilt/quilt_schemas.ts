import { FabricLikeVersionInfo, Version } from "../fabriclike/fabriclike_version_info.js";

export type QuiltVersionInfo = {
    hashed: Version;
} & FabricLikeVersionInfo

export type ProvidesObject = {
    id: string;
    version: string;
}

export type DependencyObject = {
    id: string;
    versions?: string | string[];
    reason?: string;
    optional?: boolean;
    unless?: DependencyObject | DependencyObject[] | string
}

export type QuiltModJson = {
    quilt_loader: {
        group: string;
        id: string;
        provides?: ProvidesObject[];
        version: string;
        jars?: string[];
        depends?: DependencyObject | DependencyObject[] | string;
        breaks?: DependencyObject | DependencyObject[] | string;
        load_type?: string;
        metadata?: {
            name?: string;
            description?: string;
            contributors?: Record<string, string>;
            contact?: Record<string, string>;
            license?: string | string[] | {
                name: string;
                id: string;
                url: string;
                description?: string;
            }
            icon?: string | Record<string, string>;
            minecraft?: {
                environment?: "*" | "client" | "dedicated_server";
            }
        }
    }
}
