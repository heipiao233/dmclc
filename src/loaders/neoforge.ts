import { MCVersion } from "../schemas.js";
import { ForgeLikeLoader } from "./forgelike/forgelike.js";

export class NeoForgeLoader extends ForgeLikeLoader {
    protected mavenArtifactURL = "https://maven.neoforged.net/releases/net/neoforged/forge";
    protected supportsOld = false;
    findInVersion(MCVersion: MCVersion): string | undefined  {
        for (const i of MCVersion.libraries) {
            if(i.name.startsWith("net.neoforged.fancymodloader:loader:")){
                return i.name.split(":")[2].split("-")[1];
            }
        }
    }
}