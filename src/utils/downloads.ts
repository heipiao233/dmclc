import fs from "fs";
import got from "got";
import * as stream from "stream/promises";
import { transformURL } from "./TransformURL.js";
export function downloadAll(files: Map<string, fs.PathLike>, mirror?: string): Promise<void>[] {
    const promises: Array<Promise<void>> = new Array<Promise<void>>();
    files.forEach((v, k) => {
        promises.push(download(k, v, mirror));
    });
    return promises;
}
export async function download(url: string, filename: fs.PathLike, mirror?: string): Promise<void> {
    if(url.length===0)return;
    let realURL = transformURL(url, mirror);
    realURL = realURL.replaceAll("http://", "https://");
    await stream.pipeline(got.stream(realURL), fs.createWriteStream(filename));
}
