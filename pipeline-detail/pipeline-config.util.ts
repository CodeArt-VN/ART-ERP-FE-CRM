/** Pure helpers for the pipeline configuration page (stage / task / rule rows). */

export const TASK_TYPES = ['Appointment', 'Call', 'Email', 'Chat', 'Document', 'Checklist', 'Approval'];
/** Ionicon shown beside each task type in the stage list. */
export const TASK_ICONS: Record<string, string> = {
	Appointment: 'calendar-outline',
	Call: 'call-outline',
	Email: 'mail-outline',
	Chat: 'chatbubbles-outline',
	Document: 'document-text-outline',
	Checklist: 'checkbox-outline',
	Approval: 'shield-checkmark-outline',
};
export const DOCUMENT_TYPES = ['Quotation', 'Contract', 'Deposit', 'Invoice', 'Other'];
export const STAGE_OUTCOMES = ['Open', 'Won', 'Done', 'Lost'];
export const POST_SIGN_MODES = ['Track', 'Close'];
/** English translate key shown for each post-sign mode. */
export const POST_SIGN_LABELS: Record<string, string> = {
	Track: 'Keep tracking until completion',
	Close: 'End at signing',
};
export const CUSTOMER_TYPES = ['Personal', 'Corporate'];
export const CUSTOMER_HISTORIES = ['New', 'Returning'];

export function nextSort(rows: { Sort?: number }[]): number {
	let max = 0;
	(rows || []).forEach((r) => {
		if (r && typeof r.Sort === 'number' && r.Sort > max) max = r.Sort;
	});
	return max + 1;
}

export function newStage(pipeline: { Id?: number }, stages: any[]): any {
	return {
		Id: 0,
		IDPipeline: pipeline.Id,
		Name: '',
		Outcome: 'Open',
		Probability: 0,
		ExpectedDays: null,
		SLAHours: null,
		IsRequireLostReason: false,
		Sort: nextSort(stages),
		_new: true,
		_open: true,
	};
}

export function newTask(stage: { Id?: number; IDPipeline?: number }, tasks: any[]): any {
	return {
		Id: 0,
		IDPipeline: stage.IDPipeline,
		IDStage: stage.Id,
		Name: '',
		TaskType: 'Call',
		IsRequired: false,
		DueOffsetDays: 0,
		Sort: nextSort(tasks),
		_new: true,
	};
}

export function newRule(pipeline: { Id?: number }, rules: any[]): any {
	return {
		Id: 0,
		IDPipeline: pipeline.Id,
		Name: '',
		Priority: 0,
		Sort: nextSort(rules),
		_new: true,
	};
}

/** Number rows 1..n in their current order (the drag-and-drop list writes 0-based values). */
export function renumberRows(rows: any[]): any[] {
	(rows || []).forEach((r, i) => (r.Sort = i + 1));
	return rows;
}

/** Rows whose Sort differs from the snapshot taken before the drag. */
export function changedSortRows(rows: any[], before: { Id: number; Sort: number }[]): any[] {
	const old = new Map((before || []).map((b) => [b.Id, b.Sort]));
	return (rows || []).filter((r) => old.get(r.Id) !== r.Sort);
}

/** ion-badge colour of a stage outcome. */
export function outcomeColor(outcome: string): string {
	return outcome === 'Lost' ? 'danger' : outcome === 'Done' ? 'success' : outcome === 'Won' ? 'warning' : 'primary';
}

/**
 * Stages and their tasks as one flat list for app-data-table [isTreeList]: stage rows are roots, task rows point at
 * their stage through IDParent. Stage and task Ids overlap, so a row Id is "S<id>" / "T<id>"; the source row stays
 * on `Stage` / `Task`.
 */
export function buildStageRows(stages: any[], tasks: any[]): any[] {
	const rows: any[] = [];
	(stages || []).forEach((s) => {
		rows.push({
			Id: 'S' + s.Id,
			IDParent: null,
			Kind: 'stage',
			Sort: s.Sort,
			Name: s.Name,
			Outcome: s.Outcome,
			Probability: s.Probability,
			Days: s.ExpectedDays,
			TaskCount: tasksOfStage(tasks, s.Id).length,
			Stage: s,
		});
	});
	(stages || []).forEach((s) => {
		tasksOfStage(tasks, s.Id).forEach((t) => {
			rows.push({
				Id: 'T' + t.Id,
				IDParent: 'S' + s.Id,
				Kind: 'task',
				Sort: t.Sort,
				Name: t.Name,
				TaskType: t.TaskType,
				DocumentType: t.DocumentType,
				IsRequired: t.IsRequired,
				Days: t.DueOffsetDays || 0,
				Stage: s,
				Task: t,
			});
		});
	});
	return rows;
}

/**
 * Qualify/Plan returns stages with nested Tasks. Flatten to the same tree rows as the pipeline edit page
 * (buildStageRows), so read-only previews can reuse app-data-table [isTreeList].
 */
export function buildStageRowsFromPlan(plan: { Stages?: any[] } | null | undefined): any[] {
	if (!plan?.Stages?.length) return [];
	const stages = plan.Stages.map((s, i) => ({ ...s, Sort: s.Sort ?? i + 1 }));
	const tasks: any[] = [];
	stages.forEach((s) => {
		(s.Tasks || []).forEach((t: any, ti: number) => {
			tasks.push({ ...t, IDStage: s.Id, Sort: t.Sort ?? ti + 1 });
		});
	});
	return buildStageRows(stages, tasks);
}

export function tasksOfStage(tasks: any[], idStage: number): any[] {
	return (tasks || []).filter((t) => t.IDStage === idStage).sort((a, b) => (a.Sort || 0) - (b.Sort || 0));
}

/** Strip UI-only fields before sending a row to the API. Rows are linked by Id; Code is only an optional label. */
export function toPayload(row: any): any {
	const body: any = {};
	Object.keys(row).forEach((k) => {
		if (k.charAt(0) !== '_') body[k] = row[k];
	});
	if (!body.Code) delete body.Code;
	['Probability', 'ExpectedDays', 'SLAHours', 'DueOffsetDays', 'MinGuests', 'MaxGuests', 'Priority', 'Sort'].forEach((k) => {
		if (k in body) body[k] = body[k] === '' || body[k] === null || body[k] === undefined ? null : Number(body[k]);
	});
	['MinGuests', 'MaxGuests', 'CustomerType', 'CustomerHistory', 'IDServiceType', 'DocumentType'].forEach((k) => {
		if (k in body && (body[k] === '' || body[k] === undefined)) body[k] = null;
	});
	return body;
}

/** Validation messages for a stage row (empty = ok). */
export function stageErrors(row: any): string[] {
	const errs: string[] = [];
	if (!row.Name || !String(row.Name).trim()) errs.push('Name is required');
	const p = Number(row.Probability);
	if (row.Probability != null && row.Probability !== '' && (isNaN(p) || p < 0 || p > 100)) errs.push('Probability must be between 0 and 100');
	return errs;
}

export function taskErrors(row: any): string[] {
	const errs: string[] = [];
	if (!row.Name || !String(row.Name).trim()) errs.push('Name is required');
	if (!row.IDStage) errs.push('Stage is required');
	if (row.TaskType === 'Document' && !row.DocumentType) errs.push('Document type is required for a document task');
	return errs;
}

export function ruleErrors(row: any): string[] {
	const errs: string[] = [];
	if (!row.Name || !String(row.Name).trim()) errs.push('Name is required');
	const min = row.MinGuests === '' || row.MinGuests == null ? null : Number(row.MinGuests);
	const max = row.MaxGuests === '' || row.MaxGuests == null ? null : Number(row.MaxGuests);
	if (min !== null && max !== null && min > max) errs.push('Min guests must not exceed max guests');
	return errs;
}

/** One condition of a rule, as a chip on the rule list. `translate` = the text is a translate key. */
export interface RuleChip {
	kind: 'service' | 'customer' | 'history' | 'guests' | 'branch';
	text: string;
	translate: boolean;
}

function hasNumber(v: any): boolean {
	return v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
}

/** Conditions a rule sets (a null / empty one means "any"). Same set the backend counts in PipelineRules.ScoreRule. */
export function ruleConditions(rule: any, serviceTypeName?: (id: number) => string): RuleChip[] {
	const chips: RuleChip[] = [];
	if (rule?.IDTargetBranch) chips.push({ kind: 'branch', text: '#' + rule.IDTargetBranch, translate: false });
	if (rule?.IDServiceType) chips.push({ kind: 'service', text: (serviceTypeName && serviceTypeName(rule.IDServiceType)) || '#' + rule.IDServiceType, translate: false });
	if (rule?.CustomerType) chips.push({ kind: 'customer', text: rule.CustomerType, translate: true });
	if (rule?.CustomerHistory) chips.push({ kind: 'history', text: rule.CustomerHistory, translate: true });
	const min = hasNumber(rule?.MinGuests) ? Number(rule.MinGuests) : null;
	const max = hasNumber(rule?.MaxGuests) ? Number(rule.MaxGuests) : null;
	if (min !== null || max !== null) {
		chips.push({ kind: 'guests', text: min !== null && max !== null ? min + '–' + max : min !== null ? '≥ ' + min : '≤ ' + max, translate: false });
	}
	return chips;
}

/**
 * Score of a rule = number of conditions x 100 + Priority (the backend picks the pipeline with the best score).
 * Min and max guests are two conditions, as in PipelineRules.ScoreRule.
 */
export function ruleScore(rule: any): number {
	let count = 0;
	if (rule?.IDTargetBranch) count++;
	if (rule?.IDServiceType) count++;
	if (rule?.CustomerType) count++;
	if (rule?.CustomerHistory) count++;
	if (hasNumber(rule?.MinGuests)) count++;
	if (hasNumber(rule?.MaxGuests)) count++;
	return count * 100 + (hasNumber(rule?.Priority) ? Number(rule.Priority) : 0);
}

/** Ionic icon of each rule condition chip. */
export const RULE_CHIP_ICONS: Record<RuleChip['kind'], string> = {
	service: 'briefcase-outline',
	customer: 'person-outline',
	history: 'time-outline',
	guests: 'people-outline',
	branch: 'business-outline',
};
