import { execSync } from "child_process";
import os from "os";

export default function copy(str: string) {
    switch (os.platform()) {
    case "win32":
        execSync(`echo ${str} | clip`);
        break;

    case "darwin":
        execSync(`echo "${str}" | pbcopy`);
        break;

    default:
        execSync(`echo "${str}" | xclip`);
        break;
    }
}