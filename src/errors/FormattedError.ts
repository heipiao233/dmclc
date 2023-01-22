/**
 * @public
 */
export class FormattedError extends Error {
    constructor(message: string | undefined | null) {
        super(message ?? undefined);
    }
}