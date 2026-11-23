/** Pure helpers for hall availability / booking UI. No Angular, no HTTP. */

export function pad2(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

/** Local datetime-local input value (yyyy-MM-ddTHH:mm). */
export function toDateTimeLocalValue(d: Date | string | null | undefined): string {
	if (!d) return '';
	const x = d instanceof Date ? d : new Date(d);
	if (Number.isNaN(x.getTime())) return '';
	return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}T${pad2(x.getHours())}:${pad2(x.getMinutes())}`;
}

/** Parse datetime-local / ISO string to Date; null when invalid. */
export function parseDateTimeLocal(v: string | Date | null | undefined): Date | null {
	if (!v) return null;
	if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
	const x = new Date(v);
	return Number.isNaN(x.getTime()) ? null : x;
}

/** Default search window: today 11:00–15:00 (lunch block). */
export function defaultSearchWindow(now = new Date()): { from: Date; to: Date } {
	const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0);
	const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0);
	return { from, to };
}

/** Default Hold expiry: now + hours. */
export function defaultHoldUntil(now = new Date(), hours = 72): Date {
	return new Date(now.getTime() + hours * 3600 * 1000);
}

export function bookingStatusColor(status: string): string {
	switch (String(status || '')) {
		case 'Confirmed':
			return 'success';
		case 'Hold':
			return 'warning';
		case 'Cancelled':
		case 'Expired':
		case 'Released':
			return 'medium';
		default:
			return 'medium';
	}
}

/** Map ?view= query to FullCalendar resourceTimeline view id. */
export function hallBookingViewFromQuery(view: string | null | undefined): string | null {
	const v = String(view || '').toLowerCase();
	if (v === 'week') return 'resourceTimelineWeek';
	if (v === 'day') return 'resourceTimelineDay';
	if (v === 'month') return 'resourceTimelineMonth';
	return null;
}

export function availabilityColor(isAvailable: boolean): string {
	return isAvailable ? 'success' : 'danger';
}

/** Validate book form values; returns English translate keys. */
export function bookFormErrors(row: {
	IDOpportunity?: any;
	IDHall?: any;
	DateTimeFrom?: any;
	DateTimeTo?: any;
	Status?: string;
	HoldExpiredAt?: any;
}): string[] {
	const errs: string[] = [];
	if (!row.IDOpportunity) errs.push('Opportunity is required');
	if (!row.IDHall) errs.push('Hall is required');
	const from = parseDateTimeLocal(row.DateTimeFrom);
	const to = parseDateTimeLocal(row.DateTimeTo);
	if (!from || !to) errs.push('From and to date/time are required');
	else if (!(to > from)) errs.push('End time must be after start time');
	const status = String(row.Status || 'Hold');
	if (status !== 'Hold' && status !== 'Confirmed') errs.push('Status must be Hold or Confirmed');
	if (status === 'Hold') {
		const hold = parseDateTimeLocal(row.HoldExpiredAt);
		if (!hold) errs.push('Hold until is required');
		else if (hold <= new Date()) errs.push('Hold until must be in the future');
	}
	return errs;
}

/** Sort halls: available first, then by Floor, Name. */
export function sortAvailabilityRows(rows: any[]): any[] {
	return [...(rows || [])].sort((a, b) => {
		const av = (b.IsAvailable ? 1 : 0) - (a.IsAvailable ? 1 : 0);
		if (av) return av;
		const f = String(a.Floor || '').localeCompare(String(b.Floor || ''), undefined, { numeric: true });
		if (f) return f;
		return String(a.Name || '').localeCompare(String(b.Name || ''));
	});
}

export type TimePreset = 'lunch' | 'dinner' | 'fullday';

/** Quick window presets for a calendar day (local). */
export function presetWindow(day: Date, preset: TimePreset): { from: Date; to: Date } {
	const y = day.getFullYear();
	const m = day.getMonth();
	const d = day.getDate();
	if (preset === 'dinner') {
		return { from: new Date(y, m, d, 17, 0, 0), to: new Date(y, m, d, 22, 0, 0) };
	}
	if (preset === 'fullday') {
		return { from: new Date(y, m, d, 8, 0, 0), to: new Date(y, m, d, 23, 0, 0) };
	}
	return { from: new Date(y, m, d, 11, 0, 0), to: new Date(y, m, d, 15, 0, 0) };
}

export function countAvailable(rows: { IsAvailable?: boolean }[]): { free: number; busy: number; total: number } {
	const list = rows || [];
	const free = list.filter((r) => r.IsAvailable).length;
	return { free, busy: list.length - free, total: list.length };
}

export interface TimelineBlock {
	Id: number;
	Status: string;
	label: string;
	leftPct: number;
	widthPct: number;
	DateTimeFrom: any;
	DateTimeTo: any;
	raw: any;
}

/** Position booking blocks inside a window as % left/width for a timeline strip. */
export function timelineBlocks(overlaps: any[], windowFrom: Date | string, windowTo: Date | string): TimelineBlock[] {
	const from = parseDateTimeLocal(windowFrom);
	const to = parseDateTimeLocal(windowTo);
	if (!from || !to || !(to > from)) return [];
	const span = to.getTime() - from.getTime();
	return (overlaps || [])
		.map((b) => {
			const bf = parseDateTimeLocal(b.DateTimeFrom);
			const bt = parseDateTimeLocal(b.DateTimeTo);
			if (!bf || !bt) return null;
			const start = Math.max(bf.getTime(), from.getTime());
			const end = Math.min(bt.getTime(), to.getTime());
			if (end <= start) return null;
			const leftPct = ((start - from.getTime()) / span) * 100;
			const widthPct = ((end - start) / span) * 100;
			return {
				Id: b.Id,
				Status: b.Status,
				label: b.OpportunityName || b.Name || b.Status,
				leftPct: Math.max(0, Math.min(100, leftPct)),
				widthPct: Math.max(1.5, Math.min(100, widthPct)),
				DateTimeFrom: b.DateTimeFrom,
				DateTimeTo: b.DateTimeTo,
				raw: b,
			} as TimelineBlock;
		})
		.filter(Boolean) as TimelineBlock[];
}

/** Hour labels across the window (for the timeline header). */
export function timelineHourMarks(windowFrom: Date | string, windowTo: Date | string, maxMarks = 8): { label: string; leftPct: number }[] {
	const from = parseDateTimeLocal(windowFrom);
	const to = parseDateTimeLocal(windowTo);
	if (!from || !to || !(to > from)) return [];
	const span = to.getTime() - from.getTime();
	const hours = Math.max(1, Math.ceil(span / 3600000));
	const step = Math.max(1, Math.ceil(hours / maxMarks));
	const marks: { label: string; leftPct: number }[] = [];
	for (let h = 0; h <= hours; h += step) {
		const t = new Date(from.getTime() + h * 3600000);
		if (t > to) break;
		marks.push({
			label: `${pad2(t.getHours())}:${pad2(t.getMinutes())}`,
			leftPct: ((t.getTime() - from.getTime()) / span) * 100,
		});
	}
	return marks;
}

export function filterAvailableOnly(rows: any[], onlyAvailable: boolean): any[] {
	if (!onlyAvailable) return rows || [];
	return (rows || []).filter((r) => r.IsAvailable);
}

export type BookableHallOption = {
	Id: number;
	Name: string;
	IDBranch?: number;
	Floor?: string;
	HallKind?: string;
	nodeType: 'hall' | 'line';
};

/**
 * Select options for the book modal: bookable leaves only
 * (hall without lines, or each line under a hall-with-lines).
 */
export function bookableHallSelectOptions(halls: any[], lines: any[]): BookableHallOption[] {
	const linesByParent = new Map<number, any[]>();
	(lines || []).forEach((l) => {
		const p = Number(l.IDParent);
		if (!linesByParent.has(p)) linesByParent.set(p, []);
		linesByParent.get(p)!.push(l);
	});
	const out: BookableHallOption[] = [];
	(halls || []).forEach((h) => {
		const kids = (linesByParent.get(Number(h.Id)) || []).slice().sort(
			(a, b) => (Number(a.LineNo) || 0) - (Number(b.LineNo) || 0) || String(a.Name || '').localeCompare(String(b.Name || ''))
		);
		if (!kids.length) {
			out.push({
				Id: Number(h.Id),
				Name: String(h.Name || h.Code || h.Id),
				IDBranch: h.IDBranch,
				Floor: h.Floor,
				HallKind: h.HallKind,
				nodeType: 'hall',
			});
			return;
		}
		const hallName = String(h.Name || h.Code || h.Id);
		kids.forEach((l) => {
			out.push({
				Id: Number(l.Id),
				Name: `${hallName} / ${l.Name || l.Code || l.Id}`,
				IDBranch: l.IDBranch ?? h.IDBranch,
				Floor: h.Floor,
				HallKind: h.HallKind,
				nodeType: 'line',
			});
		});
	});
	return out;
}
