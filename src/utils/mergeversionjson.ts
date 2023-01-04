import { MCVersion } from "../schemas.js";

export function merge(a: MCVersion, b: MCVersion, mergeID = false): MCVersion {
    const c = a;
    if(c.minecraftArguments!=undefined){
        c.minecraftArguments = b.minecraftArguments;
    }else if(c.arguments!=undefined){
        c.arguments.game?.push(...b.arguments!.game??[]);
        c.arguments.jvm?.push(...b.arguments!.jvm??[]);
    }
    c.libraries.unshift(...b.libraries);
    c.mainClass = b.mainClass;
    if(mergeID)c.id = b.id;
    return c;
}