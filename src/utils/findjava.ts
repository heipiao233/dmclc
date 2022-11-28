// https://github.com/huanghongxun/HMCL/blob/73b938cfd9d408df4e9a91987fea190cc9b42706/HMCLCore/src/main/java/org/jackhuang/hmcl/util/platform/JavaVersion.java#L300

import * as cp from "child_process";
import os from "os";
import fs from "fs";
import { promisified as regedit } from "regedit";

export async function findAllJava(): Promise<string[][]> {
    switch (os.platform()) {
    case "win32":
        return await findForWindows();
    case "linux":
        return await findForLinux();
    case "darwin":
        return await findForMac();
    default:
        return [];
    }
}

async function findForWindows(): Promise<string[][]> {
    const ret:string[][] = [];
    ret.push(...await readFromRegister("HKEY_LOCAL_MACHINE\\SOFTWARE\\JavaSoft\\Java Runtime Environment"));
    ret.push(...await readFromRegister("HKEY_LOCAL_MACHINE\\SOFTWARE\\JavaSoft\\Java Development Kit"));
    ret.push(...await readFromRegister("HKEY_LOCAL_MACHINE\\SOFTWARE\\JavaSoft\\JRE"));
    ret.push(...await readFromRegister("HKEY_LOCAL_MACHINE\\SOFTWARE\\JavaSoft\\JDK"));
    for (const pf of [
        process.env["ProgramFiles"]??"C:\\Program Files",
        process.env["ProgramFiles(x86)"]??"C:\\Program Files (x86)",
        process.env["ProgramFiles(ARM)"]??"C:\\Program Files (ARM)"
    ]) {
        if(!fs.existsSync(pf)){
            continue;
        }
        for(const vendor of ["Java", "BellSoft", "AdoptOpenJDK", "Zulu", "Microsoft", "Eclipse Foundation", "Semeru"]) {
            for (const version of fs.readdirSync(`${pf}\\${vendor}`)) {
                const exec = `${pf}\\${vendor}\\${version}\\bin\\java.exe`;
                if(fs.existsSync(exec))ret.push([version, exec]);
            }
        }
    }
    return ret;
}

async function readFromRegister(key: string): Promise<string[][]> {
    const versions = await regedit.list([key]);
    const ret: string[][] = [];
    versions[key].keys.forEach(async val=>{
        const query = `${key}\\${val}`;
        const versionInfo = (await regedit.list([query]))[query];
        ret.push([val, `${versionInfo.values["JavaHome"].value}\\bin\\java.exe`]);
    });
    return ret;
}

async function findForLinux(): Promise<string[][]> {
    const dirs = ["/usr/java", "/usr/lib/jvm", "/usr/lib32/jvm"];
    const ret: string[][] = [];
    for (const i of dirs) {
        for (const j of fs.readdirSync(i)) {
            const exec = `${i}/${j}/bin/java`;
            if(fs.existsSync(exec)){
                ret.push([exec, await getJavaVersion(exec)]);
            }
        }
    }
    return ret;
}

async function findForMac(): Promise<string[][]> {
    const ret: string[][] = [];
    // TODO: MAC
    return ret;
}

async function getJavaVersion(javaExec: string): Promise<string> {
    return new Promise(resolve=>{
        const proc = cp.execFile(javaExec, ["-XshowSettings:properties", "-version"]);
        let stderr = "";
        proc.stderr?.on("data", (data)=>{
            stderr+=data;
        });
        proc.stderr?.on("end", ()=>{
            resolve((stderr.toString().match(/java\.version = (.+)/)??["", "Unknown Version"])[1]);
        });
    });
}
