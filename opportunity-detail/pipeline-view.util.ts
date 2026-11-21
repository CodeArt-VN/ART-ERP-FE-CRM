import {
	LostStageInfo,
	PlanStage,
	PlanStageView,
	StageChainState,
	PlanTask,
	StageActionGroup,
	StageAgeInfo,
	StageTaskSummary,
	TaskAction,
	TaskDueStatus,
	TimelineEvent,
	TimelineDayGroup,
	TimelineFilter,
} from './pipeline.models';

/** Pure helpers for the pipeline panel and workspace of the opportunity detail page. */

export const ACTIVITY_TASK_TYPES = ['Call', 'Appointment', 'Email', 'Chat', 'Document', 'Checklist', 'Approval', 'Note'] as const;

export function isTaskFinished(task: PlanTask): boolean {
	return task.Status === 'Done' || task.Status === 'Skipped';
}

export function requiredProgress(stage: PlanStage): { done: number; total: number; percent: number } {
	const tasks = stage?.Tasks || [];
	const total = tasks.filter((t) => t.IsRequired).length;
	const done = tasks.filter((t) => t.IsRequired && isTaskFinished(t)).length;
	return { done, total, percent: total === 0 ? 100 : Math.round((done * 100) / total) };
}

/** Ionic color of a stage chip in the stepper. */
export function stageColor(stage: PlanStage | PlanStageView): string {
	if (stage.Outcome === 'Lost') return stage.IsCurrent ? 'danger' : 'medium';
	if (stage.IsCurrent) return 'primary';
	const passed = 'effectivePassed' in stage ? stage.effectivePassed : stage.IsPassed;
	if (passed) return 'success';
	return 'medium';
}

/** Stages the user can pick from the current one (everything but the current stage). */
export function moveTargets(stages: PlanStage[]): PlanStage[] {
	return (stages || []).filter((s) => !s.IsCurrent);
}

/** Quick composer: notes and calls are already done when logged; appointments and checklists stay open. */
/** Chip toggle: pick a type to open the composer, tap the same chip again to collapse. */
export function toggleComposerType(current: string | null | undefined, clicked: string): string | null {
	return current === clicked ? null : clicked;
}

/** When the label is hidden on a narrow screen, Ionic needs slot=icon-only so the icon stays centered. */
export function iconButtonSlot(iconOnly: boolean): 'icon-only' | 'start' {
	return iconOnly ? 'icon-only' : 'start';
}

/**
 * Main information expand levels on narrow screens:
 * 0 = customer + remark, 1 = + KPI tiles, 2 = full. Expand cycles up; from 2 Collapse resets to 0.
 */
export function nextInfoLevel(level: number): number {
	const n = Number.isFinite(level) ? Math.max(0, Math.min(2, Math.trunc(level))) : 0;
	return n >= 2 ? 0 : n + 1;
}

export function defaultMarkDone(taskType: string | null | undefined): boolean {
	return taskType === 'Note' || taskType === 'Call';
}

export function taskIcon(task: Pick<PlanTask, 'TaskType'> | { TaskType?: string }): string {
	switch (task?.TaskType) {
		case 'Appointment':
			return 'calendar-outline';
		case 'Call':
			return 'call-outline';
		case 'Email':
			return 'mail-outline';
		case 'Chat':
			return 'chatbubbles-outline';
		case 'Document':
			return 'document-text-outline';
		case 'Approval':
			return 'shield-checkmark-outline';
		case 'Note':
			return 'create-outline';
		default:
			return 'checkbox-outline';
	}
}

/** Lines of the dialog shown when a stage move is refused. */
export function gateMessages(errors: string[], missingFields: string[], pendingTasks: string[]): string[] {
	const lines = (errors || []).slice();
	if (!lines.length) {
		(missingFields || []).forEach((f) => lines.push(f));
		(pendingTasks || []).forEach((t) => lines.push(t));
	}
	return lines;
}

/**
 * Formats an API datetime / ISO string / Date to `yyyy-MM-dd` for native `<input type="date">`.
 * Parses leading ISO date prefix first so timezone offsets do not shift the calendar date.
 */
export function toDateInputValue(value: any): string {
	if (value === null || value === undefined || value === '') return '';
	if (typeof value === 'string') {
		const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
		if (m) return m[1];
	}
	const d = value instanceof Date ? value : new Date(value);
	if (isNaN(d.getTime())) return '';
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/**
 * Combines a `yyyy-MM-dd` date input value with the time suffix (`THH:mm:ss...`) of the original API value
 * so saving an edited date preserves the original time component (for example `10:00:00`).
 */
export function mergeDateWithOriginalTime(dateInput: any, originalValue: any): string | null {
	const dateOnly = toDateInputValue(dateInput);
	if (!dateOnly) return null;
	if (typeof originalValue === 'string') {
		const m = originalValue.trim().match(/^\d{4}-\d{2}-\d{2}(T.+)$/);
		if (m && m[1]) {
			return `${dateOnly}${m[1]}`;
		}
	}
	return dateOnly;
}

/**
 * Resolves `effectivePassed` for Sales Path chips.
 * BE marks every stage with `Sort < current.Sort` as `IsPassed = true`, which wrongly marks all 8 stages
 * green when a deal is Lost directly without going through prior stages. For Lost deals we inspect
 * `CRM_OpportunityStageHistory` to find the actual visited / prior stage; if none is recorded, prior
 * stages are treated as unpassed and `hasUnknownPriorStages` is returned as `true`.
 */
export function resolveStageStates(
	stages: PlanStage[],
	history: any[] = [],
	isLostDeal = false
): { stages: PlanStageView[]; hasUnknownPriorStages: boolean } {
	const list = stages || [];
	if (!isLostDeal) {
		return {
			stages: list.map((s) => ({ ...s, effectivePassed: !!s.IsPassed })),
			hasUnknownPriorStages: false,
		};
	}

	const stageById = new Map<number, PlanStage>();
	list.forEach((s) => stageById.set(s.Id, s));
	const lostIds = new Set(list.filter((s) => s.Outcome === 'Lost').map((s) => s.Id));

	const visitedNonLostSorts: number[] = [];
	(history || []).forEach((h) => {
		if (h?.IDFromStage && !lostIds.has(h.IDFromStage) && stageById.has(h.IDFromStage)) {
			visitedNonLostSorts.push(stageById.get(h.IDFromStage)!.Sort);
		}
		if (h?.IDToStage && !lostIds.has(h.IDToStage) && stageById.has(h.IDToStage)) {
			visitedNonLostSorts.push(stageById.get(h.IDToStage)!.Sort);
		}
	});

	if (!visitedNonLostSorts.length) {
		return {
			stages: list.map((s) => ({ ...s, effectivePassed: false })),
			hasUnknownPriorStages: list.length > 0,
		};
	}

	const maxVisitedSort = Math.max(...visitedNonLostSorts);
	return {
		stages: list.map((s) => ({
			...s,
			effectivePassed: s.Outcome !== 'Lost' && s.Sort <= maxVisitedSort,
		})),
		hasUnknownPriorStages: false,
	};
}

/** Visual state of a stage arrow: the current stage is active, passed stages are done, the rest are upcoming. */
export function stageChainState(stage: PlanStageView): StageChainState {
	if (stage.IsCurrent) return 'current';
	return stage.effectivePassed ? 'done' : 'future';
}

/**
 * Ionic color name of a stage: the stage `Color` (same value the list page bars read as `--ion-color-<Color>`),
 * with a fallback by outcome (Lost red, Won/Done green, otherwise primary) when it is missing or not a plain token.
 */
export function stageColorName(stage: Pick<PlanStage, 'Color' | 'Outcome'>): string {
	const c = (stage?.Color || '').trim();
	if (c && /^[a-z0-9-]+$/i.test(c)) return c;
	if (stage?.Outcome === 'Lost') return 'danger';
	if (stage?.Outcome === 'Won' || stage?.Outcome === 'Done') return 'success';
	return 'primary';
}

/** Returns the stages with chain state, order and css color variables precomputed (template reads the fields only). */
export function applyChainState(stages: PlanStageView[]): PlanStageView[] {
	return (stages || []).map((s, i) => {
		const name = stageColorName(s);
		return {
			...s,
			chainState: stageChainState(s),
			order: i + 1,
			colorVar: `var(--ion-color-${name})`,
			contrastVar: `var(--ion-color-${name}-contrast)`,
		};
	});
}

export interface PipelineOption {
	IDPipeline: number;
	Name: string;
	/** Same Icon / Color as the pipeline list page (`i.Icon || 'git-branch-outline'`, `i.Color || 'primary'`). */
	Icon?: string;
	Color?: string;
	stageCount: number | null;
	isCurrent: boolean;
	isRecommended: boolean;
	score: number | null;
	reasons: string[];
}

/**
 * Merges the pipeline list, the qualify candidates and the loaded plans into the rows of the Change pipeline popup.
 * Order: recommended first, then by score (desc), then by name.
 */
export function buildPipelineOptions(
	pipelines: { Id: number; Name: string; Icon?: string; Color?: string }[],
	candidates: { IDPipeline: number; Score?: number; Reasons?: string[] }[] = [],
	plans: Record<number, { TotalStages?: number; Stages?: any[] } | null> = {},
	currentId: number | null = null,
	recommendedId: number | null = null
): PipelineOption[] {
	const byCandidate = new Map<number, { IDPipeline: number; Score?: number; Reasons?: string[] }>();
	(candidates || []).forEach((c) => byCandidate.set(c.IDPipeline, c));
	const rows = (pipelines || []).map((p) => {
		const cand = byCandidate.get(p.Id);
		const plan = plans?.[p.Id];
		return {
			IDPipeline: p.Id,
			Name: p.Name,
			Icon: p.Icon || 'git-branch-outline',
			Color: p.Color || 'primary',
			stageCount: plan ? plan.TotalStages ?? plan.Stages?.length ?? null : null,
			isCurrent: p.Id === currentId,
			isRecommended: recommendedId != null && p.Id === recommendedId,
			score: cand?.Score ?? null,
			reasons: cand?.Reasons || [],
		} as PipelineOption;
	});
	return rows.sort(
		(a, b) =>
			Number(b.isRecommended) - Number(a.isRecommended) ||
			(b.score ?? -1) - (a.score ?? -1) ||
			(a.Name || '').localeCompare(b.Name || '')
	);
}

/** Computes how long the opportunity has been in the current stage and whether it exceeds ExpectedDays / SLAHours. */
export function stageAgeMetrics(
	stageChangedDate: any,
	expectedDays?: number | null,
	slaHours?: number | null,
	isClosed = false,
	now: Date = new Date()
): StageAgeInfo | null {
	if (!stageChangedDate) return null;
	const changedAt = new Date(stageChangedDate);
	if (isNaN(changedAt.getTime())) return null;
	const diffMs = Math.max(0, now.getTime() - changedAt.getTime());
	const hours = Math.floor(diffMs / 3600000);
	const days = Math.floor(hours / 24);
	return {
		days,
		hours,
		isOverExpected: !isClosed && expectedDays != null && expectedDays >= 0 && days > expectedDays,
		isOverSla: !isClosed && slaHours != null && slaHours >= 0 && hours > slaHours,
	};
}

/** Classifies a task's due date relative to the local calendar day of `now`. */
export function classifyTaskDue(dueDate: any, status?: string | null, now: Date = new Date()): TaskDueStatus {
	if (status === 'Done' || status === 'Skipped' || !dueDate) return 'none';
	const datePart = toDateInputValue(dueDate);
	const parsed = datePart ? new Date(`${datePart}T00:00:00`) : new Date(dueDate);
	if (isNaN(parsed.getTime())) return 'none';
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const dueStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
	if (dueStart < todayStart) return 'overdue';
	if (dueStart === todayStart) return 'due-today';
	return 'upcoming';
}

export function summarizeStageTasks(stage: PlanStage | null | undefined, now: Date = new Date()): StageTaskSummary {
	const tasks = stage?.Tasks || [];
	const req = requiredProgress(stage || ({ Tasks: [] } as any));
	let done = 0;
	let overdueCount = 0;
	let dueTodayCount = 0;
	let uninitializedCount = 0;
	let nextRequiredTask: PlanTask | null = null;

	for (const t of tasks) {
		const finished = isTaskFinished(t);
		if (finished) done++;
		if (!t.IDActivity) uninitializedCount++;
		const due = classifyTaskDue(t.DueDate, t.Status, now);
		if (due === 'overdue') overdueCount++;
		if (due === 'due-today') dueTodayCount++;
		if (!finished && !nextRequiredTask && t.IsRequired) {
			nextRequiredTask = t;
		}
	}
	if (!nextRequiredTask) {
		nextRequiredTask = tasks.find((t) => !isTaskFinished(t)) || null;
	}

	return {
		total: tasks.length,
		done,
		requiredTotal: req.total,
		requiredDone: req.done,
		requiredPercent: req.percent,
		overdueCount,
		dueTodayCount,
		uninitializedCount,
		nextRequiredTask,
	};
}

/** Maps a pipeline stage (by Outcome, DocumentType tasks, icon, and normalized name) to contextual stage action groups. */
export function stageActionGroup(stage?: Pick<PlanStage, 'Outcome' | 'Name' | 'Icon' | 'Tasks'> | null): StageActionGroup {
	if (!stage) return 'default';
	if (stage.Outcome === 'Lost') return 'lost';

	const docTypes = new Set((stage.Tasks || []).map((t) => t.DocumentType).filter(Boolean));
	if (docTypes.has('Quotation')) return 'quote';
	if (docTypes.has('Contract')) return 'signed';
	if (docTypes.has('Invoice')) return 'paid';

	const name = (stage.Name || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[đĐ]/g, 'd')
		.toLowerCase();

	if (name.includes('bao gia') || name.includes('quote')) return 'quote';
	if (name.includes('hop dong') || name.includes('contract') || name.includes('xac nhan booking') || name.includes('confirm')) return 'signed';
	if (name.includes('chuan bi') || name.includes('beo') || name.includes('menu') || name.includes('prepare')) return 'prepare';
	if (name.includes('su kien') || name.includes('event') || name.includes('da den') || name.includes('arrived')) return 'event';
	if (name.includes('thanh toan') || name.includes('hoa don') || name.includes('paid')) return 'paid';
	if (name.includes('tiep nhan') || name.includes('chuyen') || name.includes('lead') || name.includes('booking moi') || name.includes('new')) {
		return 'lead';
	}
	if (name.includes('khao sat') || name.includes('tu van') || name.includes('nhan booking') || name.includes('consult')) return 'consult';
	if (stage.Outcome === 'Won') return 'signed';
	if (stage.Outcome === 'Done') return 'paid';
	return 'default';
}

/** Resolves which stage the opportunity was in right before moving to Lost, based on stage history. */
export function resolveLostStageInfo(history: any[] = [], opportunity: any, stages: PlanStage[] = []): LostStageInfo {
	const lostIds = new Set((stages || []).filter((s) => s.Outcome === 'Lost').map((s) => s.Id));
	const list = (history || []).slice().sort((a, b) => (b?.Id || 0) - (a?.Id || 0));
	const lostTransition = list.find((h) => (h?.IDToStage && lostIds.has(h.IDToStage)) || /hủy|lost|cancel/i.test(h?.ToStageName || ''));
	const stageWhenLost = lostTransition?.FromStageName || null;
	const fallbackPrior = !stageWhenLost ? list.find((h) => h?.FromStageName && !lostIds.has(h?.IDFromStage))?.FromStageName || null : null;
	const resolved = stageWhenLost || fallbackPrior;
	return {
		stageWhenLost: resolved,
		isUnknownPrior: !resolved,
		lostDate: opportunity?.ClosedDate || lostTransition?.CreatedDate || null,
		lostBy: lostTransition?.CreatedBy || opportunity?.ModifiedBy || null,
	};
}

/** Builds a unified chronological (newest-first) timeline from stage history, activities, milestones, and optional audit logs. */
export function buildActivityTimeline(params: {
	opportunity: any;
	history: any[];
	activities: any[];
	entityLogs?: any[];
	stageMap?: Record<number, PlanStage>;
}): TimelineEvent[] {
	const events: TimelineEvent[] = [];
	const stageMap = params.stageMap || {};

	(params.history || []).forEach((h) => {
		const date = h.CreatedDate || h.ModifiedDate || '';
		const dateMs = date ? new Date(date).getTime() : 0;
		const from = h.FromStageName || '—';
		const to = h.ToStageName || '—';
		events.push({
			id: `stage-${h.Id ?? `${date}-${to}`}`,
			kind: 'stage',
			subType: h.Source || 'Manual',
			title: `${from} → ${to}`,
			subtitle: h.DurationHours != null ? `${h.DurationHours}h` : undefined,
			note: h.Note || undefined,
			actor: h.CreatedBy,
			date,
			dateMs: isNaN(dateMs) ? 0 : dateMs,
			icon: 'git-commit-outline',
			color: /hủy|lost|cancel/i.test(to) ? 'danger' : 'primary',
			badge: h.Source || undefined,
			raw: h,
		});
	});

	(params.activities || []).forEach((a) => {
		const date = a.CompletedDate || a.EventDate || a.DueDate || a.ModifiedDate || a.CreatedDate || '';
		const dateMs = date ? new Date(date).getTime() : 0;
		const stageName = a.IDStage && stageMap[a.IDStage] ? stageMap[a.IDStage].Name : undefined;
		const statusColor = a.Status === 'Done' ? 'success' : a.Status === 'Skipped' ? 'medium' : 'warning';
		events.push({
			id: `act-${a.Id}`,
			kind: 'activity',
			subType: a.TaskType || 'Checklist',
			title: a.Name || a.TaskType || 'Activity',
			subtitle: [a.TaskType, stageName].filter(Boolean).join(' · '),
			note: a.Remark || undefined,
			actor: a.ModifiedBy || a.CreatedBy,
			date,
			dateMs: isNaN(dateMs) ? 0 : dateMs,
			icon: taskIcon({ TaskType: a.TaskType }),
			color: statusColor,
			badge: a.Status || 'Open',
			raw: a,
		});
	});

	const opp = params.opportunity;
	if (opp?.CreatedDate) {
		const ms = new Date(opp.CreatedDate).getTime();
		events.push({
			id: `ms-created-${opp.Id}`,
			kind: 'milestone',
			subType: 'Created',
			title: 'Opportunity created',
			actor: opp.CreatedBy,
			date: opp.CreatedDate,
			dateMs: isNaN(ms) ? 0 : ms,
			icon: 'sparkles-outline',
			color: 'success',
			raw: opp,
		});
	}
	if (opp?.QualifiedDate) {
		const ms = new Date(opp.QualifiedDate).getTime();
		events.push({
			id: `ms-qualified-${opp.Id}`,
			kind: 'milestone',
			subType: 'Qualified',
			title: 'Pipeline qualified',
			actor: opp.ModifiedBy,
			date: opp.QualifiedDate,
			dateMs: isNaN(ms) ? 0 : ms,
			icon: 'git-network-outline',
			color: 'primary',
			raw: opp,
		});
	}
	if (opp?.IsClosed && opp?.ClosedDate) {
		const ms = new Date(opp.ClosedDate).getTime();
		events.push({
			id: `ms-closed-${opp.Id}`,
			kind: 'milestone',
			subType: 'Closed',
			title: 'Deal closed',
			subtitle: opp.ClosedType || undefined,
			note: opp.LostRemark || undefined,
			actor: opp.ModifiedBy,
			date: opp.ClosedDate,
			dateMs: isNaN(ms) ? 0 : ms,
			icon: 'flag-outline',
			color: 'medium',
			raw: opp,
		});
	}

	(params.entityLogs || []).forEach((log, idx) => {
		const date = log.Date || log.CreatedDate || log.LogDate || log.ModifiedDate || '';
		const ms = date ? new Date(date).getTime() : 0;
		const changedKeys = log._data && typeof log._data === 'object' ? Object.keys(log._data).filter((k) => !['Id', 'ModifiedBy', 'ModifiedDate'].includes(k)) : [];
		const summary = log.Summary || log.Remark || (changedKeys.length ? changedKeys.join(', ') : undefined);
		events.push({
			id: `log-${log.Id ?? idx}`,
			kind: 'edit',
			subType: log._badge || 'Audit',
			title: log._label || log.Action || log.PropertyName || 'Updated record',
			note: summary,
			actor: log.LoggedBy || log.CreatedBy || log.Username,
			date,
			dateMs: isNaN(ms) ? 0 : ms,
			icon: 'time-outline',
			color: 'medium',
			raw: log,
		});
	});

	return events.sort((a, b) => b.dateMs - a.dateMs);
}

export function filterTimelineEvents(events: TimelineEvent[], filter: TimelineFilter): TimelineEvent[] {
	const list = events || [];
	if (!filter || filter === 'all') return list;
	if (filter === 'note_call') {
		return list.filter((e) => e.kind === 'activity' && (e.subType === 'Call' || e.subType === 'Note' || e.subType === 'Appointment' || e.subType === 'Email' || e.subType === 'Chat'));
	}
	return list.filter((e) => e.kind === filter);
}

/** Events of one stage: its activities and the transitions into or out of it. Without a stage, all events. */
export function filterTimelineByStage(events: TimelineEvent[], idStage: number | null | undefined): TimelineEvent[] {
	const list = events || [];
	if (!idStage) return list;
	return list.filter((e) => {
		if (e.kind === 'activity') return e.raw?.IDStage === idStage;
		if (e.kind === 'stage') return e.raw?.IDToStage === idStage || e.raw?.IDFromStage === idStage;
		return false;
	});
}

/** From this many calendar days between two displayed entries, the timeline connector is dashed. */
export const TIMELINE_LONG_GAP_DAYS = 2;

/** Whole calendar days between two local-day starts (DST safe). */
export function calendarDayGap(aDayMs: number, bDayMs: number): number {
	return Math.round(Math.abs(aDayMs - bDayMs) / 86400000);
}

/** Groups consecutive events (already sorted) by local calendar day, for the journal view. Also flags the long gaps between days. */
export function groupTimelineByDay(events: TimelineEvent[]): TimelineDayGroup[] {
	const groups: TimelineDayGroup[] = [];
	(events || []).forEach((e) => {
		const d = new Date(e.dateMs);
		const valid = !isNaN(d.getTime());
		const start = valid ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : new Date(0);
		const key = valid ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}` : 'unknown';
		const last = groups[groups.length - 1];
		if (last && last.key === key) last.events.push(e);
		else groups.push({ key, dayMs: start.getTime(), events: [e], gapDays: 0, longGapBefore: false, longGapAfter: false });
	});
	for (let i = 1; i < groups.length; i++) {
		const prev = groups[i - 1];
		const cur = groups[i];
		// entries without a valid date have no meaningful distance
		if (prev.key === 'unknown' || cur.key === 'unknown') continue;
		cur.gapDays = calendarDayGap(prev.dayMs, cur.dayMs);
		cur.longGapBefore = cur.gapDays >= TIMELINE_LONG_GAP_DAYS;
		prev.longGapAfter = cur.longGapBefore;
	}
	return groups;
}

export const TIMELINE_FILTERS: TimelineFilter[] = ['all', 'stage', 'activity', 'note_call', 'milestone', 'edit'];

/** Number of events per timeline filter chip, computed once per timeline rebuild. */
export function countTimelineByFilter(events: TimelineEvent[]): Record<TimelineFilter, number> {
	const out = {} as Record<TimelineFilter, number>;
	TIMELINE_FILTERS.forEach((f) => (out[f] = filterTimelineEvents(events, f).length));
	return out;
}

export function buildStageMap(stages: PlanStage[]): Record<number, PlanStage> {
	const map: Record<number, PlanStage> = {};
	(stages || []).forEach((s) => (map[s.Id] = s));
	return map;
}

export function sumBy(rows: any[], field: string): number {
	return (rows || []).reduce((sum, r) => sum + (Number(r?.[field]) || 0), 0);
}

/** Due status of every task of a stage, keyed by task Id. */
export function buildTaskDueMap(tasks: PlanTask[], now: Date = new Date()): Record<number, TaskDueStatus> {
	const map: Record<number, TaskDueStatus> = {};
	(tasks || []).forEach((t) => (map[t.Id] = classifyTaskDue(t.DueDate, t.Status, now)));
	return map;
}

/** Extracts required field keys missing a truthy value on `opportunity` for a target stage. */
export function missingRequiredFields(targetStage: PlanStage | null | undefined, opportunity: any): string[] {
	const fields = targetStage?.RequiredFields || [];
	if (!fields.length || !opportunity) return [];
	return fields.filter((f) => {
		const v = opportunity[f];
		return v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v));
	});
}

/**
 * Main button of a stage task row. Quotation/contract tasks open the document modal (create, or open the first one);
 * call, appointment, email and other document tasks open the task activity. Checklist and note tasks use the checkbox only.
 */
export function taskAction(task: PlanTask, docs: { quotations: number; contracts: number }): TaskAction | null {
	if (!task) return null;
	const finished = isTaskFinished(task);
	if (task.TaskType === 'Document') {
		if (task.DocumentType === 'Quotation') {
			if (docs?.quotations) return { kind: 'open-quotation', label: 'Open quotation', icon: 'document-text-outline' };
			return finished ? null : { kind: 'new-quotation', label: 'New quotation', icon: 'add-outline' };
		}
		if (task.DocumentType === 'Contract') {
			if (docs?.contracts) return { kind: 'open-contract', label: 'Open contract', icon: 'document-attach-outline' };
			return finished ? null : { kind: 'new-contract', label: 'New contract', icon: 'add-outline' };
		}
		return finished ? null : { kind: 'activity', label: 'Update', icon: 'create-outline' };
	}
	if (finished) return null;
	switch (task.TaskType) {
		case 'Call':
			return { kind: 'activity', label: 'Log call', icon: 'call-outline' };
		case 'Appointment':
			return { kind: 'activity', label: 'Schedule', icon: 'calendar-outline' };
		case 'Email':
			return { kind: 'activity', label: 'Log email', icon: 'mail-outline' };
		default:
			return null;
	}
}

/** `taskAction` of every task of a stage, keyed by task Id (tasks without a button are left out). */
export function buildTaskActionMap(tasks: PlanTask[], docs: { quotations: number; contracts: number }): Record<number, TaskAction> {
	const map: Record<number, TaskAction> = {};
	(tasks || []).forEach((t) => {
		const action = taskAction(t, docs);
		if (action) map[t.Id] = action;
	});
	return map;
}

/**
 * Masonry placement of the Documents box on the detail workspace (two-column layout only).
 * Documents sits under Activities when that column is shorter than Main information, otherwise under Main information.
 */
export function docsInLeftColumn(activityHeight: number, infoHeight: number, twoColumns: boolean): boolean {
	if (!twoColumns) return false;
	return activityHeight < infoHeight;
}

/** Plain-text name of a branch by id (the detail shows the branch as text, not breadcrumbs). */
export function branchNameById(items: { Id: number; Name: string }[] | null | undefined, id: number | null | undefined): string {
	if (!Array.isArray(items) || id === null || id === undefined) return '';
	return items.find((d) => d.Id == id)?.Name ?? '';
}
