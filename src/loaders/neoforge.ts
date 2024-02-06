import { MCVersion } from "../schemas.js";
import { ForgeLikeLoader } from "./forgelike/forgelike.js";

export class NeoForgeLoader extends ForgeLikeLoader {
    protected mavenArtifactURL = "https://maven.neoforged.net/releases/net/neoforged";
    protected supportsOld = false;
    name = "neoforge";

    matchVersion(loader: string, mc: string): boolean {
        if (mc === "1.20.1") {
            return loader.startsWith("1.20.1-");
        } else if (mc.includes("-") || mc.includes("w")) return false;
        return loader.startsWith(mc.slice(2));
    }

    getArchiveBaseName(MCVersion: string): string {
        if (MCVersion === "1.20.1") {
            return "forge";
        }
        return "neoforge";
    }

    findInVersion(MCVersion: MCVersion): string | undefined  {
        for (const i of MCVersion.libraries) {
            if(i.name.startsWith("net.neoforged.fancymodloader:loader:")){
                return i.name.split(":")[2].split("-")[1];
            }
        }
    }
}