import { daysInStage, indexById, isOverdue, missingIds, opportunityStatus, sortStages, serviceTypeIcon } from './opportunity-list.util';

describe('opportunity-list.util', () => {
	const now = new Date(2026, 10, 19, 15, 0, 0);

	describe('opportunityStatus', () => {
		it('open deal is primary', () => {
			expect(opportunityStatus({ IsClosed: false })).toEqual({ label: 'Open', color: 'primary' });
		});
		it('lost deal is danger', () => {
			expect(opportunityStatus({ IsClosed: true, ClosedType: 'Lost' })).toEqual({ label: 'Lost', color: 'danger' });
		});
		it('completed deal reuses the Done key', () => {
			expect(opportunityStatus({ IsClosed: true, ClosedType: 'Completed' })).toEqual({ label: 'Done', color: 'success' });
		});
		it('manual close is warning', () => {
			expect(opportunityStatus({ IsClosed: true, ClosedType: 'Manual' })).toEqual({ label: 'Closed manually', color: 'warning' });
		});
		it('unknown closed type keeps its text', () => {
			expect(opportunityStatus({ IsClosed: true, ClosedType: 'Other' }).label).toBe('Other');
			expect(opportunityStatus({ IsClosed: true }).label).toBe('Closed');
		});
	});

	describe('daysInStage', () => {
		it('counts whole days for an open deal', () => {
			expect(daysInStage({ IsClosed: false, StageChangedDate: new Date(2026, 10, 14, 20, 0, 0) }, now)).toBe(4);
		});
		it('is 0 on the same day and never negative', () => {
			expect(daysInStage({ StageChangedDate: new Date(2026, 10, 19, 1, 0, 0) }, now)).toBe(0);
			expect(daysInStage({ StageChangedDate: new Date(2026, 10, 25) }, now)).toBe(0);
		});
		it('is null for a closed deal or a missing / invalid date', () => {
			expect(daysInStage({ IsClosed: true, StageChangedDate: new Date(2026, 10, 1) }, now)).toBeNull();
			expect(daysInStage({ IsClosed: false }, now)).toBeNull();
			expect(daysInStage({ StageChangedDate: 'abc' }, now)).toBeNull();
		});
	});

	describe('isOverdue', () => {
		it('open deal with a past event date is overdue', () => {
			expect(isOverdue({ IsClosed: false, EventDate: new Date(2026, 10, 18, 23, 0, 0) }, now)).toBeTrue();
		});
		it('an event today or later is not overdue', () => {
			expect(isOverdue({ EventDate: new Date(2026, 10, 19, 8, 0, 0) }, now)).toBeFalse();
			expect(isOverdue({ EventDate: new Date(2026, 11, 1) }, now)).toBeFalse();
		});
		it('closed deal, missing or invalid date is not overdue', () => {
			expect(isOverdue({ IsClosed: true, EventDate: new Date(2025, 1, 1) }, now)).toBeFalse();
			expect(isOverdue({}, now)).toBeFalse();
			expect(isOverdue({ EventDate: 'abc' }, now)).toBeFalse();
		});
	});

	describe('indexById / missingIds', () => {
		it('indexes rows by Id', () => {
			const map = indexById([{ Id: 1 }, { Id: 5 }]);
			expect(Object.keys(map)).toEqual(['1', '5']);
			expect(indexById(null)).toEqual({});
		});
		it('returns distinct ids that are not known yet', () => {
			const rows = [{ IDContact: 1 }, { IDContact: 2 }, { IDContact: 2 }, { IDContact: null }, { IDContact: 3 }];
			expect(missingIds(rows, 'IDContact', { 1: {} })).toEqual([2, 3]);
			expect(missingIds(null, 'IDContact', {})).toEqual([]);
		});
	});

	describe('serviceTypeIcon', () => {
		it('prefers the Icon of the type, then the code map, then a default', () => {
			expect(serviceTypeIcon({ Icon: 'star', Code: 'SVC_WEDDING' })).toBe('star');
			expect(serviceTypeIcon({ Code: 'SVC_WEDDING' })).toBe('heart-outline');
			expect(serviceTypeIcon({ Code: 'OTHER' })).toBe('pricetag-outline');
			expect(serviceTypeIcon(null)).toBe('pricetag-outline');
		});
	});

	describe('sortStages', () => {
		it('sorts every stage by Sort, Lost included', () => {
			const rows = [
				{ Name: 'Báo giá', Outcome: 'Open', Sort: 3 },
				{ Name: 'Hủy deal', Outcome: 'Lost', Sort: 9 },
				{ Name: 'Tiếp nhận', Outcome: 'Open', Sort: 1 },
				{ Name: 'Hợp đồng', Outcome: 'Won', Sort: 4 },
			];
			expect(sortStages(rows).map((r) => r.Name)).toEqual(['Tiếp nhận', 'Báo giá', 'Hợp đồng', 'Hủy deal']);
		});
		it('handles empty input', () => {
			expect(sortStages(null)).toEqual([]);
		});
	});
});
