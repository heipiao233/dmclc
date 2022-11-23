import fs from "fs";
import * as fr from "follow-redirects";
const https = fr.https;
export async function downloadAll(files: Map<string, fs.PathLike>, mirror?: string): Promise<void> {
    const promises: Array<Promise<void>> = new Array<Promise<void>>();
    files.forEach((v, k) => {
        promises.push(download(k, v, mirror));
    });
    await Promise.all(promises);
}
export async function download(url: string, filename: fs.PathLike, mirror?: string): Promise<void> {
    if(url.length===0)return;
    if (mirror !== undefined) {
        url = url.replaceAll("launchermeta.mojang.com", mirror)
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
    url = url.replaceAll("http://", "https://");
    const file = fs.createWriteStream(filename);
    const req = https.get(url);
    return new Promise(resolve=>{
        req.on("response", res => {
            res.pipe(file);
            res.on("close", ()=>{
                resolve();
            });
        });
    });
}
