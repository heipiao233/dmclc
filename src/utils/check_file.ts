import * as crypto from "crypto";
import fs from "fs";
import fsPromises from 'fs/promises';

export async function checkFile (filename: fs.PathLike, hash: string, algorithm = "sha1"): Promise<boolean> {
    if (!fs.existsSync(filename)) return false;
    if (hash === "") return true;
    const val = await fsPromises.readFile(filename);
    return crypto.createHash(algorithm).update(val).digest("hex") === hash;
}
