import { McInstallation } from "../schemas";

export function merge(a: McInstallation, b: McInstallation): McInstallation {
    const c = a;
    if(c.minecraftArguments!=undefined){
        c.minecraftArguments = b.minecraftArguments;
    }else if(c.arguments!=undefined){
        c.arguments.game?.push(...b.arguments!.game??[]);
        c.arguments.jvm?.push(...b.arguments!.jvm??[]);
    }
    c.libraries.unshift(...b.libraries);
    c.mainClass = b.mainClass;
    c.id = b.id;
    return c;
}