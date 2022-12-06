import { MCVersion } from "../schemas.js";
import { merge } from "./mergeversionjson.js";
import fs from "fs";

export function expandInheritsFrom(versionObject: MCVersion, rootPath: string): MCVersion {
    let ret: MCVersion = versionObject;
    if(versionObject.inheritsFrom!==undefined){
        const original = JSON.parse(fs.readFileSync(`${rootPath}/versions/${versionObject.inheritsFrom}/${versionObject.inheritsFrom}.json`).toString());
        ret = merge(expandInheritsFrom(original, rootPath), versionObject, true);
    }
    return ret;
}