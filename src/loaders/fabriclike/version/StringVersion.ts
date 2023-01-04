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

import { Version } from "./Version.js";

export class StringVersion implements Version {
    private readonly version: string;

    constructor(version: string) {
        this.version = version;
    }

    getFriendlyString(): string {
        return this.version;
    }

    equals(obj: unknown): boolean {
        if (obj instanceof StringVersion) {
            return this.version === obj.version;
        } else {
            return false;
        }
    }

    compareTo(o: Version): number {
        return this.getFriendlyString().localeCompare(o.getFriendlyString());
    }

    toString(): string {
        return this.version;
    }
}
