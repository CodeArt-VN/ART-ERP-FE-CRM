/** Pure helpers for the hall catalogue (list, detail and line popup). No Angular, no HTTP. */

export const HALL_KINDS = ['Banquet', 'VIP', 'Outdoor', 'Meeting'] as const;
export type HallKind = (typeof HALL_KINDS)[number];

/** Floors that exist in the Adora data (G = ground). The DB column is free text, so the form also accepts others. */
export const HALL_FLOORS = ['G', '1', '2', '3', '5', '6'];

/** Ionic colour tokens and icons of the hall kind chip. */
export const HALL_KIND_COLORS: Record<string, string> = { Banquet: 'primary', VIP: 'warning', Outdoor: 'success', Meeting: 'tertiary' };
export const HALL_KIND_ICONS: Record<string, string> = { Banquet: 'restaurant-outline', VIP: 'diamond-outline', Outdoor: 'sunny-outline', Meeting: 'people-outline' };

export function hallKindColor(kind: string): string {
	return HALL_KIND_COLORS[kind] || 'medium';
}

export function hallKindIcon(kind: string): string {
	return HALL_KIND_ICONS[kind] || 'business-outline';
}

/** The 7 layouts of a hall: DB column and the English translate key of its label. */
export const CAPACITY_FIELDS: { id: string; label: string }[] = [
	{ id: 'CapCircle', label: 'Round table' },
	{ id: 'CapBuffet', label: 'Buffet' },
	{ id: 'CapTheater', label: 'Theater' },
	{ id: 'CapClass', label: 'Classroom' },
	{ id: 'CapSemicircle', label: 'Semicircle' },
	{ id: 'CapLetterU', label: 'U-shape' },
	{ id: 'CapSquare', label: 'Square' },
];

/** Columns holding whole numbers (null when empty). */
export const HALL_INT_FIELDS = ['Sort', 'MinGuests', 'MaxGuests', 'MinTables', 'MaxTables', ...CAPACITY_FIELDS.map((c) => c.id)];
export const HALL_NUMBER_FIELDS = [...HALL_INT_FIELDS, 'AreaSqm'];
/** Numeric columns converted before a save (adds the line number, which has its own validation). */
const PAYLOAD_NUMBER_FIELDS = [...HALL_NUMBER_FIELDS, 'LineNo'];

/** Highest number of lines "quick create" accepts in one go. */
export const MAX_QUICK_LINES = 50;

/** Upper-case ASCII slug: drops accents (Đ -> D), every other run of characters becomes one dash. */
export function slugName(name: string): string {
	return String(name || '')
		.replace(/Đ/g, 'D')
		.replace(/đ/g, 'd')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^A-Za-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.toUpperCase();
}

/** `<BRANCH CODE>-<NAME WITHOUT ACCENTS>`, same shape as the seeded halls (DP1-CRYSTAL). Empty when either part is missing. */
export function suggestHallCode(branchCode: string, name: string): string {
	const b = slugName(branchCode);
	const n = slugName(name);
	return b && n ? `${b}-${n}` : '';
}

/** `<hall code>-L<k>` for line k. */
export function lineCode(hallCode: string, lineNo: number): string {
	return hallCode ? `${hallCode}-L${lineNo}` : '';
}

/** '' / null / undefined -> null, otherwise Number (NaN stays NaN so the validation can see it). */
export function toNumberOrNull(v: any): number | null {
	if (v === '' || v === null || v === undefined) return null;
	if (typeof v === 'number') return v;
	const s = String(v).replace(/,/g, '').trim();
	return s === '' ? null : Number(s);
}

/** Convert the numeric columns of a row (or of the dirty values of the form) in place-safe fashion. */
export function normalizeHallNumbers(row: Record<string, any>): Record<string, any> {
	const out: Record<string, any> = { ...row };
	PAYLOAD_NUMBER_FIELDS.forEach((k) => {
		if (k in out) out[k] = toNumberOrNull(out[k]);
	});
	if ('IDBranch' in out && out.IDBranch !== null && out.IDBranch !== '') out.IDBranch = Number(out.IDBranch);
	return out;
}

function isNegative(v: any): boolean {
	return v !== null && v !== undefined && v !== '' && Number(v) < 0;
}

function isWhole(v: any): boolean {
	return v === null || v === undefined || v === '' || (Number.isFinite(Number(v)) && Number.isInteger(Number(v)));
}

/** Validation of the capacity block, shared by hall and line. Returns English translate keys (empty = ok). */
export function capacityErrors(row: any): string[] {
	const errs: string[] = [];
	const nums = HALL_NUMBER_FIELDS.filter((k) => k !== 'Sort').map((k) => row[k]);
	if (nums.some((v) => v !== null && v !== undefined && v !== '' && !Number.isFinite(Number(v)))) errs.push('Please enter valid numbers');
	else if (nums.some(isNegative)) errs.push('Numbers cannot be negative');
	if (HALL_INT_FIELDS.some((k) => !isWhole(row[k]))) errs.push('Capacity must be whole numbers');
	const min = toNumberOrNull(row.MinGuests);
	const max = toNumberOrNull(row.MaxGuests);
	if (min !== null && max !== null && max < min) errs.push('Max guests must be greater than or equal to min guests');
	const minT = toNumberOrNull(row.MinTables);
	const maxT = toNumberOrNull(row.MaxTables);
	if (minT !== null && maxT !== null && maxT < minT) errs.push('Max tables must be greater than or equal to min tables');
	return errs;
}

/** Validation of a hall row before it is saved. */
export function hallErrors(row: any): string[] {
	const errs: string[] = [];
	if (!row.IDBranch) errs.push('Center is required');
	if (!row.Name || !String(row.Name).trim()) errs.push('Name is required');
	return [...errs, ...capacityErrors(row)];
}

/** Validation of a line row before it is saved. */
export function lineErrors(row: any): string[] {
	const errs: string[] = [];
	const no = toNumberOrNull(row.LineNo);
	if (no === null || !Number.isInteger(no) || no < 1) errs.push('Line number must be a whole number from 1');
	if (!row.Name || !String(row.Name).trim()) errs.push('Name is required');
	return [...errs, ...capacityErrors(row)];
}

/** Largest capacity over the 7 layouts and the layout it belongs to. Falls back to MaxGuests (no layout). Null when nothing is set. */
export function primaryCapacity(row: any): { value: number; label: string | null } | null {
	let best: { value: number; label: string | null } | null = null;
	for (const c of CAPACITY_FIELDS) {
		const v = toNumberOrNull(row?.[c.id]);
		if (v !== null && v > 0 && (best === null || v > best.value)) best = { value: v, label: c.label };
	}
	if (best) return best;
	const g = toNumberOrNull(row?.MaxGuests);
	return g !== null && g > 0 ? { value: g, label: null } : null;
}

/** Line numbers 1..n that a hall does not have yet. */
export function missingLineNos(existing: { LineNo?: number }[], n: number): number[] {
	const have = new Set((existing || []).map((l) => Number(l.LineNo)));
	const out: number[] = [];
	for (let k = 1; k <= n; k++) if (!have.has(k)) out.push(k);
	return out;
}

/** The first free line number (1 when the hall has none). */
export function nextLineNo(existing: { LineNo?: number }[]): number {
	const have = new Set((existing || []).map((l) => Number(l.LineNo)));
	let k = 1;
	while (have.has(k)) k++;
	return k;
}

/** Parse the "how many lines" answer. Returns the count, or null when it is not a whole number in 1..MAX_QUICK_LINES. */
export function parseLineCount(v: any): number | null {
	const n = toNumberOrNull(v);
	return n !== null && Number.isInteger(n) && n >= 1 && n <= MAX_QUICK_LINES ? n : null;
}

/** New line rows for "quick create": LineNo 1..n that are missing, code `<hall code>-L<k>`, name `Line k`, same center, Sort = k. */
export function buildQuickLines(hall: { Id: number; Code?: string; IDBranch: number }, existing: { LineNo?: number }[], n: number): any[] {
	const code = hall.Code || `H${hall.Id}`;
	return missingLineNos(existing, n).map((k) => ({
		Id: 0,
		IDParent: hall.Id,
		IDBranch: hall.IDBranch,
		HallType: 'Line',
		LineNo: k,
		Code: lineCode(code, k),
		Name: `Line ${k}`,
		Sort: k,
	}));
}

/** A blank line of a hall (popup "new line"): next free LineNo, code and name already filled in. */
export function newLine(hall: { Id: number; Code?: string; IDBranch: number }, existing: { LineNo?: number }[]): any {
	const k = nextLineNo(existing);
	const code = hall.Code || `H${hall.Id}`;
	return { Id: 0, IDParent: hall.Id, IDBranch: hall.IDBranch, HallType: 'Line', LineNo: k, Code: lineCode(code, k), Name: `Line ${k}`, Sort: k };
}

/** Strip UI-only fields (leading `_`) and convert numbers before a row is sent to the API. */
export function toLinePayload(row: any): any {
	const body: any = {};
	Object.keys(row).forEach((k) => {
		if (k.charAt(0) !== '_') body[k] = row[k];
	});
	if (!body.Code) delete body.Code;
	delete body.IsDisabled; // the API ignores it on save; enable / disable has its own call
	return normalizeHallNumbers(body);
}

/** Count lines per hall: `{ [hallId]: n }` from a flat list of line rows. */
export function countLines(lines: { IDParent?: number }[]): Record<number, number> {
	const out: Record<number, number> = {};
	(lines || []).forEach((l) => {
		if (l.IDParent) out[l.IDParent] = (out[l.IDParent] || 0) + 1;
	});
	return out;
}

/** Name of the unique rule a failed save most likely broke, from the rows that already exist. Returns an English translate key or ''. */
export function conflictReason(row: any, others: any[]): string {
	const rows = (others || []).filter((o) => o.Id !== row.Id && o.IDBranch === row.IDBranch && !o.IsDeleted);
	const eq = (a: any, b: any) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
	if (row.Code && rows.some((o) => eq(o.Code, row.Code))) return 'A hall with this code already exists in this center';
	if (row.HallType !== 'Line' && rows.some((o) => o.HallType !== 'Line' && eq(o.Name, row.Name))) return 'A hall with this name already exists in this center';
	if (row.HallType === 'Line' && rows.some((o) => o.IDParent === row.IDParent && Number(o.LineNo) === Number(row.LineNo))) return 'This line number already exists in this hall';
	return '';
}

/** Generic message when no reason is found: the API only answers 404 / 409 for a constraint failure. */
export const SAVE_FAILED_KEY = 'Cannot save: the code, name, line number or center conflicts with existing data';

/**
 * The center a new hall starts in: the selected branch when it is one of the options, otherwise the only option
 * inside the selected branch's subtree, otherwise null (the user picks).
 */
export function defaultCenter(options: { Id: number }[], selectedId: any, subtreeIds: any[] | null): number | null {
	const list = options || [];
	const hit = list.find((o) => o.Id == selectedId);
	if (hit) return hit.Id;
	const inside = list.filter((o) => (subtreeIds || []).some((id) => id == o.Id));
	return inside.length === 1 ? inside[0].Id : null;
}

/** Centers a hall can belong to: branches coded DP1, DP2, ... When none match (another tenant) every branch is offered. */
export function centerOptions(branches: any[]): any[] {
	const all = (branches || []).filter((b) => b && b.Type !== 'TitlePosition');
	const dp = all.filter((b) => /^DP\d+$/i.test(String(b.Code || '').trim()));
	return (dp.length ? dp : all).map((b) => ({ Id: b.Id, Code: b.Code, Name: b.Name, disabled: !!b.disabled }));
}

/**
 * Divider text for the hall list: the center's name on the first hall of each center, `null` on the others.
 * Computed over the whole loaded array, so a page appended by infinite scroll continues the last group instead of repeating its divider.
 */
export function centerDivider(item: any, index: number, items: any[], branches: any[]): string | null {
	if (!item?.IDBranch) return null;
	if (index > 0 && items[index - 1]?.IDBranch === item.IDBranch) return null;
	const center = (branches || []).find((b) => b?.Id === item.IDBranch);
	return center?.Name || null;
}

/**
 * Second-level divider: the floor label on the first hall of each floor inside a center ("Floor 1"), `null` on the others.
 * It also fires when the center changes, so a center divider is always followed by its first floor divider.
 * A hall without a floor gets "—" so it is not mixed into the floor above it.
 */
export function floorDivider(item: any, index: number, items: any[], floorWord: string): string | null {
	if (!item) return null;
	const floor = String(item.Floor ?? '').trim();
	if (index > 0) {
		const prev = items[index - 1];
		if (prev?.IDBranch === item.IDBranch && String(prev?.Floor ?? '').trim() === floor) return null;
	}
	return floor ? `${floorWord || 'Floor'} ${floor}` : '—';
}

/**
 * Text to show after a failed save. The API answers 404 / 409 without a reason, so look at the rows of the same center
 * (`readRows` returns them) and name the unique rule that is broken; fall back to the generic key when nothing matches.
 */
export async function explainSaveFailure(readRows: (query: any) => Promise<any[]>, row: any): Promise<string> {
	try {
		const rows = await readRows({ IDBranch: row.IDBranch, IsDisabled: 'skipped', Take: 5000 });
		return conflictReason(row, rows) || SAVE_FAILED_KEY;
	} catch {
		return SAVE_FAILED_KEY;
	}
}
