export function transformURL(origin: string, mirror?: string) {
    if (mirror !== undefined) {
        return origin.replaceAll("launchermeta.mojang.com", mirror)
            .replaceAll("launcher.mojang.com", mirror)
            .replaceAll("resources.download.minecraft.net", mirror + "/assets")
            .replaceAll("libraries.minecraft.net", mirror + "/maven")
            .replaceAll("files.minecraftforge.net", mirror)
            .replaceAll("maven.minecraftforge.net", mirror + "/maven")
            .replaceAll("meta.fabricmc.net", mirror + "/fabric-meta")
            .replaceAll("maven.fabricmc.net", mirror + "/maven")
            .replaceAll("piston-meta.mojang.com", mirror)
            .replaceAll("piston-data.mojang.com", mirror);
    }
    return origin;
}