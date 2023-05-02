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

import { Version } from "./Version";
import { VersionComparisonOperator } from "./VersionComparisonOperator";
import { VersionInterval } from "./VersionInterval";
import { VersionPredicateParser } from "./VersionPredicateParser";

export abstract class VersionPredicate {
    /**
     * Get all terms that have to be satisfied for this predicate to match.
     *
     * @return Required predicate terms, empty if anything matches
     */
    abstract getTerms(): PredicateTerm[];

    /**
     * Get the version interval representing the matched versions.
     *
     * @return Covered version interval or null if nothing
     */
    abstract getInterval(): VersionInterval;

    abstract test(version: Version): boolean;

    static parseStringOne(predicate: string): VersionPredicate {
        return VersionPredicateParser.parseOne(predicate);
    }

    static parseString(predicates: string[]): Set<VersionPredicate> {
        return VersionPredicateParser.parse(predicates);
    }
}

export interface PredicateTerm {
    getOperator(): VersionComparisonOperator;
    getReferenceVersion(): Version;
}
