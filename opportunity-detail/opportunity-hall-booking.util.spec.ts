import { hallBookingCalendarUrl, hallBookingDateParam, hallBookingDisplayName, isActiveHallBooking, sortOppHallBookings } from './opportunity-hall-booking.util';

describe('opportunity-hall-booking.util', () => {
	it('isActiveHallBooking: Confirmed always active; Hold respects HoldExpiredAt', () => {
		const now = new Date('2026-11-22T10:00:00');
		expect(isActiveHallBooking({ Status: 'Confirmed' }, now)).toBe(true);
		expect(isActiveHallBooking({ Status: 'Hold' }, now)).toBe(true);
		expect(isActiveHallBooking({ Status: 'Hold', HoldExpiredAt: '2026-11-25T07:45:00' }, now)).toBe(true);
		expect(isActiveHallBooking({ Status: 'Hold', HoldExpiredAt: '2026-11-21T07:45:00' }, now)).toBe(false);
		expect(isActiveHallBooking({ Status: 'Cancelled' }, now)).toBe(false);
		expect(isActiveHallBooking({ Status: 'Expired' }, now)).toBe(false);
	});

	it('sortOppHallBookings: Confirmed then Hold then others; newest first within group', () => {
		const rows = [
			{ Id: 1, Status: 'Cancelled', DateTimeFrom: '2027-01-20T17:00:00' },
			{ Id: 2, Status: 'Hold', DateTimeFrom: '2027-01-10T17:00:00' },
			{ Id: 3, Status: 'Confirmed', DateTimeFrom: '2027-01-05T17:00:00' },
			{ Id: 4, Status: 'Hold', DateTimeFrom: '2027-01-30T17:00:00' },
			{ Id: 5, Status: 'Confirmed', DateTimeFrom: '2027-01-15T17:00:00' },
		];
		expect(sortOppHallBookings(rows).map((r) => r.Id)).toEqual([5, 3, 4, 2, 1]);
	});

	it('hallBookingDisplayName prefers HallName then Name then HallCode', () => {
		expect(hallBookingDisplayName({ HallName: 'Topaz', Name: 'x', HallCode: 'DP1-TOPAZ' })).toBe('Topaz');
		expect(hallBookingDisplayName({ Name: 'Topaz', HallCode: 'DP1-TOPAZ' })).toBe('Topaz');
		expect(hallBookingDisplayName({ HallCode: 'DP1-TOPAZ', IDHall: 11 })).toBe('DP1-TOPAZ');
		expect(hallBookingDisplayName({ IDHall: 11 })).toBe('#11');
		expect(hallBookingDisplayName({})).toBe('—');
	});

	it('hallBookingDateParam / hallBookingCalendarUrl build week deep-link with booking highlight', () => {
		expect(hallBookingDateParam('2027-01-23T17:00:00')).toBe('2027-01-23');
		expect(hallBookingCalendarUrl('2027-01-23T17:00:00')).toBe('/hall-booking?view=week&date=2027-01-23');
		expect(hallBookingCalendarUrl('2027-01-23T17:00:00', { bookingId: 2562, opportunityId: 7913 })).toBe(
			'/hall-booking?view=week&date=2027-01-23&booking=2562&idOpportunity=7913'
		);
		expect(hallBookingCalendarUrl(null)).toBe('/hall-booking?view=week');
	});
});
