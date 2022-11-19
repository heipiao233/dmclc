// https://github.com/huanghongxun/HMCL/blob/73b938cfd9d408df4e9a91987fea190cc9b42706/HMCLCore/src/main/java/org/jackhuang/hmcl/util/platform/JavaVersion.java#L300

import * as cp from "child_process";
import os from "os";
import fs from "fs";

export function findAllJava(): Map<string, string> {
    const res = new Map<string, string>();
    switch (os.platform()) {
    case "win32":
        return readFromRegister();
    case "linux":
        return findForLinux();
    default:
        break;
    }
    return res;
}

function readFromRegister(): Map<string, string> {
    const lines = cp.execSync("reg query \"HKCR\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache\" /f \"java.exe.ApplicationCompany\"").toString().split("\n");
    const ret = new Map<string, string>();
    lines.filter(i=>i.includes("java.exe")).map(i=>{
        const javaExec = i.match("[A-Z]:.+?\\.exe")![0];
        ret.set(javaExec, getJavaVersion(javaExec));
    });
    return ret;
}
function findForLinux(): Map<string, string> {
    const dirs = ["/usr/java", "/usr/lib/jvm", "/usr/lib32/jvm"];
    const ret = new Map<string, string>();
    for (const i of dirs) {
        for (const j of fs.readdirSync(i)) {
            const exec = `${i}/${j}/bin/java`;
            if(fs.existsSync(exec)){
                ret.set(exec, getJavaVersion(exec));
            }
        }
    }
    return ret;
}

function getJavaVersion(javaExec: string): string {
    return cp.execFileSync(javaExec, ["-XshowSettings:properties", "-version"]).toString().match(/java\.version = (.+)/)![1];
}

