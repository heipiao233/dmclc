// https://github.com/huanghongxun/HMCL/blob/73b938cfd9d408df4e9a91987fea190cc9b42706/HMCLCore/src/main/java/org/jackhuang/hmcl/util/platform/JavaVersion.java#L300

import * as cp from "child_process";
import fs from "fs";
import os from "os";
import { Pair } from "./pair.js";

/**
 * Find all java.
 * @returns All java versions. An array of Pairs, Pair.a is java version, b is java executable.
 * @public
 */
export async function findAllJava(): Promise<Pair<string, string>[]> {
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

async function findForWindows(): Promise<Pair<string, string>[]> {
    const ret: Pair<string, string>[] = [];
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
            const pth=`${pf}\\${vendor}`;
            if(!fs.existsSync(pth))continue;
            for (const version of fs.readdirSync(pth)) {
                const exec = `${pth}\\${version}\\bin\\java.exe`;
                if(fs.existsSync(exec))ret.push(new Pair(await getJavaVersion(exec), exec));
            }
        }
    }
    return ret;
}

async function readFromRegister(key: string): Promise<Pair<string, string>[]> {
    const ret: Pair<string, string>[] = [];
    const versions = await getRegistrySubDirs(key);
    for (const version of versions) {
        if((await getRegistrySubDirs(version)).includes(`${version}\\MSI`)){
            const exec = `${await getRegistryValue(version, "JavaHome")}\\bin\\java.exe`;
            const groups = version.split("\\");
            if(fs.existsSync(exec))ret.push(new Pair(groups[groups.length-1], exec));
        }
    }
    return ret;
}

async function getRegistryValue(key: string, name: string): Promise<string> {
    return new Promise(resolve=>{
        let out = "";
        cp.execFile("cmd", ["/c", "reg", "query", key, "/v", name]).stdout?.on("data", chunk=>{
            out+=chunk;
        }).on("end", ()=>{
            const lines = out.split("\r\n");
            for (const line of lines) {
                if(line.includes("REG_SZ")){
                    resolve(line.substring(line.indexOf("REG_SZ") + "REG_SZ".length).trim());
                }
            }
        });
    });
}

async function getRegistrySubDirs(key: string): Promise<string[]> {
    return new Promise(resolve=>{
        let out = "";
        cp.execFile("cmd", ["/c", "reg", "query", key]).stdout?.on("data", chunk=>{
            out+=chunk;
        }).on("end", ()=>resolve(out.split("\r\n").filter(v=>v.startsWith(key))));
    });
}

async function findForLinux(): Promise<Pair<string, string>[]> {
    const dirs = ["/usr/java", "/usr/lib/jvm", "/usr/lib32/jvm"];
    const ret: Pair<string, string>[] = [];
    for (const i of dirs) {
        if (!fs.statSync(i).isDirectory()) {
            continue;
        }
        for (const j of fs.readdirSync(i)) {
            const exec = `${i}/${j}/bin/java`;
            if(fs.existsSync(exec)){
                ret.push(new Pair(await getJavaVersion(exec), exec));
            }
        }
    }
    return ret;
}

async function findForMac(): Promise<Pair<string, string>[]> {
    const ret: Pair<string, string>[] = [];
    let i = "/Library/Java/JavaVirtualMachines";
    for (const j of fs.readdirSync(i)) {
        let exec = `${i}/${j}/Contents/Home/bin/java`;
        if(fs.existsSync(exec)){
            ret.push(new Pair(await getJavaVersion(exec), exec));
        }
        exec = `${i}/${j}/Contents/Home/jre/bin/java`;
        if(fs.existsSync(exec)){
            ret.push(new Pair(await getJavaVersion(exec), exec));
        }
    }
    i = "/System/Library/Java/JavaVirtualMachines";
    for (const j of fs.readdirSync(i)) {
        const exec = `${i}/${j}/Contents/Home/bin/java`;
        if(fs.existsSync(exec)){
            ret.push(new Pair(await getJavaVersion(exec), exec));
        }
    }
    let exec = "/Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java";
    if(fs.existsSync(exec)){
        ret.push(new Pair(await getJavaVersion(exec), exec));
    }
    exec = "/Applications/Xcode.app/Contents/Applications/Application Loader.app/Contents/MacOS/itms/java/bin/java";
    if(fs.existsSync(exec)){
        ret.push(new Pair(await getJavaVersion(exec), exec));
    }
    return ret;
}

/**
 * Get the version of a Java executable.
 * @param javaExec - Java executable
 * @returns Version.
 * @public
 */
export async function getJavaVersion(javaExec: string): Promise<string> {
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
