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
import { Version } from "./Version.js";
import { VersionParsingException } from "./VersionParsingException.js";
import { SemanticVersionImpl } from "./SemanticVersionImpl.js";
import { StringVersion } from "./StringVersion.js";

export class VersionParser {
    public static parse(s: string, storeX: boolean): Version {
        if (s == null || s === "") {
            throw new VersionParsingException("Version must be a non-empty string!");
        }

        let version: Version;

        try {
            version = SemanticVersionImpl.of(s, storeX);
        } catch {
            version = new StringVersion(s);
        }

        return version;
    }

    public static parseSemantic(s: string): SemanticVersion {
        if (s == null || s === "") {
            throw new VersionParsingException("Version must be a non-empty string!");
        }

        return SemanticVersionImpl.of(s, false);
    }
}
