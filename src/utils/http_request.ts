import * as https from "https";

export async function get (url: string, mirror: string): Promise<string> {
    return await new Promise(resolve => {
        url = url.replaceAll("launchermeta.mojang.com", mirror)
            .replaceAll("launcher.mojang.com", mirror)
            .replaceAll("resources.download.minecraft.net", mirror)
            .replaceAll("libraries.minecraft.net", mirror + "/maven")
            .replaceAll("files.minecraftforge.net", mirror)
            .replaceAll("meta.fabricmc.net", mirror + "/fabric-meta")
            .replaceAll("maven.fabricmc.net", mirror + "/maven")
            .replaceAll("piston-meta.mojang.com", mirror);
        console.log(url);
        const req = https.request(url);
        req.on("response", (res) => {
            if (res.statusCode !== 200) {
                console.error("http error:" + url);
            } else {
                const all: Buffer[] = [];
                res.on("data", (data) => {
                    all.push(data);
                });
                res.on("end", () => {
                    const content = all.join("");
                    resolve(content);
                });
            }
        });
        req.end();
    });
}
