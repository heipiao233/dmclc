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
import { SemanticVersion } from "./SemanticVersion";
import { Version } from "./Version";
import { VersionInterval } from "./VersionInterval";

export class VersionIntervalImpl extends VersionInterval {
    static INFINITE: VersionInterval = new VersionIntervalImpl(undefined, false, undefined, false);
    private readonly min?: Version;
    private readonly minInclusive: boolean;
    private readonly max?: Version;
    private readonly maxInclusive: boolean;

    constructor(min: Version | undefined, minInclusive: boolean,
        max: Version | undefined, maxInclusive: boolean) {
        super();
        this.min = min;
        this.minInclusive = min != undefined ? minInclusive : false;
        this.max = max;
        this.maxInclusive = max != undefined ? maxInclusive : false;

        assert(min != undefined || !minInclusive);
        assert(max != undefined || !maxInclusive);
        assert(min == undefined || min instanceof SemanticVersion || minInclusive);
        assert(max == undefined || max instanceof SemanticVersion || maxInclusive);
        assert(min == undefined || max == undefined || min instanceof SemanticVersion && max instanceof SemanticVersion || min.equals(max));
    }

    isSemantic(): boolean {
        return (this.min == undefined || this.min instanceof SemanticVersion)
				&& (this.max == undefined || this.max instanceof SemanticVersion);
    }

    getMin(): Version | undefined {
        return this.min;
    }

    isMinInclusive(): boolean {
        return this.minInclusive;
    }

    getMax(): Version | undefined {
        return this.max;
    }

    isMaxInclusive(): boolean {
        return this.maxInclusive;
    }

    equals(obj: unknown): boolean {
        if (obj instanceof VersionInterval) {

            return (this.min?.equals(obj.getMin()) && this.minInclusive === obj.isMinInclusive()
					&& this.max?.equals(obj.getMax()) && this.maxInclusive === obj.isMaxInclusive()) ? true : false;
        } else {
            return false;
        }
    }

    toString(): string {
        if (this.min == undefined) {
            if (this.max == undefined) {
                return "(-∞,∞)";
            } else {
                return "(-∞," + this.max + this.maxInclusive ? "]" : ")";
            }
        } else if (this.max == undefined) {
            return "%c%s" + this.minInclusive ? "[" : "(" + this.min + ",∞)";
        } else {
            return this.minInclusive ? "[" : "(" + this.min + "," + this.max + this.maxInclusive ? "]" : ")";
        }
    }

    static andOne(a: VersionInterval, b: VersionInterval): VersionInterval | undefined {
        if (a == undefined || b == undefined) return undefined;

        if (!a.isSemantic() || !b.isSemantic()) {
            return this.andPlain(a, b);
        } else {
            return this.andSemantic(a, b);
        }
    }

    private static andPlain(a: VersionInterval, b: VersionInterval): VersionInterval | undefined {
        const aMin = a.getMin();
        const aMax = a.getMax();
        const bMin = b.getMin();
        const bMax = b.getMax();

        if (aMin != undefined) { // -> min must be aMin or invalid
            if (bMin != undefined && !aMin.equals(bMin) || bMax != undefined && !aMin.equals(bMax)) {
                return undefined;
            }

            if (aMax != undefined || bMax == undefined) {
                assert(aMax?.equals(bMax) || bMax == undefined);
                return a;
            } else {
                return new VersionIntervalImpl(aMin, true, bMax, b.isMaxInclusive());
            }
        } else if (aMax != undefined) { // -> min must be bMin, max must be aMax or invalid
            if (bMin != undefined && !aMax.equals(bMin) || bMax != undefined && !aMax.equals(bMax)) {
                return undefined;
            }

            if (bMin == undefined) {
                return a;
            } else if (bMax != undefined) {
                return b;
            } else {
                return new VersionIntervalImpl(bMin, true, aMax, true);
            }
        } else {
            return b;
        }
    }

    private static andSemantic(a: VersionInterval, b: VersionInterval): VersionInterval | undefined {
        const minCmp = VersionIntervalImpl.compareMin(a, b);
        const maxCmp = VersionIntervalImpl.compareMax(a, b);

        if (minCmp == 0) { // aMin == bMin
            if (maxCmp == 0) { // aMax == bMax -> a == b -> a/b
                return a;
            } else { // aMax != bMax -> a/b..min(a,b)
                return maxCmp < 0 ? a : b;
            }
        } else if (maxCmp == 0) { // aMax == bMax, aMin != bMin -> max(a,b)..a/b
            return minCmp < 0 ? b : a;
        } else if (minCmp < 0) { // aMin < bMin, aMax != bMax -> b..min(a,b)
            if (maxCmp > 0) return b; // a > b -> b

            const aMax: SemanticVersion = <SemanticVersion> a.getMax();
            const bMin: SemanticVersion = <SemanticVersion> b.getMin();
            const cmp = bMin.compareTo(<Version> aMax);

            if (cmp < 0 || cmp == 0 && b.isMinInclusive() && a.isMaxInclusive()) {
                return new VersionIntervalImpl(bMin, b.isMinInclusive(), aMax, a.isMaxInclusive());
            } else {
                return undefined;
            }
        } else { // aMin > bMin, aMax != bMax -> a..min(a,b)
            if (maxCmp < 0) return a; // a < b -> a

            const aMin = <SemanticVersion> a.getMin();
            const bMax = <SemanticVersion> b.getMax();
            const cmp = aMin.compareTo(<Version> bMax);

            if (cmp < 0 || cmp == 0 && a.isMinInclusive() && b.isMaxInclusive()) {
                return new VersionIntervalImpl(aMin, a.isMinInclusive(), bMax, b.isMaxInclusive());
            } else {
                return undefined;
            }
        }
    }

    public static and(a: VersionInterval[], b: VersionInterval[]): VersionInterval[] {
        if (a.length === 0 || b.length === 0) return [];

        if (a.length == 1 && b.length == 1) {
            const merged = VersionIntervalImpl.andOne(a[0], b[0]);
            return merged != undefined ? [merged] : [];
        }

        // (a0 || a1 || a2) && (b0 || b1 || b2) == a0 && b0 && b1 && b2 || a1 && b0 && b1 && b2 || a2 && b0 && b1 && b2

        const allMerged: VersionInterval[] = [];

        for (const intervalA of a) {
            for (const intervalB of b) {
                const merged = VersionIntervalImpl.andOne(intervalA, intervalB);
                if (merged != undefined) allMerged.push(merged);
            }
        }

        if (allMerged.length === 0) return [];
        if (allMerged.length == 1) return allMerged;

        const ret: VersionInterval[] = new Array(allMerged.length);

        for (const v of allMerged) {
            VersionIntervalImpl.merge(v, ret);
        }

        return ret;
    }

    public static or(a: VersionInterval[], b: VersionInterval): VersionInterval[] {
        if (a.length === 0) {
            if (b == undefined) {
                return [];
            } else {
                return [b];
            }
        }

        const ret: VersionInterval[] = new Array(a.length + 1);

        for (const v of a) {
            VersionIntervalImpl.merge(v, ret);
        }

        VersionIntervalImpl.merge(b, ret);

        return ret;
    }

    private static merge(a: VersionInterval, out: VersionInterval[]) {
        if (a == undefined) return;

        if (out.length === 0) {
            out.push(a);
            return;
        }

        if (out.length == 1) {
            const e = out[0];

            if (e.getMin() == undefined && e.getMax() == undefined) {
                return;
            }
        }

        if (!a.isSemantic()) {
            VersionIntervalImpl.mergePlain(a, out);
        } else {
            VersionIntervalImpl.mergeSemantic(a, out);
        }
    }

    private static mergePlain(a: VersionInterval, out: VersionInterval[]) {
        const aMin = a.getMin();
        const aMax = a.getMax();
        const v = aMin != undefined ? aMin : aMax;
        assert(v != undefined);

        for (let i = 0; i < out.length; i++) {
            const c = out[i];

            if (v.equals(c.getMin())) {
                if (aMin == undefined) {
                    assert(aMax?.equals(c.getMin()));
                    out.length = 0;
                    out.push(VersionIntervalImpl.INFINITE);
                } else if (aMax == undefined && c.getMax() != undefined) {
                    out[i] = a;
                }

                return;
            } else if (v.equals(c.getMax())) {
                assert(c.getMin() == undefined);

                if (aMax == undefined) {
                    assert(aMin?.equals(c.getMax()));
                    out.length = 0;
                    out.push(VersionIntervalImpl.INFINITE);
                }

                return;
            }
        }

        out.push(a);
    }

    private static mergeSemantic(a: VersionInterval, out: VersionInterval[]) {
        const aMin = <SemanticVersion> a.getMin();
        const aMax = <SemanticVersion> a.getMax();

        if (aMin == undefined && aMax == undefined) {
            out.length = 0;
            out.push(VersionIntervalImpl.INFINITE);
            return;
        }

        for (let i = 0; i < out.length; i++) {
            const c: VersionInterval = out[i];
            if (!c.isSemantic()) continue;

            const cMin = <SemanticVersion> c.getMin();
            const cMax = <SemanticVersion> c.getMax();
            let cmp: number;

            if (aMin == undefined) { // ..a..]
                if (cMax == undefined) { // ..a..] [..c..
                    cmp = aMax.compareTo(cMin);

                    if (cmp < 0 || cmp == 0 && !a.isMaxInclusive() && !c.isMinInclusive()) { // ..a..]..[..c.. or ..a..)(..c..
                        out.splice(i, 0, a);
                    } else { // ..a..|..c.. or ..a.[..].c..
                        out.length = 0;
                        out.push(VersionIntervalImpl.INFINITE);
                    }

                    return;
                } else { // ..a..] [..c..]
                    cmp = VersionIntervalImpl.compareMax(a, c);

                    if (cmp >= 0) { // a encompasses c
                        out.splice(i, 1);
                        i--;
                    } else if (cMin == undefined) { // c encompasses a
                        return;
                    } else { // aMax < cMax
                        cmp = aMax.compareTo(cMin);

                        if (cmp < 0 || cmp == 0 && !a.isMaxInclusive() && !c.isMinInclusive()) { // ..a..]..[..c..] or ..a..)(..c..]
                            out.splice(i, 0, a);
                        } else { // c extends a to the right
                            out[i] = new VersionIntervalImpl(undefined, false, cMax, c.isMaxInclusive());
                        }

                        return;
                    }
                }
            } else if (cMax == undefined) { // [..c..
                cmp = VersionIntervalImpl.compareMin(a, c);

                if (cmp >= 0) { // c encompasses a
                    // no-op
                } else if (aMax == undefined) { // a encompasses c
                    while (out.length > i) out.splice(i, 1);
                    out.push(a);
                } else { // aMin < cMin
                    cmp = aMax.compareTo(cMin);

                    if (cmp < 0 || cmp == 0 && !a.isMaxInclusive() && !c.isMinInclusive()) { // [..a..]..[..c.. or [..a..)(..c..
                        out.splice(i, 0, a);
                    } else { // a extends c to the left
                        out[i] = new VersionIntervalImpl(aMin, a.isMinInclusive(), undefined, false);
                    }
                }

                return;
            } else if ((cmp = aMin.compareTo(cMax)) < 0 || cmp == 0 && (a.isMinInclusive() || c.isMaxInclusive())) {
                let cmp2: number;

                if (aMax == undefined || cMin == undefined || (cmp2 = aMax.compareTo(cMin)) > 0 || cmp2 == 0 && (a.isMaxInclusive() || c.isMinInclusive())) {
                    const cmpMin = VersionIntervalImpl.compareMin(a, c);
                    const cmpMax = VersionIntervalImpl.compareMax(a, c);

                    if (cmpMax <= 0) { // aMax <= cMax
                        if (cmpMin < 0) { // aMin < cMin
                            out[i] = new VersionIntervalImpl(aMin, a.isMinInclusive(), cMax, c.isMaxInclusive());
                        }

                        return;
                    } else if (cmpMin > 0) { // aMin > cMin, aMax > cMax
                        a = new VersionIntervalImpl(cMin, c.isMinInclusive(), aMax, a.isMaxInclusive());
                    }

                    out.splice(i, 1);
                    i--;
                } else {
                    out.splice(i, 0, a);
                    return;
                }
            }
        }

        out.push(a);
    }

    private static compareMin(a: VersionInterval, b: VersionInterval): number {
        const aMin = <SemanticVersion> a.getMin();
        const bMin = <SemanticVersion> b.getMin();
        let cmp;

        if (aMin == undefined) { // a <= b
            if (bMin == undefined) { // a == b == -inf
                return 0;
            } else { // bMin != undefined -> a < b
                return -1;
            }
        } else if (bMin == undefined || (cmp = aMin.compareTo(bMin)) > 0 || cmp == 0 && !a.isMinInclusive() && b.isMinInclusive()) { // a > b
            return 1;
        } else if (cmp < 0 || a.isMinInclusive() && !b.isMinInclusive()) { // a < b
            return -1;
        } else { // cmp == 0 && a.minInclusive() == b.minInclusive() -> a == b
            return 0;
        }
    }

    private static compareMax(a: VersionInterval, b: VersionInterval): number {
        const aMax = <SemanticVersion> a.getMax();
        const bMax = <SemanticVersion> b.getMax();
        let cmp: number;

        if (aMax == undefined) { // a >= b
            if (bMax == undefined) { // a == b == inf
                return 0;
            } else { // bMax != undefined -> a > b
                return 1;
            }
        } else if (bMax == undefined || (cmp = aMax.compareTo(bMax)) < 0 || cmp == 0 && !a.isMaxInclusive() && b.isMaxInclusive()) { // a < b
            return -1;
        } else if (cmp > 0 || a.isMaxInclusive() && !b.isMaxInclusive()) { // a > b
            return 1;
        } else { // cmp == 0 && a.maxInclusive() == b.maxInclusive() -> a == b
            return 0;
        }
    }

    public static notOne(interval: VersionInterval): VersionInterval[] {
        if (interval == undefined) { // () = empty interval -> infinite
            return [VersionIntervalImpl.INFINITE];
        } else if (interval.getMin() == undefined) { // (-∞, = at least half-open towards min
            if (interval.getMax() == undefined) { // (-∞,∞) = infinite -> empty
                return [];
            } else { // (-∞,x = left open towards min -> half open towards max
                return [new VersionIntervalImpl(interval.getMax(), !interval.isMaxInclusive(), undefined, false)];
            }
        } else if (interval.getMax() == undefined) { // x,∞) = half open towards max -> half open towards min
            return [new VersionIntervalImpl(undefined, false, interval.getMin(), !interval.isMinInclusive())];
        } else if (interval.getMin()?.equals(interval.getMax()) && !interval.isMinInclusive() && !interval.isMaxInclusive()) { // (x,x) = effectively empty interval -> infinite
            return [VersionIntervalImpl.INFINITE];
        } else { // closed interval -> 2 half open intervals on each side
            const ret = new Array(2);
            ret.push(new VersionIntervalImpl(undefined, false, interval.getMin(), !interval.isMinInclusive()));
            ret.push(new VersionIntervalImpl(interval.getMax(), !interval.isMaxInclusive(), undefined, false));

            return ret;
        }
    }

    public static not(intervals: VersionInterval[]): VersionInterval[] | undefined {
        if (intervals.length === 0) return [VersionIntervalImpl.INFINITE];
        if (intervals.length == 1) return this.notOne(intervals[0]);

        // !(i0 || i1 || i2) == !i0 && !i1 && !i2

        let ret: VersionInterval[] | undefined = undefined;

        for (const v of intervals) {
            const inverted = this.notOne(v);

            if (!ret) {
                ret = inverted;
            } else {
                ret = this.and(ret, inverted);
            }

            if (ret.length === 0) break;
        }

        return ret;
    }
}
