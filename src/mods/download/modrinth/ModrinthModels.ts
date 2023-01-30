export type SearchResult = {
    slug: string,
    title: string,
    description: string,
    categories: string[],
    client_side: "required" | "optional" | "unsupported",
    server_side: "required" | "optional" | "unsupported",
    project_type: "mod",
    downloads: number,
    icon_url?: string,
    project_id: string,
    author: string,
    display_categories: string[],
    versions: string[],
    follows: number,
    date_created: string,
    date_modified: string,
    latest_version: string,
    license: string,
    gallery: string[]
}

export type Dependency = {
    version_id?: string,
    project_id?: string,
    file_name?: string,
    dependency_type?: "required" | "optional" | "incompatible" | "embedded"
}

export type File = {
    hashes: {
        sha512: string,
        sha1: string
    },
    url: string,
    filename: string,
    primary: boolean,
    size: number
}

export type ModrinthVersionModel = {
    name: string,
    version_number: string,
    changelog?: string,
    dependencies: Dependency[],
    game_versions: string[],
    version_type: "release" | "beta" | "alpha",
    loaders: string[],
    featured: boolean,
    id: string,
    project_id: string,
    author_id: string,
    date_published: string,
    downloads: number,
    files: File[]
}
