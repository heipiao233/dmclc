type ModLinks = {
    websiteUrl: string,
    wikiUrl: string,
    issuesUrl: string,
    sourceUrl: string
};

type Author = {
    id: number,
    name: string,
    url: string
};

type Category = {
    id: number,
    gameId: number,
    name: string,
    slug: string,
    url: string,
    iconUrl: string,
    dateModified: string,
    isClass: boolean,
    classId: number,
    parentCategoryId: number,
    displayIndex: number
};

type ModAsset = {
    id: number,
    modId: number,
    title: string,
    description: string,
    thumbnailUrl: string,
    url: string
};

export type CurseForgeMod = {
    id: number,
    gameId: number,
    name: string,
    slug: string,
    links: ModLinks,
    summary: string,
    downloadCount: number,
    isFeatured: boolean,
    primaryCategoryId: number,
    categories: Category[],
    classId: number,
    authors: Author[],
    logo: ModAsset,
    screenshots: ModAsset[],
    mainFileId: number,
    dateCreated: string,
    dateModified: string,
    dateReleased: string,
    allowModDistribution: boolean,
    gamePopularityRank: number,
    isAvailable: boolean
}

export enum Algorithm {
    SHA1 = 1,
    MD5 = 2
}

export enum ReleaseType {
    RELEASE = 1,
    BETA = 2,
    ALPHA = 3
}

export enum RelationType {
    EmbeddedLibrary = 1,
    OptionalDependency = 2,
    RequiredDependency = 3,
    Tool = 4,
    Incompatible = 5,
    Include = 6
}

export type CurseForgeModFile = {
    id: number,
    isAvailable: boolean,
    displayName: string,
    fileName: string,
    releaseType: ReleaseType,
    hashes: {
        value: string,
        algo: Algorithm
    }[],
    fileDate: string,
    fileLength: number,
    downloadCount: number,
    downloadUrl: string,
    dependencies: 
    {
        modId: number,
        relationType: number
    }[],
    isServerPack: boolean
}

