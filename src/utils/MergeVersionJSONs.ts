import assert from "assert";
import { MCVersion } from "../schemas.js";

export function merge(a: MCVersion, b: MCVersion, mergeID = false): MCVersion {
    const c = a;
    if("minecraftArguments" in c){
        assert("minecraftArguments" in b);
        c.minecraftArguments = b.minecraftArguments;
    } else {
        assert("arguments" in b);
        c.arguments.game?.push(...b.arguments.game??[]);
        c.arguments.jvm?.push(...b.arguments.jvm??[]);
    }
    c.libraries.unshift(...b.libraries);
    c.mainClass = b.mainClass;
    if(mergeID)c.id = b.id;
    return c;
}