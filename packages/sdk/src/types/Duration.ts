import type * as Proto from '../grpc-api/v2/concordium/types.js';

/**
 * Type representing a duration of time down to milliseconds.
 * Can not be negative.
 */
class Duration {
    /** Having a private field prevents similar structured objects to be considered the same type (similar to nominal typing). */
    private __nominal = true;
    constructor(
        /** The internal value for representing a duration in milliseconds. */
        public readonly value: bigint
    ) {}
}

/**
 * Type representing a duration of time down to milliseconds.
 * Can not be negative.
 */
export type Type = Duration;

/**
 * Construct a Duration from a given number of milliseconds.
 * @param {number} value Number of milliseconds
 * @throws If a negative value is provided.
 * @returns {Duration} Duration corresponding to the provided value.
 */
export function fromMillis(value: number | bigint): Duration {
    if (value < 0) {
        throw new Error(
            'Invalid duration: The value cannot be a negative number.'
        );
    }
    return new Duration(BigInt(value));
}

/**
 * Regular expression to match a single measure in the duration string format.
 * Matches the digits and the unit in separate groups.
 */
const stringMeasureRegexp = /^(\d+)(ms|s|m|h|d)$/;

/**
 * Parse a string containing a list of duration measures separated by whitespaces.
 *
 * A measure is a number followed by the unit (no whitespace
 * between is allowed). Every measure is accumulated into a duration. The
 * string is allowed to contain any number of measures with the same unit in no
 * particular order.
 *
 * The supported units are:
 * - `ms` for milliseconds
 * - `s` for seconds
 * - `m` for minutes
 * - `h` for hours
 * - `d` for days
 *
 * # Example
 * The duration of 10 days, 1 hour, 2 minutes and 7 seconds is:
 * ```text
 * "10d 1h 2m 7s"
 * ```
 * @param {string} durationString string representing a duration.
 * @throws The format of the string is not matching the format.
 * @returns {Duration}
 */
export function fromString(durationString: string): Duration {
    let durationInMillis = 0;
    for (const measure of durationString.split(' ')) {
        const result = measure.match(stringMeasureRegexp);
        if (result === null) {
            throw new Error('Invalid duration format');
        }
        const [, valueString, unit] = result;
        const value = parseInt(valueString, 10);
        switch (unit) {
            case 'ms':
                durationInMillis += value;
                break;
            case 's':
                durationInMillis += value * 1000;
                break;
            case 'm':
                durationInMillis += value * 1000 * 60;
                break;
            case 'h':
                durationInMillis += value * 1000 * 60 * 60;
                break;
            case 'd':
                durationInMillis += value * 1000 * 60 * 60 * 24;
                break;
            default:
                throw new Error(
                    `Invalid duration format: Unknown unit '${unit}'.`
                );
        }
    }
    return fromMillis(durationInMillis);
}

/**
 * Get the duration in milliseconds.
 * @param {Duration} duration The duration.
 * @returns {bigint} The duration represented in milliseconds.
 */
export function toMillis(duration: Duration): bigint {
    return duration.value;
}

/** Type used when encoding a duration using a schema. */
export type SchemaValue = string;

/**
 * Get duration in the format used by schemas.
 * @param {Duration} duration The duration.
 * @returns {SchemaValue} The schema value representation.
 */
export function toSchemaValue(duration: Duration): SchemaValue {
    return `${duration.value} ms`;
}

/**
 * Convert duration from format used by schemas.
 * @param {SchemaValue} duration The duration in schema format.
 * @returns {Duration} The duration.
 */
export function fromSchemaValue(duration: SchemaValue): Duration {
    return fromString(duration);
}

/**
 * Convert a duration from its protobuf encoding.
 * @param {Proto.Duration} duration The duration in protobuf.
 * @returns {Duration} The duration.
 */
export function fromProto(duration: Proto.Duration): Duration {
    return fromMillis(duration.value);
}

/**
 * Convert a duration into its protobuf encoding.
 * @param {Duration} duration The duration.
 * @returns {Proto.Duration} The protobuf encoding.
 */
export function toProto(duration: Duration): Proto.Duration {
    return {
        value: duration.value,
    };
}
