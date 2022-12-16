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

import assert from "assert";
import { SemanticVersion } from "./SemanticVersion.js";
import { SemanticVersionImpl } from "./SemanticVersionImpl.js";
import { VersionParser } from "./VersionParser.js";
import { VersionParsingException } from "./VersionParsingException.js";
import { VersionPredicate } from "./VersionPredicate.js";
import { Version } from "./Version.js";
import { VersionInterval } from "./VersionInterval.js";
import { VersionIntervalImpl } from "./VersionIntervalImpl.js";
import { VersionComparisonOperator } from "./VersionComparisonOperator.js";
import { PredicateTerm } from "./VersionPredicate.js";

export class VersionPredicateParser {
    private static readonly OPERATORS: VersionComparisonOperator[] = VersionComparisonOperator.values;

    public static parseOne(predicate: string): VersionPredicate {
        const predicateList: SingleVersionPredicate[] = [];

        for (let s of predicate.split(" ")) {
            s = s.trim();

            if (s === "" || s === "*") {
                continue;
            }

            let operator = VersionComparisonOperator.EQUAL;

            for (const op of VersionPredicateParser.OPERATORS) {
                if (s.startsWith(op.getSerialized())) {
                    operator = op;
                    s = s.substring(op.getSerialized().length);
                    break;
                }
            }

            let version = VersionParser.parse(s, true);

            if (version instanceof SemanticVersion) {

                if (version.hasWildcard()) { // .x version -> replace with conventional version by replacing the operator
                    if (operator != VersionComparisonOperator.EQUAL) {
                        throw new VersionParsingException("Invalid predicate: "+predicate+", version ranges with wildcards (.X) require using the equality operator or no operator at all!");
                    }

                    assert(!version.getPrereleaseKey());

                    const compCount = version.getVersionComponentCount();
                    assert(compCount == 2 || compCount == 3);

                    operator = compCount == 2 ? VersionComparisonOperator.SAME_TO_NEXT_MAJOR : VersionComparisonOperator.SAME_TO_NEXT_MINOR;

                    const newComponents: number[] = new Array(version.getVersionComponentCount() - 1);

                    for (let i = 0; i < version.getVersionComponentCount() - 1; i++) {
                        newComponents[i] = version.getVersionComponent(i);
                    }

                    version = new SemanticVersionImpl(newComponents, "", version.getBuildKey());
                }
            } else if (!operator.isMinInclusive() && !operator.isMaxInclusive()) { // non-semver without inclusive bound
                throw new VersionParsingException("Invalid predicate: "+predicate+", version ranges need to be semantic version compatible to use operators that exclude the bound!");
            } else { // non-semver with inclusive bound
                operator = VersionComparisonOperator.EQUAL;
            }

            predicateList.push(new SingleVersionPredicate(operator, version));
        }

        if (predicateList.length === 0) {
            return AnyVersionPredicate.INSTANCE;
        } else if (predicateList.length == 1) {
            return predicateList[0];
        } else {
            return new MultiVersionPredicate(predicateList);
        }
    }

    public static parse(predicates: string[]): Set<VersionPredicate> {
        const ret = new Set<VersionPredicate>();

        for (const version of predicates) {
            ret.add(VersionPredicateParser.parseOne(version));
        }

        return ret;
    }

    public static getAny(): VersionPredicate {
        return AnyVersionPredicate.INSTANCE;
    }
}
class AnyVersionPredicate extends VersionPredicate {
    static readonly INSTANCE: VersionPredicate = new AnyVersionPredicate();

    private constructor() {
        super();
    }

    public test(): boolean {
        return true;
    }

    public getTerms(): PredicateTerm[] {
        return [];
    }

    public getInterval(): VersionInterval {
        return VersionIntervalImpl.INFINITE;
    }

    public toString(): string {
        return "*";
    }
}

class SingleVersionPredicate implements VersionPredicate, PredicateTerm {

    constructor(private readonly operator: VersionComparisonOperator, private readonly refVersion: Version) {
    }

    public test(version: Version): boolean {
        return this.operator.test(version, this.refVersion);
    }

    public getTerms(): PredicateTerm[] {
        return [this];
    }

    public getInterval(): VersionInterval {
        if (this.refVersion instanceof SemanticVersion) {
            return new VersionIntervalImpl(this.operator.minVersion(this.refVersion), this.operator.isMinInclusive(),
                this.operator.maxVersion(this.refVersion), this.operator.isMaxInclusive());
        } else {
            return new VersionIntervalImpl(this.refVersion, true, this.refVersion, true);
        }
    }

    public getOperator(): VersionComparisonOperator {
        return this.operator;
    }

    public getReferenceVersion(): Version {
        return this.refVersion;
    }

    public equals(obj: unknown): boolean {
        if (obj instanceof SingleVersionPredicate) {
            return this.operator == obj.operator && this.refVersion.equals(obj.refVersion);
        } else {
            return false;
        }
    }

    public toString(): string {
        return this.operator.getSerialized().concat(this.refVersion.toString());
    }
}

class MultiVersionPredicate extends VersionPredicate {

    constructor(private readonly predicates: SingleVersionPredicate[]) {
        super();
    }

    public test(version: Version): boolean {

        for (const predicate of this.predicates) {
            if (!predicate.test(version)) return false;
        }

        return true;
    }

    public getTerms(): PredicateTerm[] {
        return this.predicates;
    }

    public getInterval(): VersionInterval {
        if (this.predicates.length === 0) return AnyVersionPredicate.INSTANCE.getInterval();

        let ret: VersionInterval = this.predicates[0].getInterval();

        for (let i = 1; i < this.predicates.length; i++) {
            ret = VersionIntervalImpl.andOne(ret!, this.predicates[i].getInterval())!;
        }

        return ret;
    }

    public equals(obj: unknown): boolean {
        if (obj instanceof MultiVersionPredicate) {

            return !this.predicates.map((v, i)=>obj.predicates[i].equals(v)).includes(false);
        } else {
            return false;
        }
    }

    public toString(): string {
        const ret: string[] = [];

        for (const predicate of this.predicates) {
            if (ret.length > 0) ret.push(" ");
            ret.push(predicate.toString());
        }

        return ret.join("");
    }
}
