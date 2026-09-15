// Shape validation for data clients write into a session. Sessions store items/guests
// as untyped arrays, so this is the only thing standing between a malformed socket
// payload and every client in the session rendering it.

export const MAX_ITEMS = 500;
export const MAX_GUESTS = 100;
export const MAX_QUANTITY = 99;
export const MAX_ITEM_NAME = 200;
export const MAX_GUEST_NAME = 50;
const MAX_ID = 100;
const MAX_AMOUNT = 1_000_000;
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

export class ValidationError extends Error {}

const fail = (message) => {
    throw new ValidationError(message);
};

export const isId = (value) => typeof value === 'string' && value.length > 0 && value.length <= MAX_ID;

const isAmount = (value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_AMOUNT;

const cleanName = (value, maxLength) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
};

// Accepts both the current per-unit format (string[][]) and the legacy flat string[],
// padding/truncating to `quantity` units and dropping IDs of guests that no longer exist.
export function normalizeAssignedTo(assignedTo, quantity, guestIds) {
    let units = Array.isArray(assignedTo) ? assignedTo : [];
    if (units.length > 0 && units.every((unit) => typeof unit === 'string')) {
        units = [units];
    }
    return Array.from({ length: quantity }, (_, i) => {
        const unit = units[i];
        if (unit === undefined || unit === null) return [];
        if (!Array.isArray(unit)) fail('Invalid item assignments');
        return [...new Set(unit.filter((guestId) => guestIds.has(guestId)))];
    });
}

export function validateGuests(guests) {
    if (!Array.isArray(guests) || guests.length > MAX_GUESTS) fail(`Guests must be a list of at most ${MAX_GUESTS}`);
    const seen = new Set();
    return guests.map((guest) => {
        if (!guest || typeof guest !== 'object') fail('Invalid guest');
        const { id, color } = guest;
        const name = cleanName(guest.name, MAX_GUEST_NAME);
        const paidAmount = guest.paidAmount ?? 0;
        if (!isId(id) || seen.has(id)) fail('Invalid or duplicate guest ID');
        if (!name) fail(`Guest names must be 1-${MAX_GUEST_NAME} characters`);
        if (typeof color !== 'string' || !HEX_COLOR.test(color)) fail('Invalid guest color');
        if (!isAmount(paidAmount)) fail('Invalid paid amount');
        seen.add(id);
        return { id, name, color, paidAmount };
    });
}

export function validateItems(items, guestIds) {
    if (!Array.isArray(items) || items.length > MAX_ITEMS) fail(`Items must be a list of at most ${MAX_ITEMS}`);
    const seen = new Set();
    return items.map((item) => {
        if (!item || typeof item !== 'object') fail('Invalid item');
        const { id, price, quantity } = item;
        const name = cleanName(item.name, MAX_ITEM_NAME);
        if (!isId(id) || seen.has(id)) fail('Invalid or duplicate item ID');
        if (!name) fail(`Item names must be 1-${MAX_ITEM_NAME} characters`);
        if (!isAmount(price)) fail('Invalid item price');
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
            fail(`Item quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
        }
        seen.add(id);
        return { id, name, price, quantity, assignedTo: normalizeAssignedTo(item.assignedTo, quantity, guestIds) };
    });
}

const CHARGE_MODES = ['percent', 'amount'];

// Tax/tip is either a percentage (0-100) or a dollar amount, depending on its mode.
// A mode change without a new value re-checks the current value under the new mode.
const validateCharge = (data, session, key, label, update) => {
    const modeKey = `${key}Mode`;
    if (data[modeKey] !== undefined) {
        if (!CHARGE_MODES.includes(data[modeKey])) fail(`Invalid ${label.toLowerCase()} mode`);
        update[modeKey] = data[modeKey];
    }
    if (data[key] === undefined && update[modeKey] === undefined) return;

    const mode = update[modeKey] ?? session[modeKey] ?? 'percent';
    const value = data[key] ?? session[key] ?? 0;
    const max = mode === 'percent' ? 100 : MAX_AMOUNT;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
        fail(mode === 'percent' ? `${label} must be between 0% and 100%` : `${label} must be a dollar amount of 0 or more`);
    }
    update[key] = value;
};

// Validates an admin `update-session` payload against the session's current state.
// Returns only the fields being changed.
export function validateSessionUpdate(data, session) {
    if (!data || typeof data !== 'object') fail('Invalid update');
    const update = {};
    if (data.guests !== undefined) update.guests = validateGuests(data.guests);
    if (data.items !== undefined) {
        const guests = update.guests ?? session.guests ?? [];
        update.items = validateItems(data.items, new Set(guests.map((guest) => guest.id)));
    }
    validateCharge(data, session, 'tax', 'Tax', update);
    validateCharge(data, session, 'tip', 'Tip', update);
    return update;
}

// Best-effort cleanup of the receipt parser's output: keep only well-formed items
// rather than rejecting the whole receipt over one bad line.
export function sanitizeParsedItems(parsed) {
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_ITEMS).flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const name = typeof item.name === 'string' ? item.name.trim().slice(0, MAX_ITEM_NAME) : '';
        const price = Number(item.price);
        const quantity = Number.isInteger(item.quantity) ? Math.min(Math.max(item.quantity, 1), MAX_QUANTITY) : 1;
        if (!name || !isAmount(price)) return [];
        return [{ name, price, quantity }];
    });
}
