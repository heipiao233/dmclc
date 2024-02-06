import { MCVersion } from "../schemas.js";
import { ForgeLikeLoader } from "./forgelike/forgelike.js";

export class ForgeLoader extends ForgeLikeLoader {
    protected mavenArtifactURL = "https://maven.minecraftforge.net/net/minecraftforge";
    protected supportsOld = false;
    name = "forge";

    matchVersion(loader: string, mc: string): boolean {
        return loader.startsWith(`${mc}-`);
    }

    getArchiveBaseName(MCVersion: string): string {
        return "forge";
    }

    findInVersion(MCVersion: MCVersion): string | undefined  {
        for (const i of MCVersion.libraries) {
            if(i.name.includes(":fmlloader:") || i.name.includes(":forge:")){
                return i.name.split(":")[2].split("-")[1];
            }
        }
    }
}