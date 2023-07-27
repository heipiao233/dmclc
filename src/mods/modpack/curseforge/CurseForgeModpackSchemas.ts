type CurseForgeModpackFile = {
    projectID: number,
    fileID: number,
    required: boolean
}

export type CurseForgeModpackSchema = {
    minecraft: {
        version: string,
        modLoaders: [
            {
                id: string,
                primary: boolean
            }
        ]
    },
    manifestType: "minecraftModpack",
    manifestVersion: 1,
    name: string,
    version: string,
    author: string,
    files: CurseForgeModpackFile[],
    overrides: string
}
