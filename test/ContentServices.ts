import test from "node:test";
import { findAllJava, Launcher } from "../lib/index.js";
import { ContentType } from "../lib/mods/download/ContentService.js";
import CurseForgeContentService, { CurseForgeSortField } from "../lib/mods/download/curseforge/CurseForgeContentService.js";
import ModrinthContentService, { ModrinthSortField } from "../lib/mods/download/modrinth/ModrinthContentService.js";

const launcher = await Launcher.create("./.minecraft", "dmclc_test", (await findAllJava())[0].b, "71dd081b-dc92-4d36-81ac-3a2bde5527ba");
await test("contentServices", async ctx => {
    await ctx.test("curseforge", async () => {
        const service: CurseForgeContentService = launcher.contentServices.get("curseforge")! as CurseForgeContentService;
        const field = CurseForgeSortField.FEATURED;
        const mods = await service.searchContent("JEI", 0, 20, ContentType.MOD, field);
        console.log(await (await mods[0].listVersions())[0].getVersionFileURL());
    });
    await ctx.test("modrinth", async ctxModrinth => {
        const service: ModrinthContentService = launcher.contentServices.get("modrinth")! as ModrinthContentService;
        const field = ModrinthSortField.RELEVANCE;
        const mods = await service.searchContent("Fabulously Optimized", 0, 1, ContentType.MODPACK, field);
        console.log(await (await mods[0].listVersions())[0].getVersionFileURL());
        // ctxModrinth.test();
    });
});