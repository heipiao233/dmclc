// https://github.com/huanghongxun/HMCL/blob/73b938cfd9d408df4e9a91987fea190cc9b42706/HMCLCore/src/main/java/org/jackhuang/hmcl/util/platform/JavaVersion.java#L300

import * as cp from "child_process";
import os from "os";
import fs from "fs";

export async function findAllJava(): Promise<Map<string, string>> {
    const res = new Map<string, string>();
    switch (os.platform()) {
    case "win32":
        return await readFromRegister();
    case "linux":
        return await findForLinux();
    default:
        break;
    }
    return res;
}

async function readFromRegister(): Promise<Map<string, string>> {
    const lines = cp.execSync("reg query \"HKCR\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache\" /f \"java.exe.ApplicationCompany\"").toString().split("\n");
    const ret = new Map<string, string>();
    await Promise.all(lines.filter(i=>i.includes("java.exe")).map(async i=>{
        const javaExec = i.match("[A-Z]:.+?\\.exe")![0];
        ret.set(javaExec, await getJavaVersion(javaExec));
    }));
    return ret;
}
async function findForLinux(): Promise<Map<string, string>> {
    const dirs = ["/usr/java", "/usr/lib/jvm", "/usr/lib32/jvm"];
    const ret = new Map<string, string>();
    for (const i of dirs) {
        for (const j of fs.readdirSync(i)) {
            const exec = `${i}/${j}/bin/java`;
            if(fs.existsSync(exec)){
                ret.set(exec, await getJavaVersion(exec));
            }
        }
    }
    return ret;
}

async function getJavaVersion(javaExec: string): Promise<string> {
    return new Promise(resolve=>{
        const proc = cp.execFile(javaExec, ["-XshowSettings:properties", "-version"]);
        let stderr = "";
        proc.stderr?.on("data", (data)=>{
            stderr+=data;
        });
        resolve((stderr.toString().match(/java\.version = (.+)/)??["", "Unknown Version"])[1]);
    });
}
