import fs from "fs";
import got, { HTTPError } from "got";
import * as streamPromises from "stream/promises";
import { FormattedError } from "../errors/FormattedError.js";
import { Launcher } from "../launcher.js";
import { transformURL } from "./TransformURL.js";
export function downloadAll(files: Map<string, fs.PathLike>, launcher: Launcher): Promise<void>[] {
    const promises: Array<Promise<void>> = new Array<Promise<void>>();
    files.forEach((v, k) => {
        promises.push(download(k, v, launcher));
    });
    return promises;
}
/**
 * @throws {@link FormattedError}
 * @param url - URL.
 * @param filename - File name.
 * @param mirror - BMCLAPI mirror.
 */
export async function download(url: string, filename: fs.PathLike, launcher: Launcher): Promise<void> {
    if(url.length===0)return;
    let realURL = transformURL(url, launcher.mirror);
    realURL = realURL.replaceAll("http://", "https://");
    if (launcher.downloader) await launcher.downloader(realURL, filename, url);
    else await downloader(realURL, filename, url);
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
    if(failed) {
        throw new FormattedError("Download failed!");
    }
}
