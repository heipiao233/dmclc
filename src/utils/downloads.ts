import fs from "fs";
import got, { HTTPError } from "got";
import * as streamPromises from "stream/promises";
import { transformURL } from "./TransformURL.js";
export function downloadAll(files: Map<string, fs.PathLike>, mirror?: string): Promise<void>[] {
    const promises: Array<Promise<void>> = new Array<Promise<void>>();
    files.forEach((v, k) => {
        promises.push(download(k, v, mirror));
    });
    return promises;
}
export async function download(url: string, filename: fs.PathLike, mirror?: string, trys = 1): Promise<void> {
    if(url.length===0)return;
    let realURL = transformURL(url, mirror);
    realURL = realURL.replaceAll("http://", "https://");
    for (let i=0;i<10;i++) {
        let error = false;
        try {
            await streamPromises.pipeline(got.stream(realURL), fs.createWriteStream(filename));
        } catch (e) {
            if(e instanceof HTTPError) {
                if(e.response.statusCode === 404) {
                    realURL = url.replaceAll("http://", "https://");
                    i--;
                }
            }
            error = true;
        }
        if(!error) break;
    }
}
