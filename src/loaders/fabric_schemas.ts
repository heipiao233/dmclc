export type Env = "*" | "client" | "server";

export type NestedJarEntry = {
    file: string;
}

export type Dependencies = Record<string, string | string[]>;
export type ContactInformation = {
    email: string;
    irc: string;
    homepage: string;
    issues: string;
    sources: string;
    [type: string]: string;
}
export type Person = {
    name: string;
    contact?: ContactInformation;
} | string

export type VersionRange = string | string[];

export type FabricModJson = {
    id: string;
    version: string;
    provides?: string[]; // Not in official document
    environment?: Env;
    jars?: NestedJarEntry[];
    depends?: Dependencies;
    recommends?: Dependencies;
    suggests?: Dependencies;
    conflicts?: Dependencies;
    breaks?: Dependencies;
    name?: string;
    description?: string;
    authors?: Person[];
    contributors?: Person[];
    contact?: ContactInformation;
    license?: string | string[];
    icon?: string | {
        [size: string]: string;
    };
}