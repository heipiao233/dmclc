import { MCVersion } from "../schemas.js";
import { ForgeLikeLoader } from "./forgelike/forgelike.js";

export class NeoForgeLoader extends ForgeLikeLoader {
    protected mavenArtifactURL = "https://maven.neoforged.net/releases/net/neoforged";
    protected supportsOld = false;
    name = "neoforge";

    getArchiveBaseName(MCVersion: string): string {
        if (MCVersion.startsWith("1.20.1")) {
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