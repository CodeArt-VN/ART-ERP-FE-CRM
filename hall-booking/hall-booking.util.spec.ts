import {
	availabilityColor,
	bookableHallSelectOptions,
	bookFormErrors,
	bookingStatusColor,
	countAvailable,
	defaultHoldUntil,
	defaultSearchWindow,
	filterAvailableOnly,
	hallBookingViewFromQuery,
	parseDateTimeLocal,
	presetWindow,
	sortAvailabilityRows,
	timelineBlocks,
	toDateTimeLocalValue,
} from './hall-booking.util';

describe('hall-booking.util', () => {
	it('toDateTimeLocalValue / parseDateTimeLocal round-trip', () => {
		const d = new Date(2026, 11, 1, 11, 30, 0);
		const s = toDateTimeLocalValue(d);
		expect(s).toBe('2026-12-01T11:30');
		const back = parseDateTimeLocal(s);
		expect(back?.getFullYear()).toBe(2026);
		expect(back?.getHours()).toBe(11);
	});

	it('defaultSearchWindow is today 11–15', () => {
		const now = new Date(2026, 10, 22, 9, 0, 0);
		const w = defaultSearchWindow(now);
		expect(w.from.getHours()).toBe(11);
		expect(w.to.getHours()).toBe(15);
	});

	it('defaultHoldUntil adds hours', () => {
		const now = new Date(2026, 10, 22, 12, 0, 0);
		expect(defaultHoldUntil(now, 72).getTime()).toBe(now.getTime() + 72 * 3600 * 1000);
	});

	it('bookFormErrors requires Opp, hall, range, hold until', () => {
		expect(bookFormErrors({})).toContain('Opportunity is required');
		const ok = bookFormErrors({
			IDOpportunity: 1,
			IDHall: 2,
			DateTimeFrom: '2026-12-01T11:00',
			DateTimeTo: '2026-12-01T15:00',
			Status: 'Hold',
			HoldExpiredAt: toDateTimeLocalValue(defaultHoldUntil()),
		});
		expect(ok).toEqual([]);
	});

	it('bookableHallSelectOptions: plain hall + hall-with-lines', () => {
		const halls = [
			{ Id: 1, Name: 'Ruby', Floor: '1' },
			{ Id: 2, Name: 'Amber', Floor: '1' },
		];
		const lines = [
			{ Id: 21, IDParent: 1, Name: 'Line A', LineNo: 1 },
			{ Id: 22, IDParent: 1, Name: 'Line B', LineNo: 2 },
		];
		const opts = bookableHallSelectOptions(halls, lines);
		expect(opts.map((o) => o.Id)).toEqual([21, 22, 2]);
		expect(opts[0].Name).toBe('Ruby / Line A');
		expect(opts[2].Name).toBe('Amber');
		expect(opts.find((o) => o.Id === 2)?.nodeType).toBe('hall');
	});

	it('bookingStatusColor / availabilityColor', () => {
		expect(bookingStatusColor('Confirmed')).toBe('success');
		expect(bookingStatusColor('Hold')).toBe('warning');
		expect(availabilityColor(true)).toBe('success');
		expect(availabilityColor(false)).toBe('danger');
	});

	it('hallBookingViewFromQuery maps week/day/month', () => {
		expect(hallBookingViewFromQuery('week')).toBe('resourceTimelineWeek');
		expect(hallBookingViewFromQuery('day')).toBe('resourceTimelineDay');
		expect(hallBookingViewFromQuery('month')).toBe('resourceTimelineMonth');
		expect(hallBookingViewFromQuery('x')).toBeNull();
	});

	it('sortAvailabilityRows puts free halls first', () => {
		const rows = sortAvailabilityRows([
			{ Name: 'B', IsAvailable: false, Floor: '1' },
			{ Name: 'A', IsAvailable: true, Floor: '2' },
		]);
		expect(rows[0].Name).toBe('A');
	});

	it('presetWindow dinner is 17–22', () => {
		const w = presetWindow(new Date(2026, 11, 1), 'dinner');
		expect(w.from.getHours()).toBe(17);
		expect(w.to.getHours()).toBe(22);
	});

	it('timelineBlocks clamps into window', () => {
		const blocks = timelineBlocks(
			[{ Id: 1, Status: 'Hold', Name: 'A', DateTimeFrom: '2026-12-01T12:00:00', DateTimeTo: '2026-12-01T14:00:00' }],
			'2026-12-01T11:00',
			'2026-12-01T15:00'
		);
		expect(blocks.length).toBe(1);
		expect(blocks[0].leftPct).toBeCloseTo(25, 0);
		expect(blocks[0].widthPct).toBeCloseTo(50, 0);
	});

	it('countAvailable and filterAvailableOnly', () => {
		const rows = [{ IsAvailable: true }, { IsAvailable: false }];
		expect(countAvailable(rows)).toEqual({ free: 1, busy: 1, total: 2 });
		expect(filterAvailableOnly(rows, true).length).toBe(1);
	});
});

