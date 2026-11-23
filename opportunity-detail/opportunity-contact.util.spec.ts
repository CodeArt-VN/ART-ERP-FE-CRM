import { resolveOppContactDisplay } from './opportunity-contact.util';

describe('resolveOppContactDisplay', () => {
	it('returns linked rows when present', () => {
		const rows = [
			{ Id: 1, IDContact: 10, ContactName: 'A', Role: 'Bride', IsPrimary: true },
			{ Id: 2, IDContact: 11, ContactName: 'B', Role: 'Planner', IsPrimary: false },
		];
		expect(resolveOppContactDisplay({ Id: 10, Name: 'A' }, rows)).toEqual(rows);
	});

	it('falls back to partner when no linked rows', () => {
		const partner = { Id: 99, Name: 'Corp', WorkPhone: '090', Email: 'a@b.c', BillingAddress: 'HN', IsPersonal: false };
		expect(resolveOppContactDisplay(partner, [])).toEqual([
			{
				Id: 0,
				IDContact: 99,
				ContactName: 'Corp',
				WorkPhone: '090',
				Email: 'a@b.c',
				BillingAddress: 'HN',
				IsPersonal: false,
				Role: null,
				IsPrimary: true,
			},
		]);
	});

	it('returns empty when neither partner nor rows', () => {
		expect(resolveOppContactDisplay(null, null)).toEqual([]);
		expect(resolveOppContactDisplay(null, [])).toEqual([]);
	});
});
