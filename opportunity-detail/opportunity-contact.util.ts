/** Display rows for Customer & contact: linked OpportunityContact rows, or legacy IDContact partner. */
export function resolveOppContactDisplay(partner: any, rows: any[]): any[] {
	const list = Array.isArray(rows) ? rows.filter((r) => r && (r.Id || r.IDContact)) : [];
	if (list.length) return list;
	if (partner?.Id) {
		return [
			{
				Id: 0,
				IDContact: partner.Id,
				ContactName: partner.Name || '',
				WorkPhone: partner.WorkPhone || null,
				Email: partner.Email || null,
				BillingAddress: partner.BillingAddress || null,
				IsPersonal: partner.IsPersonal,
				Role: null,
				IsPrimary: true,
			},
		];
	}
	return [];
}
