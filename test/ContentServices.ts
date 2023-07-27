import test from "node:test";
import { Account, findAllJava, Launcher } from "../lib/index.js";
import { ContentType } from "../lib/mods/download/ContentService.js";
import CurseForgeContentService, { CurseForgeSortField } from "../lib/mods/download/curseforge/CurseForgeContentService.js";
import ModrinthContentService, { ModrinthSortField } from "../lib/mods/download/modrinth/ModrinthContentService.js";

const launcher = await Launcher.create("./.minecraft", "dmclc_test", (await findAllJava())[0].b, "71dd081b-dc92-4d36-81ac-3a2bde5527ba");
await test("contentServices", async ctx => {
    await ctx.test("curseforge", async ctxCurseForge => {
        const service: CurseForgeContentService = launcher.contentServices.get("curseforge")! as CurseForgeContentService;
        const field = CurseForgeSortField.FEATURED;
        const mods = await service.searchContent("Fabulously Optimized", 0, 20, ContentType.MODPACK, field);
        const url = await (await mods[0].listVersions())[0].getVersionFileURL();
        console.log(url);
        await ctxCurseForge.test("modpack",async () => {
            // await download(url, "fo.mrpack", launcher);
            const modpack = await launcher.modpackFormats.get("curseforge")?.readModpack("fo.mrpack", launcher)!;
            const version = await launcher.installer.installModpack(modpack, modpack.getName());
            const account = launcher.accountTypes.get("microsoft")!({}) as Account<never>;
            await account.readUserExtraContent(new Map());
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
            // await download(url, "fo.mrpack", launcher);
            const modpack = await launcher.modpackFormats.get("modrinth")?.readModpack("fo.mrpack", launcher)!;
            const version = await launcher.installer.installModpack(modpack, modpack.getName());
            const account = launcher.accountTypes.get("microsoft")!({}) as Account<never>;
            await account.readUserExtraContent(new Map());
            version.run(account);
        });
    });
});