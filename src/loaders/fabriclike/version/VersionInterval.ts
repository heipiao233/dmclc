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
import { VersionIntervalImpl } from "./VersionIntervalImpl.js";

/**
 * Representation of a version interval, closed or open.
 *
 * <p>The represented version interval is contiguous between its lower and upper limit, disjoint intervals are built
 * using collections of {@link VersionInterval}. Empty intervals may be represented by {@code null} or any interval
 * @code (x,x)} with x being a non-{@code null} version and both endpoints being exclusive.
 */
export abstract class VersionInterval {
    static INFINITE: VersionInterval = new VersionIntervalImpl(undefined, false, undefined, false);

    /**
     * Get whether the interval uses {@link SemanticVersion} compatible bounds.
     *
     * @return True if both bounds are open (null), {@link SemanticVersion} instances or a combination of both, false otherwise.
     */
    abstract isSemantic(): boolean;

    /**
     * Get the lower limit of the version interval.
     *
     * @return Version's lower limit or null if none, inclusive depending on {@link #isMinInclusive()}
     */
    abstract getMin(): Version | undefined;

    /**
     * Get whether the lower limit of the version interval is inclusive.
     *
     * @return True if inclusive, false otherwise
     */
    abstract isMinInclusive(): boolean;

    /**
     * Get the upper limit of the version interval.
     *
     * @return Version's upper limit or null if none, inclusive depending on {@link #isMaxInclusive()}
     */
    abstract getMax(): Version | undefined;

    /**
     * Get whether the upper limit of the version interval is inclusive.
     *
     * @return True if inclusive, false otherwise
     */
    abstract isMaxInclusive(): boolean;

    and(o: VersionInterval): VersionInterval | undefined {
        return VersionInterval.andOne(this, o);
    }

    or(o: VersionInterval[]): VersionInterval[] {
        return VersionInterval.or(o, this);
    }

    not(): VersionInterval[] {
        return VersionInterval.notOne(this);
    }

    /**
     * Compute the intersection between two version intervals.
     */
    static andOne(a: VersionInterval, b: VersionInterval): VersionInterval | undefined {
        return VersionIntervalImpl.andOne(a, b);
    }

    /**
     * Compute the intersection between two potentially disjoint of version intervals.
     */
    static and(a: VersionInterval[], b: VersionInterval[]): VersionInterval[] | undefined {
        return VersionIntervalImpl.and(a, b);
    }

    /**
     * Compute the union between multiple version intervals.
     */
    static or(a: VersionInterval[], b: VersionInterval): VersionInterval[] {
        return VersionIntervalImpl.or(a, b);
    }

    static notOne(interval: VersionInterval): VersionInterval[] {
        return VersionIntervalImpl.notOne(interval);
    }

    static not(intervals: VersionInterval[]): VersionInterval[] | undefined {
        return VersionIntervalImpl.not(intervals);
    }
    
    abstract equals(obj: unknown): boolean;
}
