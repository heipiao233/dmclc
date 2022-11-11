import { Library } from "../../schemas.js";

export declare class InstallerProfile {
    data: {
    [index: string]: { "client": string, "server": string }
  };

    processors: Processor[];
    libraries: Library[];
}
declare class Processor {
    sides: ["client" | "server"];
    jar: string;
    classpath: string[];
    args: string[];
    output: {
    [index: string]: string
  };
}
