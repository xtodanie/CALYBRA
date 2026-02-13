"use strict";
/**
 * Rounding helpers
 * Pure functions. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankersRound = bankersRound;
function bankersRound(value) {
    const floor = Math.floor(value);
    const decimal = value - floor;
    if (decimal < 0.5)
        return floor;
    if (decimal > 0.5)
        return floor + 1;
    return floor % 2 === 0 ? floor : floor + 1;
}
//# sourceMappingURL=rounding.js.map