import assert from "node:assert";
import test from "node:test";
import { VersionInfo } from "../lib/schemas";
import { Account, findAllJava, Launcher } from "../src/index";
import { MinecraftVersion } from "../src/version";

const launcher = new Launcher("./.minecraft", "dmclc_test", (await findAllJava())[0].b, "71dd081b-dc92-4d36-81ac-3a2bde5527ba");
let account: Account<never>;
await launcher.init();
await test("java", async () => {
    for (const i of await findAllJava()) {
        if (i.a.includes("17")) launcher.usingJava = i.b;
    }
});
await test("login", async () => {
    account = launcher.accountTypes.get("microsoft")!({}) as Account<never>;
    await account.readUserExtraContent(new Map());
});
await test("game", async ctx => {
    let version: MinecraftVersion;
    let versionf: MinecraftVersion;
    let versionq: MinecraftVersion;
    let versionfg: MinecraftVersion;
    await ctx.test("download", async () => {
        const list = await launcher.installer.getVersionList();
        const release = list.latest.release;
        let ver: VersionInfo = list.versions[0];
        for (const i of list.versions) {
            if (i.id === release) ver = i;
        }
        version = await launcher.installer.install(ver, ver.id);
        versionf = await launcher.installer.install(ver, ver.id + "-fabric");
        await versionf.installLoader("fabric", (await launcher.loaders.get("fabric")!.getSuitableLoaderVersions(versionf))[0]);
        versionq = await launcher.installer.install(ver, ver.id + "-quilt");
        await versionq.installLoader("quilt", (await launcher.loaders.get("quilt")!.getSuitableLoaderVersions(versionq))[0]);
        versionfg = await launcher.installer.install(ver, ver.id + "-forge");
        await versionfg.installLoader("forge", (await launcher.loaders.get("forge")!.getSuitableLoaderVersions(versionfg))[0]);
        assert(launcher.installedVersions.size === 4);
    });
    await ctx.test("launch", async (ctx2) => {
        await ctx2.test("vanilla", () => {
            return new Promise((resolve, reject) => {
                version.run(account).then(child => {
                    child.once("exit", (code) => {
                        if (code === 0) {
                            resolve(null);
                        } else reject();
                    });
                });
            });
        });
        await ctx2.test("forge", () => {
            return new Promise((resolve, reject) => {
                versionfg.run(account).then(child => {
                    child.once("exit", (code) => {
                        if (code === 0) {
                            resolve(null);
                        } else reject();
                    });
                });
            });
        });
        await ctx2.test("fabric", () => {
            return new Promise((resolve, reject) => {
                versionf.run(account).then(child => {
                    child.once("exit", (code) => {
                        if (code === 0) {
                            resolve(null);
                        } else reject();
                    });
                });
            });
        });
        await ctx2.test("quilt", () => {
            return new Promise((resolve, reject) => {
                versionq.run(account).then(child => {
                    child.once("exit", (code) => {
                        if (code === 0) {
                            resolve(null);
                        } else reject();
                    });
                });
            });
        });
    });
});
