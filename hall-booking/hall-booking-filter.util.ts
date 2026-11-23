/** Client-side filter helpers for the hall-booking calendar. */

export type HallBookingFilterState = {
	Keyword: string;
	IDBranches: number[];
	Floors: string[];
	HallKinds: string[];
	Statuses: string[];
};

export function emptyHallBookingFilter(): HallBookingFilterState {
	return { Keyword: '', IDBranches: [], Floors: [], HallKinds: [], Statuses: [] };
}

export function isHallBookingFilterActive(f: HallBookingFilterState | null | undefined): boolean {
	if (!f) return false;
	return !!(
		(f.Keyword && f.Keyword.trim()) ||
		(f.IDBranches && f.IDBranches.length) ||
		(f.Floors && f.Floors.length) ||
		(f.HallKinds && f.HallKinds.length) ||
		(f.Statuses && f.Statuses.length)
	);
}

function matchKeyword(row: any, keyword: string): boolean {
	const k = String(keyword || '')
		.trim()
		.toLowerCase();
	if (!k) return true;
	const hay = `${row?.Name || ''} ${row?.Code || ''}`.toLowerCase();
	return hay.includes(k);
}

/** Guest / opportunity text on a booking row. */
export function matchBookingKeyword(booking: any, keyword: string): boolean {
	const k = String(keyword || '')
		.trim()
		.toLowerCase();
	if (!k) return true;
	const hay = `${booking?.OpportunityName || ''} ${booking?.Name || ''} ${booking?.OpportunityCode || ''} ${booking?.Remark || ''} ${booking?.HallName || ''}`.toLowerCase();
	return hay.includes(k);
}

/** Filter top-level halls by catalogue fields. */
export function filterHallRows(halls: any[], filter: HallBookingFilterState): any[] {
	const f = filter || emptyHallBookingFilter();
	const branches = new Set((f.IDBranches || []).map(Number));
	const floors = new Set((f.Floors || []).map((x) => String(x)));
	const kinds = new Set((f.HallKinds || []).map((x) => String(x)));
	return (halls || []).filter((h) => {
		if (!matchKeyword(h, f.Keyword)) return false;
		if (branches.size && !branches.has(Number(h.IDBranch))) return false;
		if (floors.size) {
			const floor = String(h.Floor ?? '').trim();
			if (!floors.has(floor)) return false;
		}
		if (kinds.size && !kinds.has(String(h.HallKind || ''))) return false;
		return true;
	});
}

/** Keep lines whose parent hall remains after hall filtering. */
export function filterLineRows(lines: any[], halls: any[]): any[] {
	const parents = new Set((halls || []).map((h) => Number(h.Id)));
	return (lines || []).filter((l) => parents.has(Number(l.IDParent)));
}

/** Bookings whose hall is in the leaf id set; optional status filter. */
export function filterBookingRows(bookings: any[], leafIds: Set<string> | string[], statuses?: string[]): any[] {
	const ids = leafIds instanceof Set ? leafIds : new Set((leafIds || []).map(String));
	// Empty allow-list = nothing visible. (Old `ids.size &&` kept ALL bookings → FC hang on orphan events.)
	if (!ids.size) return [];
	const st = new Set((statuses || []).map(String));
	return (bookings || []).filter((b) => {
		if (!ids.has(String(b.IDHall))) return false;
		if (st.size && !st.has(String(b.Status || ''))) return false;
		return true;
	});
}

/**
 * Leaf ids used to keep bookings that belong to the visible catalogue.
 * Always include the hall id itself — Bizfly sync / Book API store IDHall on the hall,
 * while the calendar may also show Line children.
 */
export function leafIdsForHalls(halls: any[], lines: any[]): Set<string> {
	const out = new Set<string>();
	const linesByParent = new Map<number, any[]>();
	(lines || []).forEach((l) => {
		const p = Number(l.IDParent);
		if (!linesByParent.has(p)) linesByParent.set(p, []);
		linesByParent.get(p)!.push(l);
	});
	(halls || []).forEach((h) => {
		out.add(String(h.Id));
		const kids = linesByParent.get(Number(h.Id)) || [];
		kids.forEach((l) => out.add(String(l.Id)));
	});
	return out;
}

/**
 * Keyword across hall name/code OR booking guest/opportunity.
 * - Hall name match → keep that hall + its lines + all its bookings.
 * - Guest/booking match only → keep parent hall + only matching bookings (and only lines those
 *   bookings sit on). Keeping every booking on the hall made FullCalendar overlap-pack hang.
 */
export function applyKeywordFilter(
	halls: any[],
	lines: any[],
	bookings: any[],
	keyword: string
): { halls: any[]; lines: any[]; bookings: any[] } {
	const k = String(keyword || '').trim();
	if (!k) return { halls: halls || [], lines: lines || [], bookings: bookings || [] };

	const hallById = new Map((halls || []).map((h) => [Number(h.Id), h]));
	const lineById = new Map((lines || []).map((l) => [Number(l.Id), l]));
	const hallIdForLeaf = (leafId: any): number => {
		const id = Number(leafId);
		if (hallById.has(id)) return id;
		const line = lineById.get(id);
		return line ? Number(line.IDParent) : id;
	};

	const hallsMatchedByName = new Set<number>();
	(halls || []).forEach((h) => {
		if (matchKeyword(h, k)) hallsMatchedByName.add(Number(h.Id));
	});

	const hallsFromBookings = new Set<number>();
	const matchingBookingIds = new Set<number>();
	const leafIdsFromMatchingBookings = new Set<string>();
	(bookings || []).forEach((b) => {
		if (!matchBookingKeyword(b, k)) return;
		hallsFromBookings.add(hallIdForLeaf(b.IDHall));
		matchingBookingIds.add(Number(b.Id));
		leafIdsFromMatchingBookings.add(String(b.IDHall));
	});

	const keptHalls = (halls || []).filter((h) => hallsMatchedByName.has(Number(h.Id)) || hallsFromBookings.has(Number(h.Id)));
	const allLinesOfKept = filterLineRows(lines || [], keptHalls);
	// Guest-only halls: drop empty sibling lines so the tree stays small.
	const keptLines = allLinesOfKept.filter((l) => {
		const parent = Number(l.IDParent);
		if (hallsMatchedByName.has(parent)) return true;
		return leafIdsFromMatchingBookings.has(String(l.Id));
	});
	const leafIds = leafIdsForHalls(keptHalls, keptLines);
	const keptBookings = filterBookingRows(bookings || [], leafIds).filter((b) => {
		const parentHall = hallIdForLeaf(b.IDHall);
		if (hallsMatchedByName.has(parentHall)) return true;
		return matchingBookingIds.has(Number(b.Id));
	});
	return { halls: keptHalls, lines: keptLines, bookings: keptBookings };
}

/**
 * Drop halls/lines with no booking in the current booking set.
 * Hall with lines: keep only booked lines; drop hall if none remain.
 * Hall without lines: keep only if it has a booking.
 */
export function hideUnbookedHallsAndLines(halls: any[], lines: any[], bookings: any[]): { halls: any[]; lines: any[] } {
	const booked = new Set((bookings || []).map((b) => String(b.IDHall)));
	const linesByParent = new Map<number, any[]>();
	(lines || []).forEach((l) => {
		const p = Number(l.IDParent);
		if (!linesByParent.has(p)) linesByParent.set(p, []);
		linesByParent.get(p)!.push(l);
	});

	const keptLines: any[] = [];
	const keptHalls: any[] = [];
	(halls || []).forEach((h) => {
		const kids = linesByParent.get(Number(h.Id)) || [];
		if (!kids.length) {
			if (booked.has(String(h.Id))) keptHalls.push(h);
			return;
		}
		const bookedKids = kids.filter((l) => booked.has(String(l.Id)));
		const hallBooked = booked.has(String(h.Id));
		if (!bookedKids.length && !hallBooked) return;
		keptHalls.push(h);
		keptLines.push(...bookedKids);
	});
	return { halls: keptHalls, lines: keptLines };
}
