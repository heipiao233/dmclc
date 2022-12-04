import got from "got";

export async function get (url: string, mirror: string | undefined): Promise<string> {
    if(mirror !== undefined){
        url = url.replaceAll("launchermeta.mojang.com", mirror)
            .replaceAll("launcher.mojang.com", mirror)
            .replaceAll("resources.download.minecraft.net", mirror)
            .replaceAll("libraries.minecraft.net", mirror + "/maven")
            .replaceAll("files.minecraftforge.net", mirror)
            .replaceAll("meta.fabricmc.net", mirror + "/fabric-meta")
            .replaceAll("maven.fabricmc.net", mirror + "/maven")
            .replaceAll("piston-meta.mojang.com", mirror);
    }
    return (await got(url)).body;
}
