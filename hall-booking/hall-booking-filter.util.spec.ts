import {
	applyKeywordFilter,
	emptyHallBookingFilter,
	filterBookingRows,
	filterHallRows,
	filterLineRows,
	hideUnbookedHallsAndLines,
	isHallBookingFilterActive,
	leafIdsForHalls,
	matchBookingKeyword,
} from './hall-booking-filter.util';

describe('hall-booking-filter.util', () => {
	const halls = [
		{ Id: 1, IDBranch: 24, Name: 'Ruby', Code: 'DP1-RUBY', Floor: '1', HallKind: 'Banquet' },
		{ Id: 2, IDBranch: 24, Name: 'VIP 1', Code: 'DP1-VIP-1', Floor: 'G', HallKind: 'VIP' },
		{ Id: 3, IDBranch: 25, Name: 'Amber', Code: 'DP2-AMBER', Floor: '1', HallKind: 'Banquet' },
	];
	const lines = [
		{ Id: 21, IDParent: 1, Name: 'Line 1' },
		{ Id: 22, IDParent: 1, Name: 'Line 2' },
	];
	const bookings = [
		{ Id: 100, IDHall: 21, Status: 'Confirmed', OpportunityName: 'Chị Ánh Linh' },
		{ Id: 101, IDHall: 3, Status: 'Hold', OpportunityName: 'A Thắng' },
	];

	it('isHallBookingFilterActive', () => {
		expect(isHallBookingFilterActive(emptyHallBookingFilter())).toBe(false);
		expect(isHallBookingFilterActive({ ...emptyHallBookingFilter(), Keyword: 'ruby' })).toBe(true);
	});

	it('filterHallRows by keyword / floor / kind / branch', () => {
		expect(filterHallRows(halls, { ...emptyHallBookingFilter(), Keyword: 'ruby' }).map((h) => h.Id)).toEqual([1]);
		expect(filterHallRows(halls, { ...emptyHallBookingFilter(), Floors: ['G'] }).map((h) => h.Id)).toEqual([2]);
		expect(filterHallRows(halls, { ...emptyHallBookingFilter(), HallKinds: ['VIP'] }).map((h) => h.Id)).toEqual([2]);
		expect(filterHallRows(halls, { ...emptyHallBookingFilter(), IDBranches: [25] }).map((h) => h.Id)).toEqual([3]);
	});

	it('filterLineRows follows halls; hideUnbooked drops empty', () => {
		const hs = filterHallRows(halls, emptyHallBookingFilter());
		expect(filterLineRows(lines, hs.filter((h) => h.Id === 1)).length).toBe(2);
		const hidden = hideUnbookedHallsAndLines(halls, lines, bookings);
		expect(hidden.halls.map((h) => h.Id).sort()).toEqual([1, 3]);
		expect(hidden.lines.map((l) => l.Id)).toEqual([21]);
	});

	it('leafIds keep hall id even when lines exist; status filter on bookings', () => {
		const ids = leafIdsForHalls(halls, lines);
		expect(ids.has('21')).toBe(true);
		expect(ids.has('1')).toBe(true); // hall id kept — sync/Book store IDHall on hall
		expect(ids.has('3')).toBe(true);
		expect(filterBookingRows(bookings, ids, ['Confirmed']).map((b) => b.Id)).toEqual([100]);
	});

	it('empty leafIds yields no bookings (avoids FC orphan-event hang)', () => {
		expect(filterBookingRows(bookings, new Set())).toEqual([]);
		expect(filterBookingRows(bookings, [])).toEqual([]);
	});

	it('applyKeywordFilter finds booking guest "chị ánh" and keeps parent hall', () => {
		expect(matchBookingKeyword(bookings[0], 'chị ánh')).toBe(true);
		const keyed = applyKeywordFilter(halls, lines, bookings, 'chị ánh');
		expect(keyed.halls.map((h) => h.Id)).toEqual([1]);
		// Guest search: only the line that has the match — not empty siblings (avoids FC hang).
		expect(keyed.lines.map((l) => l.Id)).toEqual([21]);
		expect(keyed.bookings.map((b) => b.Id)).toEqual([100]);
	});

	it('guest keyword keeps only matching bookings on a busy hall', () => {
		const busy = [
			...bookings,
			{ Id: 102, IDHall: 21, Status: 'Hold', OpportunityName: 'Khách khác' },
			{ Id: 103, IDHall: 22, Status: 'Confirmed', OpportunityName: 'Đám khác' },
		];
		const keyed = applyKeywordFilter(halls, lines, busy, 'chị ánh');
		expect(keyed.bookings.map((b) => b.Id)).toEqual([100]);
		expect(keyed.lines.map((l) => l.Id)).toEqual([21]);
	});

	it('applyKeywordFilter by hall name keeps hall bookings', () => {
		const keyed = applyKeywordFilter(halls, lines, bookings, 'amber');
		expect(keyed.halls.map((h) => h.Id)).toEqual([3]);
		expect(keyed.bookings.map((b) => b.Id)).toEqual([101]);
	});

	it('search by branch / floor / kind / status / guest keyword', () => {
		expect(filterHallRows(halls, { ...emptyHallBookingFilter(), IDBranches: [24] }).map((h) => h.Id).sort()).toEqual([1, 2]);
		expect(filterHallRows(halls, { ...emptyHallBookingFilter(), Floors: ['1'] }).map((h) => h.Id).sort()).toEqual([1, 3]);
		expect(filterHallRows(halls, { ...emptyHallBookingFilter(), HallKinds: ['VIP'] }).map((h) => h.Id)).toEqual([2]);
		const ids = leafIdsForHalls(halls, lines);
		expect(filterBookingRows(bookings, ids, ['Hold']).map((b) => b.Id)).toEqual([101]);
		expect(filterBookingRows(bookings, ids, ['Confirmed']).map((b) => b.Id)).toEqual([100]);
		const guest = applyKeywordFilter(halls, lines, bookings, 'ánh linh');
		expect(guest.bookings.map((b) => b.Id)).toEqual([100]);
		expect(guest.halls.map((h) => h.Id)).toEqual([1]);
		const miss = applyKeywordFilter(halls, lines, bookings, 'không-có-ai');
		expect(miss.halls).toEqual([]);
		expect(miss.bookings).toEqual([]);
	});

	it('hideUnbooked keeps hall when booking sits on hall id (not only lines)', () => {
		const hallOnly = [{ Id: 200, IDHall: 1, Status: 'Confirmed' }];
		const hidden = hideUnbookedHallsAndLines(halls, lines, hallOnly);
		expect(hidden.halls.map((h) => h.Id)).toEqual([1]);
		expect(hidden.lines.length).toBe(0);
	});
});
