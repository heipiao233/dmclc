import fs from "fs";
import { ensureDir } from "fs-extra";
import got, { HTTPError } from "got";
import path from "path";
import * as streamPromises from "stream/promises";
import { FormattedError } from "../errors/FormattedError.js";
import { Launcher } from "../launcher.js";
import { transformURL } from "./TransformURL.js";
import { Pair } from "./pair.js";
import { checkFile } from "./check_file.js";
/**
 * Download multi files after checking hash.
 * @throws RequestError
 * @param files A map from URL to path
 * @param launcher Launcher
 * @returns true if success
 */
export async function checkAndDownloadAll(files: Map<string, Pair<string, fs.PathLike>>, launcher: Launcher, algorithm = "sha1"): Promise<boolean> {
    const promises: Promise<boolean>[] = [];
    files.forEach((v, k) => {
        if (v.a === "no") {
            promises.push(download(k, v.b, launcher));
        } else {
            promises.push(checkAndDownload(k, v.b, v.a, launcher, algorithm));
        }
    });
    return !(await Promise.all(promises)).includes(false);
}

/**
 * Download multi files.
 * @throws RequestError
 * @param files A map from URL to path
 * @param launcher Launcher
 * @returns true if success
 */
export async function downloadAll(files: Map<string, fs.PathLike>, launcher: Launcher): Promise<boolean> {
    const promises: Promise<boolean>[] = [];
    files.forEach((v, k) => {
        promises.push(download(k, v, launcher));
    });
    return !(await Promise.all(promises)).includes(false);
}

/**
 * Download a file after checking hash.
 * @throws {@link FormattedError}
 * @param url - URL.
 * @param filename - File name.
 * @param mirror - BMCLAPI mirror.
 */
export async function checkAndDownload(url: string, filename: fs.PathLike, hash: string, launcher: Launcher, algorithm = "sha1"): Promise<boolean> {
    if (!await checkFile(filename, hash, algorithm)) {
        return await download(url, filename, launcher);
    }
    return true;
}

/**
 * Download a file.
 * @throws {@link FormattedError}
 * @param url - URL.
 * @param filename - File name.
 * @param mirror - BMCLAPI mirror.
 */
export async function download(url: string, filename: fs.PathLike, launcher: Launcher): Promise<boolean> {
    if(url.length===0)return true;
    const dir = path.dirname(filename.toString());
    await ensureDir(dir);
    let realURL = transformURL(url, launcher.mirror);
    realURL = realURL.replaceAll("http://", "https://");
    if (launcher.downloader) await launcher.downloader(realURL, filename, url);
    else await downloader(realURL, filename, url);
    return true;
}

async function downloader(url: string, filename: fs.PathLike, oldURL: string) {
    let failed = true;
    for (let i=0;i<10;i++) {
        try {
            await streamPromises.pipeline(got.stream(url), fs.createWriteStream(filename));
            failed = false;
            break;
        } catch (e) {
            if(e instanceof HTTPError) {
                if(e.response.statusCode === 404) {
                    url = oldURL.replaceAll("http://", "https://");
                    i--;
                }
            }
        }
    }
    if (failed) {
        throw new FormattedError(`Download failed: ${url}`);
    }
}
