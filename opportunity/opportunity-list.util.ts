/** Pure helpers for the opportunity list (status badge, ageing, overdue). */

export interface OpportunityStatus {
	/** English translate key. */
	label: string;
	/** Ionic colour: primary default, success positive, danger lost, warning pending. */
	color: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Open / closed state of a deal with its translate key and colour. */
export function opportunityStatus(i: { IsClosed?: boolean; ClosedType?: string }): OpportunityStatus {
	if (!i?.IsClosed) return { label: 'Open', color: 'primary' };
	switch (i.ClosedType) {
		case 'Lost':
			return { label: 'Lost', color: 'danger' };
		case 'Completed':
			return { label: 'Done', color: 'success' };
		case 'Manual':
			return { label: 'Closed manually', color: 'warning' };
		default:
			return { label: i.ClosedType || 'Closed', color: 'warning' };
	}
}

/** Whole days an open deal has been in its current stage. `null` for a closed deal or an unknown date. */
export function daysInStage(i: { IsClosed?: boolean; StageChangedDate?: any }, now: Date = new Date()): number | null {
	if (!i || i.IsClosed || !i.StageChangedDate) return null;
	const changed = new Date(i.StageChangedDate).getTime();
	if (isNaN(changed)) return null;
	return Math.max(0, Math.floor((now.getTime() - changed) / DAY_MS));
}

/** An open deal whose event date is already behind us (by calendar day). */
export function isOverdue(i: { IsClosed?: boolean; EventDate?: any }, now: Date = new Date()): boolean {
	if (!i || i.IsClosed || !i.EventDate) return false;
	const event = new Date(i.EventDate);
	if (isNaN(event.getTime())) return false;
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	return event.getTime() < startOfToday;
}

/** Contact / staff rows keyed by Id for the name lookups of the list. */
export function indexById<T extends { Id?: number }>(rows: T[]): { [id: number]: T } {
	const map: { [id: number]: T } = {};
	(rows || []).forEach((r) => (map[r.Id] = r));
	return map;
}

/** Distinct, not yet known ids of one column; used to load only the missing contacts. */
export function missingIds(rows: any[], property: string, known: { [id: number]: any }): number[] {
	const set = new Set<number>();
	(rows || []).forEach((r) => {
		const id = r?.[property];
		if (id && !known[id]) set.add(id);
	});
	return Array.from(set);
}

/** Ionicon of a service type when the SYS_Type row has no Icon of its own. */
const SERVICE_TYPE_ICONS: Record<string, string> = {
	SVC_WEDDING: 'heart-outline',
	SVC_PERSONAL_OTHER: 'gift-outline',
	SVC_CORP_EVENT: 'business-outline',
	SVC_CONFERENCE: 'mic-outline',
	SVC_SEMINAR: 'school-outline',
	SVC_EXPO: 'storefront-outline',
	SVC_TOUR_GROUP: 'bus-outline',
	SVC_HALL_RENTAL: 'key-outline',
	SVC_WALKIN: 'restaurant-outline',
};

export function serviceTypeIcon(type: { Icon?: string; Code?: string }): string {
	return type?.Icon || SERVICE_TYPE_ICONS[type?.Code] || 'pricetag-outline';
}

/** The stages of one pipeline in Sort order (every stage, Lost included) for the status bar. */
export function sortStages<T extends { Sort?: number }>(stages: T[]): T[] {
	return (stages || []).filter((s) => !!s).sort((a, b) => (a.Sort || 0) - (b.Sort || 0));
}
