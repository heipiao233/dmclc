import test from "node:test";
import { Account, ContentType, Launcher, findAllJava } from "../src/index.js";
import { LauncherInterface } from "../src/launcher.js";
import CurseForgeContentService, { CurseForgeSortField } from "../src/mods/download/curseforge/CurseForgeContentService.js";
import ModrinthContentService, { ModrinthSortField } from "../src/mods/download/modrinth/ModrinthContentService.js";
import { download } from "../src/utils/downloads.js";

const int: LauncherInterface = {
    askUser: async function <T extends string>(questions: Record<T, string>, message?: string | undefined): Promise<Record<T, string>> {
        throw new Error("Function not implemented.");
    },
    askUserOne: async function (localized: string, message?: string | undefined): Promise<string> {
        return "";
    },
    info: async function (message: string, title: string): Promise<void> {
        console.info(message);
    },
    warn: async function (message: string, title: string): Promise<void> {
        console.warn(message);
    },
    error: async function (message: string, title: string): Promise<void> {
        console.error(message);
    }
}

const launcher = await Launcher.create("./.minecraft", "dmclc_test", (await findAllJava())[0].b, "71dd081b-dc92-4d36-81ac-3a2bde5527ba", int);
await test("contentServices", async ctx => {
    await ctx.test("curseforge", async ctxCurseForge => {
        const service: CurseForgeContentService = launcher.contentServices.get("curseforge")! as CurseForgeContentService;
        const field = CurseForgeSortField.FEATURED;
        const mods = await service.searchContent("Fabulously Optimized", 0, 20, ContentType.MODPACK, field);
        const url = await (await mods[0].listVersions())[0].getVersionFileURL();
        console.log(url);
        await ctxCurseForge.test("modpack", async () => {
            await download(url, "fo.zip", launcher);
            const modpack = await launcher.modpackFormats.get("curseforge")?.readModpack("fo.zip", launcher)!;
            const version = await launcher.installer.installModpack(modpack, modpack.getName());
            const account = launcher.accountTypes.get("microsoft")!({}) as Account<never>;
            await account.login();
            version.run(account);
        });
    });
    await ctx.test("modrinth", async ctxModrinth => {
        const service: ModrinthContentService = launcher.contentServices.get("modrinth")! as ModrinthContentService;
        const field = ModrinthSortField.RELEVANCE;
        const pack = await service.searchContent("Fabulously Optimized", 0, 1, ContentType.MODPACK, field);
        const url = await (await pack[0].listVersions())[0].getVersionFileURL();
        console.log(url);
        await ctxModrinth.test("modpack",async () => {
            await download(url, "fo.mrpack", launcher);
            const modpack = await launcher.modpackFormats.get("modrinth")?.readModpack("fo.mrpack", launcher)!;
            const version = await launcher.installer.installModpack(modpack, modpack.getName());
            const account = launcher.accountTypes.get("microsoft")!({}) as Account<never>;
            await account.login();
            version.run(account);
        });
    });
});