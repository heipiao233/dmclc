import { Library } from "../../schemas";

export type InstallerProfileNew = {
    data: {
        [index: string]: { "client": string, "server": string }
    };

    processors: Processor[];
    libraries: Library[];
}
type Processor = {
    sides: ["client" | "server"];
    jar: string;
    classpath: string[];
    args: string[];
    outputs: {
        [index: string]: string
    };
}
