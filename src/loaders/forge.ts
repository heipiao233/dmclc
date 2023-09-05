import { MCVersion } from "../schemas.js";
import { ForgeLikeLoader } from "./forgelike/forgelike.js";

export class ForgeLoader extends ForgeLikeLoader {
    protected mavenArtifactURL = "https://maven.minecraftforge.net/net/minecraftforge/forge";
    protected supportsOld = false;
    findInVersion(MCVersion: MCVersion): string | undefined  {
        for (const i of MCVersion.libraries) {
            if(i.name.includes(":fmlloader:") || i.name.includes(":forge:")){
                return i.name.split(":")[2].split("-")[1];
            }
        }
    }
}