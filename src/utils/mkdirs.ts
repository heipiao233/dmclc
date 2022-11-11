import fs from "fs";
import path from "path";
export function mkdirs (name: fs.PathLike): void {
    if (!fs.existsSync(name)) {
        mkdirs(path.dirname(name.toString()));
        fs.mkdirSync(name);
    }
}
