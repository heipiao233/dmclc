import fs from "fs";
import * as crypto from "crypto";

export function checkFile (filename: number | fs.PathLike, hash: string, algorithm = "sha1"): boolean {
    const val = fs.readFileSync(filename);
    return crypto.createHash(algorithm).update(val).digest("hex") === hash;
}
