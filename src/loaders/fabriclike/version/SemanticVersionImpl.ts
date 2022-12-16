/*
 * Ported from Fabric Loader.
 * Copyright 2016 FabricMC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SemanticVersion } from "./SemanticVersion.js";
import { VersionParsingException } from "./VersionParsingException.js";
import { Version } from "./Version.js";

/**
 * Parser for a superset of the semantic version format described at <a href="https://semver.org">semver.org</a>.
 *
 * <p>This superset allows additionally
 * <ul><li>Arbitrary number of {@code <version core>} components, but at least 1
 * <li>{@code x}, {@code X} or {@code *} for the last {@code <version core>} component with {@code storeX} if not the first
 * <li>Arbitrary {@code <build>} contents
 * </ul>
 */
export class SemanticVersionImpl implements SemanticVersion {
    private static readonly DOT_SEPARATED_ID = /|[-0-9A-Za-z]+(\.[-0-9A-Za-z]+)*/;
    private static readonly UNSIGNED_INTEGER = /0|[1-9][0-9]*/;
    private readonly components: number[] = [];
    private readonly prerelease: string | null;
    private readonly build: string | null;
    private friendlyName = "";

    static of(version: string, storeX: boolean) {
        const buildDelimPos = version.indexOf("+");
        let build: string | null = null;

        if (buildDelimPos >= 0) {
            build = version.substring(buildDelimPos + 1);
            version = version.substring(0, buildDelimPos);
        }

        const dashDelimPos = version.indexOf("-");
        let prerelease: string | null = null;

        if (dashDelimPos >= 0) {
            prerelease = version.substring(dashDelimPos + 1);
            version = version.substring(0, dashDelimPos);
        }

        if (prerelease != null && !prerelease.match(SemanticVersionImpl.DOT_SEPARATED_ID)) {
            throw new VersionParsingException("Invalid prerelease string '" + prerelease + "'!");
        }

        if (version.endsWith(".")) {
            throw new VersionParsingException("Negative version number component found!");
        } else if (version.startsWith(".")) {
            throw new VersionParsingException("Missing version component!");
        }

        const componentStrings = version.split("\\.");

        if (componentStrings.length < 1) {
            throw new VersionParsingException("Did not provide version numbers!");
        }

        let components: number[] = [];
        let firstWildcardIdx = -1;

        for (let i = 0; i < componentStrings.length; i++) {
            const compStr = componentStrings[i];

            if (storeX) {
                if (compStr === "x" || compStr === "X" || compStr === "*") {
                    if (prerelease != null) {
                        throw new VersionParsingException("Pre-release versions are not allowed to use X-ranges!");
                    }

                    components[i] = SemanticVersion.COMPONENT_WILDCARD;
                    if (firstWildcardIdx < 0) firstWildcardIdx = i;
                    continue;
                } else if (i > 0 && components[i - 1] == SemanticVersion.COMPONENT_WILDCARD) {
                    throw new VersionParsingException("Interjacent wildcard (1.x.2) are disallowed!");
                }
            }

            if (compStr.trim() === "") {
                throw new VersionParsingException("Missing version number component!");
            }

            try {
                components[i] = parseInt(compStr);

                if (components[i] < 0) {
                    throw new VersionParsingException("Negative version number component '" + compStr + "'!");
                }
            } catch {
                throw new VersionParsingException("Could not parse version number component '" + compStr + "'!");
            }
        }

        if (storeX && components.length == 1 && components[0] == SemanticVersion.COMPONENT_WILDCARD) {
            throw new VersionParsingException("Versions of form 'x' or 'X' not allowed!");
        }

        // strip extra wildcards (1.x.x -> 1.x)
        if (firstWildcardIdx > 0 && components.length > firstWildcardIdx + 1) {
            components = components.slice(0, firstWildcardIdx +1 );
        }

        return new SemanticVersionImpl(components, prerelease, build);
    }

    constructor(components: number[], prerelease: string | null, build: string | null) {
        if (components.length == 0 || components[0] == SemanticVersion.COMPONENT_WILDCARD) throw new Error("Invalid components: "+components);

        this.components = components;
        this.prerelease = prerelease;
        this.build = build;

        this.buildFriendlyName();
    }

    private buildFriendlyName() {
        const fnBuilder = [];
        let first = true;

        for (const i of this.components) {
            if (first) {
                first = false;
            } else {
                fnBuilder.push(".");
            }

            if (i == SemanticVersion.COMPONENT_WILDCARD) {
                fnBuilder.push("x");
            } else {
                fnBuilder.push(i);
            }
        }

        if (this.prerelease != null) {
            fnBuilder.push("-");
            fnBuilder.push(this.prerelease);
        }

        if (this.build != null) {
            fnBuilder.push("+");
            fnBuilder.push(this.build);
        }

        this.friendlyName = fnBuilder.toString();
    }

    getVersionComponentCount(): number {
        return this.components.length;
    }

    getVersionComponent(pos: number): number {
        if (pos < 0) {
            throw new Error("Tried to access negative version number component!");
        } else if (pos >= this.components.length) {
            // Repeat "x" if x-range, otherwise repeat "0".
            return this.components[this.components.length - 1] == SemanticVersion.COMPONENT_WILDCARD ? SemanticVersion.COMPONENT_WILDCARD : 0;
        } else {
            return this.components[pos];
        }
    }

    getVersionComponents(): number[] {
        return Array.from(this.components);
    }

    getPrereleaseKey(): string | null {
        return this.prerelease;
    }

    getBuildKey(): string | null {
        return this.build;
    }

    getFriendlyString(): string {
        return this.friendlyName;
    }

    equals(o: unknown): boolean {
        if (!(o instanceof SemanticVersionImpl)) {
            return false;
        } else {
            if (!this.equalsComponentsExactly(o)) {
                return false;
            }

            return this.prerelease === o.prerelease && this.build === o.build;
        }
    }

    toString(): string {
        return this.getFriendlyString();
    }

    hasWildcard(): boolean {
        for (const i of this.components) {
            if (i < 0) {
                return true;
            }
        }

        return false;
    }

    equalsComponentsExactly(other: SemanticVersionImpl): boolean {
        for (let i = 0; i < Math.max(this.getVersionComponentCount(), other.getVersionComponentCount()); i++) {
            if (this.getVersionComponent(i) != other.getVersionComponent(i)) {
                return false;
            }
        }

        return true;
    }

    compareTo(other: Version): number {
        if (!(other instanceof SemanticVersion)) {
            return this.getFriendlyString().localeCompare(other.getFriendlyString());
        }

        const o = other;

        for (let i = 0; i < Math.max(this.getVersionComponentCount(), o.getVersionComponentCount()); i++) {
            const first = this.getVersionComponent(i);
            const second = o.getVersionComponent(i);

            if (first == SemanticVersion.COMPONENT_WILDCARD || second == SemanticVersion.COMPONENT_WILDCARD) {
                continue;
            }

            const compare = first - second;
            if (compare != 0) return compare;
        }

        const prereleaseA = this.getPrereleaseKey();
        const prereleaseB = o.getPrereleaseKey();

        if (prereleaseA || prereleaseB) {
            if (prereleaseA && prereleaseB) {
                const prereleaseATokenizer = prereleaseA.split(".");
                const prereleaseBTokenizer = prereleaseB.split(".");
                // while (prereleaseATokenizer.hasMoreElements()) {
                //     if (prereleaseBTokenizer.hasMoreElements()) {
                //         String partA = prereleaseATokenizer.nextToken();
                //         String partB = prereleaseBTokenizer.nextToken();

                //         if (SemanticVersionImpl.UNSIGNED_INTEGER.matcher(partA).matches()) {
                //             if (SemanticVersionImpl.UNSIGNED_INTEGER.matcher(partB).matches()) {
                //                 this.int compare = Integer.compare(partA.length(), partB.length());
                //                 if (compare != 0) return compare;
                //             } else {
                //                 return -1;
                //             }
                //         } else {
                //             if (SemanticVersionImpl.UNSIGNED_INTEGER.matcher(partB).matches()) {
                //                 return 1;
                //             }
                //         }

                //         this.int compare = partA.compareTo(partB);
                //         if (compare != 0) return compare;
                //     } else {
                //         return 1;
                //     }
                // }
                for (let i=0;i<prereleaseATokenizer.length;i++) {
                    if (prereleaseBTokenizer.length > i) {
                        const partA = prereleaseATokenizer[i];
                        const partB = prereleaseBTokenizer[i];
                        if (partA.match(SemanticVersionImpl.UNSIGNED_INTEGER)) {
                            if (partB.match(SemanticVersionImpl.UNSIGNED_INTEGER)) {
                                const compare = partA.length - partB.length;
                                if (compare != 0) return compare;
                            } else {
                                return -1;
                            }
                        } else {
                            if (partB.match(SemanticVersionImpl.UNSIGNED_INTEGER)) {
                                return 1;
                            }
                        }

                        const compare = partA.localeCompare(partB);
                        if (compare != 0) return compare;
                    } else return 1;
                }

                return prereleaseBTokenizer.length > prereleaseATokenizer.length ? -1 : 0;
            } else if (prereleaseA) {
                return o.hasWildcard() ? 0 : -1;
            } else {
                return this.hasWildcard() ? 0 : 1;
            }
        } else {
            return 0;
        }
    }
}
