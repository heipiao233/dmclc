import { McInstallation } from "../schemas";

export function merge(a: McInstallation, b: McInstallation): McInstallation {
    const c = a;
    c.arguments.game.push(...b.arguments.game);
    c.arguments.jvm.push(...b.arguments.jvm);
    c.libraries.push(...b.libraries);
    c.mainClass = b.mainClass;
    if(b.logging.client===undefined)c.logging = {};
    return c;
}