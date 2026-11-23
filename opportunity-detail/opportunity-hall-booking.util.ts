/** Pure helpers for Opportunity detail hall-booking block. No Angular, no HTTP. */

import { bookingStatusColor } from '../hall-booking/hall-booking.util';

export { bookingStatusColor };

/** Active = Hold (not past HoldExpiredAt) or Confirmed. */
export function isActiveHallBooking(row: { Status?: string; HoldExpiredAt?: any }, now = new Date()): boolean {
	const status = String(row?.Status || '');
	if (status === 'Confirmed') return true;
	if (status !== 'Hold') return false;
	if (!row.HoldExpiredAt) return true;
	const exp = row.HoldExpiredAt instanceof Date ? row.HoldExpiredAt : new Date(row.HoldExpiredAt);
	if (Number.isNaN(exp.getTime())) return true;
	return exp.getTime() > now.getTime();
}

/** Confirmed first, then Hold, then others; within group newest DateTimeFrom first. */
export function sortOppHallBookings<T extends { Status?: string; DateTimeFrom?: any; Id?: number }>(rows: T[]): T[] {
	const rank = (s: string) => (s === 'Confirmed' ? 0 : s === 'Hold' ? 1 : 2);
	return [...(rows || [])].sort((a, b) => {
		const ra = rank(String(a.Status || ''));
		const rb = rank(String(b.Status || ''));
		if (ra !== rb) return ra - rb;
		const ta = a.DateTimeFrom ? new Date(a.DateTimeFrom).getTime() : 0;
		const tb = b.DateTimeFrom ? new Date(b.DateTimeFrom).getTime() : 0;
		if (tb !== ta) return tb - ta;
		return (b.Id || 0) - (a.Id || 0);
	});
}

export function hallBookingDisplayName(row: { HallName?: string; Name?: string; HallCode?: string; IDHall?: number }): string {
	return row?.HallName || row?.Name || row?.HallCode || (row?.IDHall ? `#${row.IDHall}` : '—');
}

/** yyyy-MM-dd for hall-booking ?date= (local calendar day of DateTimeFrom). */
export function hallBookingDateParam(dateTimeFrom: Date | string | null | undefined): string {
	if (!dateTimeFrom) return '';
	const x = dateTimeFrom instanceof Date ? dateTimeFrom : new Date(dateTimeFrom);
	if (Number.isNaN(x.getTime())) return '';
	const y = x.getFullYear();
	const m = x.getMonth() + 1;
	const d = x.getDate();
	return `${y}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
}

/** Deep-link to hall calendar: week view on booking day + highlight that booking. */
export function hallBookingCalendarUrl(
	dateTimeFrom: Date | string | null | undefined,
	opts?: { bookingId?: number | null; opportunityId?: number | null }
): string {
	const params = new URLSearchParams();
	params.set('view', 'week');
	const date = hallBookingDateParam(dateTimeFrom);
	if (date) params.set('date', date);
	const bid = Number(opts?.bookingId);
	if (Number.isFinite(bid) && bid > 0) params.set('booking', String(bid));
	const oid = Number(opts?.opportunityId);
	if (Number.isFinite(oid) && oid > 0) params.set('idOpportunity', String(oid));
	const q = params.toString();
	return q ? `/hall-booking?${q}` : '/hall-booking';
}
