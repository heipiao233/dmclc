import path from "path";

export function expandMavenId (id: string): string {
    const nameExt = id.split("@");
    const ext = nameExt.length === 1 ? "jar" : nameExt[1];
    const groupNameVersionClassifier = nameExt[0].split(":");
    const group = groupNameVersionClassifier[0];
    const name = groupNameVersionClassifier[1];
    const version = groupNameVersionClassifier[2];
    if (groupNameVersionClassifier.length === 4) return `${group.replaceAll(".", path.sep)}${path.sep}${name}${path.sep}${version}${path.sep}${name}-${version}-${groupNameVersionClassifier[3]}.${ext}`;
    return `${group.replaceAll(".", path.sep)}${path.sep}${name}${path.sep}${version}${path.sep}${name}-${version}.${ext}`;
}
