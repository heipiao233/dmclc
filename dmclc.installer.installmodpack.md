<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [dmclc](./dmclc.md) &gt; [Installer](./dmclc.installer.md) &gt; [installModpack](./dmclc.installer.installmodpack.md)

## Installer.installModpack() method

Install modpack.

**Signature:**

```typescript
installModpack(modpack: Modpack, name: string): Promise<MinecraftVersion>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  modpack | [Modpack](./dmclc.modpack.md) | The modpack. |
|  name | string | The name of the new version. |

**Returns:**

Promise&lt;[MinecraftVersion](./dmclc.version.md)<!-- -->&gt;

The new version.

## Exceptions

RequestError
