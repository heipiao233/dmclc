import { findAllJava, Launcher } from "../src/index.js";
import { ContentType, SortField } from "../src/mods/download/ContentService.js";
import ModrinthContentService from "../src/mods/download/modrinth/ModrinthContentService.js";

const launcher = new Launcher("./.minecraft", "dmclc_test", (await findAllJava())[0].b);
await launcher.init();

const service = new ModrinthContentService(launcher);
const mods = await service.searchContent("Fabulously Optimized", 0, 20, ContentType.MODPACK, SortField.DOWNLOADS);
console.log(await (await mods[0].listVersions())[0].getVersionFileURL());
