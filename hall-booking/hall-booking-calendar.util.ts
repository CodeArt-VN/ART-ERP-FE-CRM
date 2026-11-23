/** Map hall / booking rows → FullCalendar nested resources (Branch → Floor → Hall → Line). */

export type HallResourceNodeType = 'branch' | 'floor' | 'hall' | 'hall-group' | 'line';
export type HallSlotUnit = 'day' | 'hour';

/** Day/hour subtotal grid: only the hour Day view uses hour slots; Week/Month use day columns. */
export function hallCalendarSlotUnit(viewType: string | null | undefined): HallSlotUnit {
	return viewType === 'resourceTimelineDay' ? 'hour' : 'day';
}

export function bookingStatusEventColor(status: string, getCss: (name: string) => string): { bg: string; text: string } {
	const s = String(status || '');
	if (s === 'Confirmed') {
		return { bg: getCss('--ion-color-danger') || '#eb445a', text: getCss('--ion-color-danger-contrast') || '#fff' };
	}
	if (s === 'Hold') {
		return { bg: getCss('--ion-color-warning') || '#ffc409', text: getCss('--ion-color-warning-contrast') || '#000' };
	}
	return { bg: getCss('--ion-color-medium') || '#92949c', text: getCss('--ion-color-medium-contrast') || '#fff' };
}

/**
 * FullCalendar resource id for a booking.
 * Halls with Line children use `hall:{id}` as the group row; bookings from sync/Book sit on the hall id.
 */
export function bookingResourceId(booking: any, hallIdsWithLines?: Set<number> | number[]): string {
	const hid = Number(booking?.IDHall);
	const withLines =
		hallIdsWithLines instanceof Set ? hallIdsWithLines : new Set((hallIdsWithLines || []).map(Number).filter((n) => Number.isFinite(n) && n > 0));
	if (Number.isFinite(hid) && withLines.has(hid)) return `hall:${hid}`;
	return String(booking?.IDHall ?? '');
}

export function bookingToEvent(booking: any, getCss: (name: string) => string, hallIdsWithLines?: Set<number> | number[]): any {
	const colors = bookingStatusEventColor(booking?.Status, getCss);
	return {
		id: String(booking.Id),
		resourceId: bookingResourceId(booking, hallIdsWithLines),
		title: booking.OpportunityName || booking.Name || booking.Status || '',
		start: booking.DateTimeFrom,
		end: booking.DateTimeTo,
		backgroundColor: colors.bg,
		borderColor: colors.bg,
		textColor: colors.text,
		extendedProps: { booking },
	};
}

export function eventsFromBookings(bookings: any[], getCss: (name: string) => string, hallIdsWithLines?: Set<number> | number[]): any[] {
	return (bookings || []).map((b) => bookingToEvent(b, getCss, hallIdsWithLines));
}

/** Mark the deep-linked booking (or all bookings of an opportunity) so the calendar can highlight it. */
export function applyHallEventFocus(
	events: any[],
	focus?: { bookingId?: number | null; opportunityId?: number | null }
): any[] {
	const bid = Number(focus?.bookingId);
	const oid = Number(focus?.opportunityId);
	const hasBid = Number.isFinite(bid) && bid > 0;
	const hasOid = Number.isFinite(oid) && oid > 0;
	if (!hasBid && !hasOid) return events || [];
	return (events || []).map((ev) => {
		if (ev?.extendedProps?.isSubtotal) return ev;
		const b = ev?.extendedProps?.booking || {};
		const match = hasBid ? Number(b.Id) === bid : Number(b.IDOpportunity) === oid;
		if (!match) return ev;
		const classNames = [...(Array.isArray(ev.classNames) ? ev.classNames : ev.classNames ? [ev.classNames] : []), 'hall-event-focus'];
		return {
			...ev,
			classNames,
			extendedProps: { ...(ev.extendedProps || {}), isFocus: true },
		};
	});
}

/** Hall ids that have at least one Line child — used to map booking.IDHall → `hall:{id}`. */
export function hallIdsWithLinesFrom(halls: any[], lines: any[]): Set<number> {
	const parents = new Set((lines || []).map((l) => Number(l.IDParent)).filter((n) => Number.isFinite(n) && n > 0));
	const out = new Set<number>();
	(halls || []).forEach((h) => {
		const id = Number(h.Id);
		if (parents.has(id)) out.add(id);
	});
	return out;
}

/** Inclusive calendar-day span. */
export function dayCountInclusive(from: Date | string, to: Date | string): number {
	const a = new Date(from);
	const b = new Date(to);
	const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
	const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
	return Math.max(1, Math.round((utcB - utcA) / 86400000) + 1);
}

/** Left "Tổng" column: count for one hall/line in the visible range. Empty when 0 (do not show). */
export function formatHallCount(bookingCount: number): string {
	const n = Math.max(0, bookingCount | 0);
	return n > 0 ? String(n) : '';
}

export function isBookableLeaf(resource: any): boolean {
	const t = resource?.extendedProps?.nodeType ?? resource?.nodeType;
	return t === 'hall' || t === 'line';
}

export function isGroupSubtotalRow(resource: any): boolean {
	const t = resource?.extendedProps?.nodeType ?? resource?.nodeType;
	return t === 'branch' || t === 'floor';
}

function floorSortKey(floor: string): string {
	const f = String(floor || '').trim() || '_';
	if (f === 'G' || f === 'g') return '0';
	const n = Number(f);
	if (Number.isFinite(n)) return String(n).padStart(4, '0');
	return `9_${f}`;
}

function countOnLeaves(bookings: any[], leafIds: Set<string>): number {
	return (bookings || []).filter((b) => leafIds.has(String(b.IDHall))).length;
}

function leafResource(row: any, nodeType: 'hall' | 'line', bookings: any[]): any {
	const id = String(row.Id ?? row.IDHall);
	const leafIds = new Set([id]);
	const bookingCount = countOnLeaves(bookings, leafIds);
	return {
		id,
		title: row.Name || '',
		Name: row.Name || '',
		nodeType,
		hallUnits: 1,
		leafIds: [id],
		bookingCount,
		Subtotal: formatHallCount(bookingCount),
		IDBranch: row.IDBranch,
		IDHall: Number(row.Id ?? row.IDHall),
		Floor: row.Floor || '',
		HallKind: row.HallKind || '',
		LineNo: row.LineNo,
	};
}

function hallNode(hall: any, lines: any[], bookings: any[]): any {
	const kids = (lines || [])
		.filter((l) => Number(l.IDParent) === Number(hall.Id))
		.sort((a, b) => (Number(a.LineNo) || 0) - (Number(b.LineNo) || 0) || String(a.Name || '').localeCompare(String(b.Name || '')))
		.map((l) => leafResource(l, 'line', bookings));

	if (!kids.length) {
		return leafResource(hall, 'hall', bookings);
	}

	const leafIds = new Set<string>();
	// Include hall id: sync/Book store bookings on the hall even when lines exist.
	leafIds.add(String(hall.Id));
	kids.forEach((c) => (c.leafIds || []).forEach((id: string) => leafIds.add(id)));
	const bookingCount = countOnLeaves(bookings, leafIds);
	return {
		id: `hall:${hall.Id}`,
		title: hall.Name || '',
		Name: hall.Name || '',
		nodeType: 'hall-group' as HallResourceNodeType,
		hallUnits: 1,
		leafIds: [...leafIds],
		bookingCount,
		// Left Tổng = all bookings under this hall (hall id + lines).
		Subtotal: formatHallCount(bookingCount),
		IDBranch: hall.IDBranch,
		IDHall: Number(hall.Id),
		Floor: hall.Floor || '',
		HallKind: hall.HallKind || '',
		children: kids,
	};
}

/**
 * Nested FullCalendar resources: Branch → Floor → Hall → Line.
 * Left Subtotal = booking count in the loaded range (branch / floor / hall-group / leaf); blank when 0.
 * Branch/floor also keep timeline slot counts.
 */
export function buildHallResourceTree(opts: {
	halls: any[];
	lines?: any[];
	branches: { Id: number; Name?: string }[];
	bookings?: any[];
	floorLabel?: (floor: string) => string;
}): any[] {
	const halls = opts.halls || [];
	const lines = opts.lines || [];
	const bookings = opts.bookings || [];
	const floorLabel = opts.floorLabel || ((f) => (f ? `Floor ${f}` : 'Floor'));
	const branchName = new Map((opts.branches || []).map((b) => [Number(b.Id), b.Name || String(b.Id)]));

	const byBranch = new Map<number, any[]>();
	halls.forEach((h) => {
		const bid = Number(h.IDBranch);
		if (!byBranch.has(bid)) byBranch.set(bid, []);
		byBranch.get(bid)!.push(h);
	});

	const branchIds = [...byBranch.keys()].sort((a, b) => String(branchName.get(a) || a).localeCompare(String(branchName.get(b) || b)));

	return branchIds.map((bid) => {
		const branchHalls = byBranch.get(bid) || [];
		const byFloor = new Map<string, any[]>();
		branchHalls.forEach((h) => {
			const f = String(h.Floor ?? '').trim() || '_';
			if (!byFloor.has(f)) byFloor.set(f, []);
			byFloor.get(f)!.push(h);
		});
		const floors = [...byFloor.keys()].sort((a, b) => floorSortKey(a).localeCompare(floorSortKey(b)));

		const floorNodes = floors.map((f) => {
			const floorHalls = (byFloor.get(f) || []).sort((a, b) => (Number(a.Sort) || 0) - (Number(b.Sort) || 0) || String(a.Name || '').localeCompare(String(b.Name || '')));
			const children = floorHalls.map((h) => hallNode(h, lines, bookings));
			const leafIds = new Set<string>();
			let hallUnits = 0;
			children.forEach((c) => {
				hallUnits += c.hallUnits || 0;
				(c.leafIds || []).forEach((id: string) => leafIds.add(id));
			});
			const bookingCount = countOnLeaves(bookings, leafIds);
			const label = f === '_' ? floorLabel('') : floorLabel(f);
			return {
				id: `floor:${bid}:${f}`,
				title: label,
				Name: label,
				nodeType: 'floor' as HallResourceNodeType,
				classNames: ['hall-row-subtotal'],
				hallUnits,
				leafIds: [...leafIds],
				bookingCount,
				Subtotal: formatHallCount(bookingCount),
				IDBranch: bid,
				Floor: f === '_' ? '' : f,
				children,
			};
		});

		const leafIds = new Set<string>();
		let hallUnits = 0;
		floorNodes.forEach((c) => {
			hallUnits += c.hallUnits || 0;
			(c.leafIds || []).forEach((id: string) => leafIds.add(id));
		});
		const bookingCount = countOnLeaves(bookings, leafIds);
		const name = branchName.get(bid) || String(bid);
		return {
			id: `branch:${bid}`,
			title: name,
			Name: name,
			nodeType: 'branch' as HallResourceNodeType,
			classNames: ['hall-row-subtotal'],
			hallUnits,
			leafIds: [...leafIds],
			bookingCount,
			Subtotal: formatHallCount(bookingCount),
			IDBranch: bid,
			children: floorNodes,
		};
	});
}

/** Collect branch/floor nodes (for per-slot subtotal events on the timeline). */
export function collectGroupResources(tree: any[]): { id: string; leafIds: string[]; nodeType: string }[] {
	const out: { id: string; leafIds: string[]; nodeType: string }[] = [];
	const walk = (nodes: any[]) => {
		(nodes || []).forEach((n) => {
			if (n?.nodeType === 'branch' || n?.nodeType === 'floor') {
				out.push({ id: String(n.id), leafIds: [...(n.leafIds || [])], nodeType: n.nodeType });
			}
			if (n?.children?.length) walk(n.children);
		});
	};
	walk(tree);
	return out;
}

export function bookingOverlapsSlot(booking: any, slotStart: Date, slotEnd: Date): boolean {
	const from = new Date(booking?.DateTimeFrom || booking?.start);
	const to = new Date(booking?.DateTimeTo || booking?.end);
	if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return false;
	return from < slotEnd && to > slotStart;
}

/** Build day or hour slots covering [from, to] inclusive calendar range. */
export function buildTimeSlots(from: Date, to: Date, unit: HallSlotUnit): { start: Date; end: Date }[] {
	const slots: { start: Date; end: Date }[] = [];
	if (unit === 'hour') {
		const cur = new Date(from);
		cur.setMinutes(0, 0, 0);
		const endMs = to.getTime();
		while (cur.getTime() <= endMs) {
			const start = new Date(cur);
			const end = new Date(cur);
			end.setHours(end.getHours() + 1);
			slots.push({ start, end });
			cur.setHours(cur.getHours() + 1);
		}
		return slots;
	}
	const cur = new Date(from);
	cur.setHours(0, 0, 0, 0);
	const last = new Date(to);
	last.setHours(0, 0, 0, 0);
	while (cur.getTime() <= last.getTime()) {
		const start = new Date(cur);
		const end = new Date(cur);
		end.setDate(end.getDate() + 1);
		slots.push({ start, end });
		cur.setDate(cur.getDate() + 1);
	}
	return slots;
}

/**
 * Timeline counts on branch/floor rows: plain number only (no event chrome / no time label like "12a").
 */
export function groupSlotSubtotalEvents(
	groups: { id: string; leafIds: string[] }[],
	bookings: any[],
	slots: { start: Date; end: Date }[],
	getCss?: (name: string) => string
): any[] {
	const text = (getCss && getCss('--ion-color-dark')) || '';
	const events: any[] = [];
	(groups || []).forEach((g) => {
		const leafSet = new Set((g.leafIds || []).map(String));
		const groupBookings = (bookings || []).filter((b) => leafSet.has(String(b.IDHall)));
		(slots || []).forEach((slot) => {
			const count = groupBookings.filter((b) => bookingOverlapsSlot(b, slot.start, slot.end)).length;
			if (!count) return;
			events.push({
				id: `sub:${g.id}:${slot.start.toISOString()}`,
				resourceId: g.id,
				start: slot.start,
				end: slot.end,
				title: String(count),
				// background = do not participate in FG event packing (avoids tall group rows)
				display: 'background',
				editable: false,
				startEditable: false,
				durationEditable: false,
				classNames: ['hall-slot-subtotal'],
				backgroundColor: 'transparent',
				borderColor: 'transparent',
				textColor: text,
				extendedProps: { isSubtotal: true, count },
			});
		});
	});
	return events;
}

/**
 * FC timeline day slots sit in one tall overlay without data-resource-id.
 * Resolve the resource row by matching clientY to .fc-timeline-lane bounds.
 */
export function resolveHallResourceIdAtY(root: ParentNode | null | undefined, clientY: number): string | null {
	if (!root) return null;
	const lanes = root.querySelectorAll('.fc-timeline-lane[data-resource-id]');
	for (let i = 0; i < lanes.length; i++) {
		const lane = lanes[i] as Element;
		const r = lane.getBoundingClientRect();
		if (clientY >= r.top && clientY < r.bottom) {
			return lane.getAttribute('data-resource-id');
		}
	}
	return null;
}

/**
 * Resource id under a pointer target: direct data-resource-id, or Y-match on timeline slots.
 */
export function resolveHallResourceIdFromPointer(
	root: ParentNode | null | undefined,
	target: EventTarget | null,
	clientY: number
): string | null {
	if (!root || !target || !(target instanceof Element)) return null;
	const direct = target.closest(
		'.fc-datagrid-cell[data-resource-id], .fc-timeline-lane[data-resource-id]'
	) as Element | null;
	if (direct && root.contains(direct)) {
		return direct.getAttribute('data-resource-id');
	}
	if (target.closest('.fc-timeline-body, .fc-timeline-slots, .fc-timeline-events, .fc-timeline-lane')) {
		return resolveHallResourceIdAtY(root, clientY);
	}
	return null;
}

/**
 * Toggle datatable-like row hover on FC resource label cells + timeline lane only
 * (not every [data-resource-id] node — that can wash the whole grid).
 * Returns the active resource id, or null when cleared.
 */
export function applyHallCalendarRowHover(root: ParentNode | null | undefined, resourceId: string | null): string | null {
	if (!root) return null;
	root.querySelectorAll('.hall-row-hover').forEach((n) => n.classList.remove('hall-row-hover'));
	if (resourceId == null || resourceId === '') return null;
	const safe =
		typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
			? CSS.escape(resourceId)
			: String(resourceId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	root
		.querySelectorAll(`.fc-datagrid-cell[data-resource-id="${safe}"], .fc-timeline-lane[data-resource-id="${safe}"]`)
		.forEach((n) => n.classList.add('hall-row-hover'));
	return resourceId;
}

/** @deprecated */
export function hallToResource(hall: any): any {
	const id = hall?.IDHall ?? hall?.Id;
	return {
		id: String(id),
		title: hall?.Name || '',
		Name: hall?.Name || '',
		Floor: hall?.Floor || '',
		HallKind: hall?.HallKind || '',
		IDBranch: hall?.IDBranch,
		nodeType: 'hall',
	};
}

/** @deprecated */
export function resourcesFromHalls(halls: any[]): any[] {
	return (halls || []).map(hallToResource);
}
