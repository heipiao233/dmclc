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
import { SemanticVersionImpl } from "./SemanticVersionImpl.js";
import { Version } from "./Version.js";

export class VersionComparisonOperator {
    // order is important to match the longest substring (e.g. try >= before >)
    static GREATER_EQUAL = new VersionComparisonOperator(">=", true, false,
        (a, b) => a.compareTo(b) >= 0,
        (version) => version
    );
    static LESS_EQUAL = new VersionComparisonOperator("<=", false, true, 
        (a, b) => a.compareTo(b) <= 0,
        () => undefined,
        (version) => version
    );
    static GREATER = new VersionComparisonOperator(">", false, false,
        (a, b) => a.compareTo(b) > 0,
        (version) => version
    );
    static LESS = new VersionComparisonOperator("<", false, false, 
        (a, b) => a.compareTo(b) < 0,
        () => undefined,
        (version) => version
    );
    static EQUAL = new VersionComparisonOperator("=", true, true,
        (a, b)=>a.compareTo(b) == 0,
        (version) => version,
        (version) => version);
    static SAME_TO_NEXT_MINOR = new VersionComparisonOperator("~", true, false, 
        (a, b) => a.compareTo(b) >= 0
        && a.getVersionComponent(0) == b.getVersionComponent(0)
        && a.getVersionComponent(1) == b.getVersionComponent(1),
        (version) => version,
        (version) => new SemanticVersionImpl([version.getVersionComponent(0), version.getVersionComponent(1) + 1], "", null));
    static SAME_TO_NEXT_MAJOR = new VersionComparisonOperator("^", true, false, 
        (a, b) => a.compareTo(b) >= 0
        && a.getVersionComponent(0) == b.getVersionComponent(0),
        (version) => version,
        (version) => new SemanticVersionImpl([version.getVersionComponent(0) + 1], "", null));

    static readonly values = [this.GREATER_EQUAL, this.LESS_EQUAL, this.GREATER, this.LESS, this.EQUAL, this.SAME_TO_NEXT_MINOR, this.SAME_TO_NEXT_MAJOR];

    private readonly serialized: string;
    private readonly minInclusive: boolean;
    private readonly maxInclusive: boolean;

    constructor(serialized: string, minInclusive: boolean, maxInclusive: boolean, 
        public test0: (a: SemanticVersion, b: SemanticVersion) => boolean,
        public minVersion: (version: SemanticVersion) => SemanticVersion | undefined = () => undefined,
        public maxVersion: (version: SemanticVersion) => SemanticVersion | undefined = () => undefined
    ) {
        this.serialized = serialized;
        this.minInclusive = minInclusive;
        this.maxInclusive = maxInclusive;
    }

    getSerialized(): string {
        return this.serialized;
    }

    isMinInclusive(): boolean {
        return this.minInclusive;
    }

    isMaxInclusive(): boolean {
        return this.maxInclusive;
    }

    test(a: Version, b: Version): boolean {
        if (a instanceof SemanticVersion && b instanceof SemanticVersion) {
            return this.test0(a, b);
        } else if (this.minInclusive || this.maxInclusive) {
            return a.getFriendlyString() === b.getFriendlyString();
        } else {
            return false;
        }
    }
}
