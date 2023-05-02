import { SideEnv } from '../../download/modrinth/ModrinthModels';
export type ModrinthModpackIndexV1 = {
    formatVersion: 1;
    game: "minecraft";
    versionId: string;
    name: string;
    summary?: string;
    files: {
        path: string;
        hashes: {
            sha1: string;
            sha256: string;
        };
        env?: {
            client: SideEnv;
            server: SideEnv;
        }
        downloads: string[];
        fileSize: number;
    }[];
    dependencies: {
        minecraft: string;
        forge?: string;
        "fabric-loader"?: string;
        "quilt-loader"?: string;
    }
}