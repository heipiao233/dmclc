import fs from "fs";
import { ensureDir } from "fs-extra";
import got, { HTTPError } from "got";
import path from "path";
import * as streamPromises from "stream/promises";
import { FormattedError } from "../errors/FormattedError.js";
import { Launcher } from "../launcher.js";
import { transformURL } from "./TransformURL.js";
export async function downloadAll(files: Map<string, fs.PathLike>, launcher: Launcher): Promise<boolean> {
    const promises: Promise<boolean>[] = [];
    files.forEach((v, k) => {
        promises.push(download(k, v, launcher));
    });
    return !(await Promise.all(promises)).includes(false);
}
/**
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
    try {
        if (launcher.downloader) await launcher.downloader(realURL, filename, url);
        else await downloader(realURL, filename, url);
    } catch(e) {
        if (e instanceof FormattedError) {
            launcher.error(e.message);
            return false;
        }
    }
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
