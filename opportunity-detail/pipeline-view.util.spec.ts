import {
	branchNameById,
	docsInLeftColumn,
	applyChainState,
	buildPipelineOptions,
	stageColorName,
	defaultMarkDone,
	stageChainState,
	buildActivityTimeline,
	buildStageMap,
	buildTaskActionMap,
	buildTaskDueMap,
	classifyTaskDue,
	countTimelineByFilter,
	sumBy,
	filterTimelineByStage,
	calendarDayGap,
	groupTimelineByDay,
	filterTimelineEvents,
	gateMessages,
	isTaskFinished,
	mergeDateWithOriginalTime,
	missingRequiredFields,
	moveTargets,
	requiredProgress,
	resolveLostStageInfo,
	resolveStageStates,
	stageActionGroup,
	stageAgeMetrics,
	stageColor,
	summarizeStageTasks,
	taskAction,
	taskIcon,
	toDateInputValue,
	toggleComposerType,
	iconButtonSlot,
	nextInfoLevel,
} from './pipeline-view.util';
import { PlanStage, PlanTask, TimelineEvent } from './pipeline.models';

const task = (over: Partial<PlanTask>): PlanTask => ({ Id: 1, Name: 'T', TaskType: 'Call', IsRequired: true, ...over });
const stage = (over: Partial<PlanStage>): PlanStage => ({
	Id: 1,
	Name: 'S',
	Sort: 1,
	Outcome: 'Open',
	Probability: 10,
	IsRequireLostReason: false,
	RequiredFields: [],
	Tasks: [],
	IsCurrent: false,
	IsPassed: false,
	RequiredTotal: 0,
	RequiredDone: 0,
	...over,
});

describe('pipeline-view.util', () => {
	// 6 original tests (kept intact)
	it('treats Done and Skipped as finished', () => {
		expect(isTaskFinished(task({ Status: 'Done' }))).toBeTrue();
		expect(isTaskFinished(task({ Status: 'Skipped' }))).toBeTrue();
		expect(isTaskFinished(task({ Status: 'Open' }))).toBeFalse();
		expect(isTaskFinished(task({}))).toBeFalse();
	});

	it('counts required tasks only', () => {
		const s = stage({
			Tasks: [task({ Status: 'Done' }), task({ Status: 'Open' }), task({ IsRequired: false, Status: 'Open' })],
		});
		expect(requiredProgress(s)).toEqual({ done: 1, total: 2, percent: 50 });
		expect(requiredProgress(stage({})).percent).toBe(100);
	});

	it('colors current, passed, lost stages', () => {
		expect(stageColor(stage({ IsCurrent: true }))).toBe('primary');
		expect(stageColor(stage({ IsPassed: true }))).toBe('success');
		expect(stageColor(stage({}))).toBe('medium');
		expect(stageColor(stage({ Outcome: 'Lost', IsCurrent: true }))).toBe('danger');
		expect(stageColor(stage({ Outcome: 'Lost' }))).toBe('medium');
	});

	it('lists every stage but the current one as a target', () => {
		const list = [stage({ Id: 10, IsCurrent: true }), stage({ Id: 11 })];
		expect(moveTargets(list).map((s) => s.Id)).toEqual([11]);
		expect(moveTargets(null as any)).toEqual([]);
	});

	it('maps task types to icons', () => {
		expect(taskIcon(task({ TaskType: 'Document' }))).toBe('document-text-outline');
		expect(taskIcon(task({ TaskType: 'Unknown' }))).toBe('checkbox-outline');
	});

	it('prefers errors, else falls back to missing fields and pending tasks', () => {
		expect(gateMessages(['x'], ['Amount'], ['Call'])).toEqual(['x']);
		expect(gateMessages([], ['Amount'], ['Call'])).toEqual(['Amount', 'Call']);
	});

	// New Phase 2 tests
	it('normalizes ISO datetimes to yyyy-MM-dd and preserves original time when merging', () => {
		expect(toDateInputValue('2025-12-21T10:30:00')).toBe('2025-12-21');
		expect(toDateInputValue('2025-12-21T00:00:00.000Z')).toBe('2025-12-21');
		expect(toDateInputValue('')).toBe('');
		expect(toDateInputValue(null)).toBe('');

		expect(mergeDateWithOriginalTime('2025-12-25', '2025-12-21T10:30:00')).toBe('2025-12-25T10:30:00');
		expect(mergeDateWithOriginalTime('2025-12-25', '2025-12-21')).toBe('2025-12-25');
		expect(mergeDateWithOriginalTime('2025-12-25', null)).toBe('2025-12-25');
		expect(mergeDateWithOriginalTime('', '2025-12-21T10:30:00')).toBeNull();
	});

	it('resolves passed stages accurately for Lost deals with and without prior stage history', () => {
		const stages = [
			stage({ Id: 1, Sort: 1, Outcome: 'Open', IsPassed: true }),
			stage({ Id: 2, Sort: 2, Outcome: 'Open', IsPassed: true }),
			stage({ Id: 3, Sort: 3, Outcome: 'Open', IsPassed: true }),
			stage({ Id: 9, Sort: 9, Outcome: 'Lost', IsCurrent: true, IsPassed: false }),
		];

		// Synced Lost deal with no prior non-Lost stage in history
		const unknownRes = resolveStageStates(stages, [{ Id: 10, IDFromStage: null, IDToStage: 9 }], true);
		expect(unknownRes.hasUnknownPriorStages).toBeTrue();
		expect(unknownRes.stages.every((s) => !s.effectivePassed)).toBeTrue();
		expect(stageColor(unknownRes.stages[0])).toBe('medium');
		expect(stageColor(unknownRes.stages[3])).toBe('danger');

		// Lost deal that actually moved from stage 2 -> Lost (stage 3 was skipped, not passed)
		const knownRes = resolveStageStates(stages, [{ Id: 11, IDFromStage: 2, IDToStage: 9 }], true);
		expect(knownRes.hasUnknownPriorStages).toBeFalse();
		expect(knownRes.stages.map((s) => s.effectivePassed)).toEqual([true, true, false, false]);

		// Open deal keeps BE IsPassed untouched
		const openRes = resolveStageStates(stages, [], false);
		expect(openRes.hasUnknownPriorStages).toBeFalse();
		expect(openRes.stages.map((s) => s.effectivePassed)).toEqual([true, true, true, false]);
	});

	it('resolves stage color name with fallbacks and exposes css variables, order on the chain', () => {
		expect(stageColorName({ Color: 'warning', Outcome: 'Open' })).toBe('warning');
		expect(stageColorName({ Color: '', Outcome: 'Lost' })).toBe('danger');
		expect(stageColorName({ Color: undefined, Outcome: 'Won' })).toBe('success');
		expect(stageColorName({ Color: undefined, Outcome: 'Open' })).toBe('primary');
		expect(stageColorName({ Color: 'red;}', Outcome: 'Open' })).toBe('primary');

		const views = applyChainState(
			resolveStageStates([stage({ Id: 1, Sort: 1, Color: 'tertiary', IsCurrent: true }), stage({ Id: 9, Sort: 9, Outcome: 'Lost' })], [], false).stages
		);
		expect(views.map((s) => s.order)).toEqual([1, 2]);
		expect(views[0].colorVar).toBe('var(--ion-color-tertiary)');
		expect(views[0].contrastVar).toBe('var(--ion-color-tertiary-contrast)');
		expect(views[1].colorVar).toBe('var(--ion-color-danger)');
	});

	it('builds pipeline options: recommended first, then score, with stage counts and current flag', () => {
		const rows = buildPipelineOptions(
			[
				{ Id: 1, Name: 'Wedding', Icon: 'heart-outline', Color: 'danger' },
				{ Id: 2, Name: 'Corporate' },
				{ Id: 3, Name: 'Birthday' },
			],
			[
				{ IDPipeline: 1, Score: 40, Reasons: ['Personal customer'] },
				{ IDPipeline: 3, Score: 70, Reasons: ['Guests < 50'] },
			],
			{ 1: { TotalStages: 8 }, 2: { Stages: [{}, {}, {}] }, 3: null },
			1,
			3
		);
		expect(rows.map((r) => r.IDPipeline)).toEqual([3, 1, 2]);
		expect(rows[0].isRecommended).toBeTrue();
		expect(rows[0].stageCount).toBeNull();
		expect(rows[0].Icon).toBe('git-branch-outline');
		expect(rows[0].Color).toBe('primary');
		expect(rows[1].isCurrent).toBeTrue();
		expect(rows[1].stageCount).toBe(8);
		expect(rows[1].Icon).toBe('heart-outline');
		expect(rows[1].Color).toBe('danger');
		expect(rows[1].reasons).toEqual(['Personal customer']);
		expect(rows[2].stageCount).toBe(3);
		expect(rows[2].score).toBeNull();
	});

	it('defaults the composer "mark as completed" to checked for Note/Call and unchecked for Appointment/Checklist', () => {
		expect(defaultMarkDone('Note')).toBeTrue();
		expect(defaultMarkDone('Call')).toBeTrue();
		expect(defaultMarkDone('Appointment')).toBeFalse();
		expect(defaultMarkDone('Checklist')).toBeFalse();
		expect(defaultMarkDone(undefined)).toBeFalse();
	});

	it('maps stage views to chain states: current active, passed done, others upcoming (Lost stays upcoming/current)', () => {
		const stages = [
			stage({ Id: 1, Sort: 1, IsPassed: true }),
			stage({ Id: 2, Sort: 2, IsCurrent: true }),
			stage({ Id: 3, Sort: 3 }),
			stage({ Id: 9, Sort: 9, Outcome: 'Lost' }),
		];
		const views = applyChainState(resolveStageStates(stages, [], false).stages);
		expect(views.map((s) => s.chainState)).toEqual(['done', 'current', 'future', 'future']);
		expect(views[3].Outcome).toBe('Lost');

		const lost = applyChainState(resolveStageStates([stage({ Id: 1, Sort: 1, IsPassed: true }), stage({ Id: 9, Sort: 9, Outcome: 'Lost', IsCurrent: true })], [], true).stages);
		expect(lost.map((s) => s.chainState)).toEqual(['future', 'current']);
		expect(stageChainState({ ...stages[0], effectivePassed: true })).toBe('done');
	});

	it('computes stage age metrics and flags overdue expected days or SLA hours for open deals', () => {
		const now = new Date('2026-11-20T12:00:00');
		const info = stageAgeMetrics('2026-11-17T08:00:00', 2, 24, false, now);
		expect(info).toEqual({ days: 3, hours: 76, isOverExpected: true, isOverSla: true });

		const closedInfo = stageAgeMetrics('2026-11-17T08:00:00', 2, 24, true, now);
		expect(closedInfo?.isOverExpected).toBeFalse();
		expect(closedInfo?.isOverSla).toBeFalse();

		expect(stageAgeMetrics(null, 2, 24, false, now)).toBeNull();
	});

	it('classifies task due status and summarizes stage tasks with next best task', () => {
		const now = new Date('2026-11-20T15:00:00');
		expect(classifyTaskDue('2026-11-19T10:00:00', 'Open', now)).toBe('overdue');
		expect(classifyTaskDue('2026-11-20T09:00:00', 'Open', now)).toBe('due-today');
		expect(classifyTaskDue('2026-11-23T09:00:00', 'Open', now)).toBe('upcoming');
		expect(classifyTaskDue('2026-11-19T10:00:00', 'Done', now)).toBe('none');

		const s = stage({
			Tasks: [
				task({ Id: 1, Status: 'Done', IsRequired: true, IDActivity: 100 }),
				task({ Id: 2, Name: 'Send quote', Status: 'Open', IsRequired: true, DueDate: '2026-11-19T00:00:00' }),
				task({ Id: 3, Name: 'Follow up', Status: 'Open', IsRequired: false, DueDate: '2026-11-20T00:00:00' }),
			],
		});
		const summary = summarizeStageTasks(s, now);
		expect(summary.total).toBe(3);
		expect(summary.done).toBe(1);
		expect(summary.requiredDone).toBe(1);
		expect(summary.requiredTotal).toBe(2);
		expect(summary.requiredPercent).toBe(50);
		expect(summary.overdueCount).toBe(1);
		expect(summary.dueTodayCount).toBe(1);
		expect(summary.uninitializedCount).toBe(2);
		expect(summary.nextRequiredTask?.Id).toBe(2);
	});

	it('maps stages to contextual action groups', () => {
		expect(stageActionGroup(stage({ Outcome: 'Lost', Name: 'Hủy deal' }))).toBe('lost');
		expect(stageActionGroup(stage({ Name: 'Báo giá', Tasks: [task({ TaskType: 'Document', DocumentType: 'Quotation' })] }))).toBe('quote');
		expect(stageActionGroup(stage({ Name: 'Ký hợp đồng & đặt cọc', Tasks: [task({ TaskType: 'Document', DocumentType: 'Contract' })] }))).toBe('signed');
		expect(stageActionGroup(stage({ Name: 'Thanh toán hoàn tất', Outcome: 'Done' }))).toBe('paid');
		expect(stageActionGroup(stage({ Name: 'Trung tâm tư vấn & khảo sát sảnh' }))).toBe('consult');
		expect(stageActionGroup(stage({ Name: 'Chốt chi tiết & chuẩn bị' }))).toBe('prepare');
		expect(stageActionGroup(stage({ Name: 'Tổ chức sự kiện' }))).toBe('event');
		expect(stageActionGroup(stage({ Name: 'Tiếp nhận & tư vấn' }))).toBe('lead');
	});

	it('resolves lost stage info and builds filtered activity timeline', () => {
		const stages = [
			stage({ Id: 4, Name: 'Báo giá', Outcome: 'Open' }),
			stage({ Id: 9, Name: 'Hủy deal', Outcome: 'Lost' }),
		];
		const lostKnown = resolveLostStageInfo(
			[{ Id: 2, IDFromStage: 4, FromStageName: 'Báo giá', IDToStage: 9, ToStageName: 'Hủy deal', CreatedDate: '2026-11-18T10:00:00', CreatedBy: 'sales' }],
			{ Id: 557, ClosedDate: '2026-11-18T10:00:00' },
			stages
		);
		expect(lostKnown).toEqual({ stageWhenLost: 'Báo giá', isUnknownPrior: false, lostDate: '2026-11-18T10:00:00', lostBy: 'sales' });

		const lostUnknown = resolveLostStageInfo(
			[{ Id: 1, IDFromStage: null, FromStageName: null, IDToStage: 9, ToStageName: 'Hủy deal' }],
			{ Id: 557, ClosedDate: '2026-11-18T10:00:00' },
			stages
		);
		expect(lostUnknown.isUnknownPrior).toBeTrue();
		expect(lostUnknown.stageWhenLost).toBeNull();

		const events = buildActivityTimeline({
			opportunity: { Id: 556, CreatedDate: '2026-11-10T08:00:00', CreatedBy: 'bot', QualifiedDate: '2026-11-11T09:00:00' },
			history: [{ Id: 1, FromStageName: 'Mới', ToStageName: 'Báo giá', CreatedDate: '2026-11-15T10:00:00', CreatedBy: 'hung' }],
			activities: [
				{ Id: 10, TaskType: 'Call', Name: 'Called bride', Status: 'Done', CompletedDate: '2026-11-16T12:00:00' },
				{ Id: 11, TaskType: 'Document', Name: 'Quote', Status: 'Open', DueDate: '2026-11-17T00:00:00' },
			],
		});
		expect(events.length).toBe(5);
		expect(events.find((e) => e.id === 'ms-created-556')?.color).toBe('success');
		expect(events[0].id).toBe('act-11'); // newest first
		expect(filterTimelineEvents(events, 'stage').length).toBe(1);
		expect(filterTimelineEvents(events, 'note_call').map((e) => e.id)).toEqual(['act-10']);
		expect(filterTimelineEvents(events, 'milestone').length).toBe(2);
	});

	it('counts timeline events per filter, builds stage map, sums and due map', () => {
		const events = buildActivityTimeline({
			opportunity: { Id: 1, CreatedDate: '2026-11-10T08:00:00' },
			history: [{ Id: 1, FromStageName: 'A', ToStageName: 'B', CreatedDate: '2026-11-11T08:00:00' }],
			activities: [
				{ Id: 5, TaskType: 'Note', Name: 'n', Status: 'Done', CompletedDate: '2026-11-12T08:00:00' },
				{ Id: 6, TaskType: 'Checklist', Name: 'c', Status: 'Open', DueDate: '2026-11-13T00:00:00' },
			],
			entityLogs: [{ Id: 9, Date: '2026-11-14T08:00:00', _label: 'Update' }],
		});
		expect(countTimelineByFilter(events)).toEqual({ all: 5, stage: 1, activity: 2, note_call: 1, milestone: 1, edit: 1 });
		expect(countTimelineByFilter([]).all).toBe(0);

		const map = buildStageMap([stage({ Id: 3, Name: 'X' }), stage({ Id: 4, Name: 'Y' })]);
		expect(map[4].Name).toBe('Y');
		expect(buildStageMap(null as any)).toEqual({});

		expect(sumBy([{ Amount: 10 }, { Amount: '5' }, { Amount: null }], 'Amount')).toBe(15);
		expect(sumBy(null as any, 'Amount')).toBe(0);

		const now = new Date('2026-11-20T10:00:00');
		const due = buildTaskDueMap([task({ Id: 1, DueDate: '2026-11-19', Status: 'Open' }), task({ Id: 2, Status: 'Open' })], now);
		expect(due).toEqual({ 1: 'overdue', 2: 'none' });
	});

	it('detects missing required fields for a target stage', () => {
		const target = stage({ RequiredFields: ['Amount', 'EventDate', 'NumberOfGuests'] });
		expect(missingRequiredFields(target, { Amount: 50000000, EventDate: '', NumberOfGuests: 0 })).toEqual(['EventDate']);
	});

	it('picks the main button of a task row from its type and the documents of the deal', () => {
		const noDocs = { quotations: 0, contracts: 0 };
		const withDocs = { quotations: 1, contracts: 2 };
		const quote = task({ TaskType: 'Document', DocumentType: 'Quotation', Status: 'Open' });
		const contract = task({ TaskType: 'Document', DocumentType: 'Contract', Status: 'Open' });

		expect(taskAction(quote, noDocs)?.kind).toBe('new-quotation');
		expect(taskAction(quote, withDocs)?.kind).toBe('open-quotation');
		expect(taskAction({ ...quote, Status: 'Done' }, noDocs)).toBeNull();
		expect(taskAction({ ...quote, Status: 'Done' }, withDocs)?.kind).toBe('open-quotation');
		expect(taskAction(contract, noDocs)?.kind).toBe('new-contract');
		expect(taskAction(contract, withDocs)?.kind).toBe('open-contract');
		expect(taskAction(task({ TaskType: 'Document', DocumentType: 'Deposit' }), noDocs)).toEqual({ kind: 'activity', label: 'Update', icon: 'create-outline' });

		expect(taskAction(task({ TaskType: 'Call' }), noDocs)?.label).toBe('Log call');
		expect(taskAction(task({ TaskType: 'Appointment' }), noDocs)?.label).toBe('Schedule');
		expect(taskAction(task({ TaskType: 'Email' }), noDocs)?.label).toBe('Log email');
		expect(taskAction(task({ TaskType: 'Call', Status: 'Done' }), noDocs)).toBeNull();
		expect(taskAction(task({ TaskType: 'Checklist' }), noDocs)).toBeNull();
		expect(taskAction(task({ TaskType: 'Note' }), noDocs)).toBeNull();
		expect(taskAction(null as any, noDocs)).toBeNull();

		const map = buildTaskActionMap([task({ Id: 1, TaskType: 'Call' }), task({ Id: 2, TaskType: 'Checklist' }), quote], noDocs);
		expect(Object.keys(map)).toEqual(['1']);
		expect(buildTaskActionMap(null as any, noDocs)).toEqual({});
	});

	it('keeps only the events of one stage when the timeline is scoped to it', () => {
		const ev = (id: string, kind: TimelineEvent['kind'], raw: any): TimelineEvent => ({ id, kind, title: id, date: '', dateMs: 0, icon: '', color: '', raw });
		const events = [
			ev('a1', 'activity', { IDStage: 5 }),
			ev('a2', 'activity', { IDStage: 6 }),
			ev('s-in', 'stage', { IDFromStage: 4, IDToStage: 5 }),
			ev('s-out', 'stage', { IDFromStage: 5, IDToStage: 6 }),
			ev('s-other', 'stage', { IDFromStage: 6, IDToStage: 7 }),
			ev('m', 'milestone', {}),
			ev('e', 'edit', {}),
		];
		expect(filterTimelineByStage(events, 5).map((e) => e.id)).toEqual(['a1', 's-in', 's-out']);
		expect(filterTimelineByStage(events, null).length).toBe(7);
		expect(filterTimelineByStage(null as any, 5)).toEqual([]);
	});

	it('groups sorted timeline events by local calendar day for the journal', () => {
		const at = (id: string, y: number, m: number, d: number, h: number): TimelineEvent => ({
			id,
			kind: 'activity',
			title: id,
			date: '',
			dateMs: new Date(y, m - 1, d, h, 30).getTime(),
			icon: '',
			color: '',
		});
		const groups = groupTimelineByDay([at('a', 2026, 11, 20, 23), at('b', 2026, 11, 20, 1), at('c', 2026, 11, 19, 12), at('d', 2026, 11, 20, 9)]);
		expect(groups.map((g) => g.key)).toEqual(['2026-11-20', '2026-11-19', '2026-11-20']);
		expect(groups[0].events.map((e) => e.id)).toEqual(['a', 'b']);
		expect(groups[0].dayMs).toBe(new Date(2026, 10, 20).getTime());
		expect(groupTimelineByDay(null as any)).toEqual([]);
	});

	describe('timeline day gaps', () => {
		const at = (id: string, y: number, m: number, d: number, h = 10): TimelineEvent => ({
			id,
			kind: 'activity',
			title: id,
			date: '',
			dateMs: new Date(y, m - 1, d, h, 0).getTime(),
			icon: '',
			color: '',
		});

		it('computes calendar day gaps regardless of the time of day', () => {
			expect(calendarDayGap(new Date(2026, 10, 20).getTime(), new Date(2026, 10, 20).getTime())).toBe(0);
			expect(calendarDayGap(new Date(2026, 10, 20).getTime(), new Date(2026, 10, 19).getTime())).toBe(1);
			expect(calendarDayGap(new Date(2026, 10, 19).getTime(), new Date(2026, 10, 23).getTime())).toBe(4);
			// across a month and a year boundary
			expect(calendarDayGap(new Date(2027, 0, 2).getTime(), new Date(2026, 11, 30).getTime())).toBe(3);
		});

		it('keeps one solid connector for the same day and for adjacent days', () => {
			const groups = groupTimelineByDay([at('a', 2026, 11, 20, 23), at('b', 2026, 11, 20, 1), at('c', 2026, 11, 19, 12)]);
			expect(groups.length).toBe(2);
			expect(groups[0].gapDays).toBe(0);
			expect(groups[1].gapDays).toBe(1);
			expect(groups.every((g) => !g.longGapBefore && !g.longGapAfter)).toBeTrue();
		});

		it('flags a dashed connector from 2 calendar days apart on both sides of the gap', () => {
			const groups = groupTimelineByDay([at('a', 2026, 11, 23), at('b', 2026, 11, 20), at('c', 2026, 11, 19), at('d', 2026, 11, 10)]);
			expect(groups.map((g) => g.gapDays)).toEqual([0, 3, 1, 9]);
			expect(groups.map((g) => g.longGapBefore)).toEqual([false, true, false, true]);
			expect(groups.map((g) => g.longGapAfter)).toEqual([true, false, true, false]);
		});

		it('treats exactly 2 days as long but late-night to early-morning of adjacent days as short', () => {
			const two = groupTimelineByDay([at('a', 2026, 11, 22, 1), at('b', 2026, 11, 20, 23)]);
			expect(two[1].longGapBefore).toBeTrue();
			const near = groupTimelineByDay([at('a', 2026, 11, 20, 0), at('b', 2026, 11, 19, 23)]);
			expect(near[1].longGapBefore).toBeFalse();
		});

		it('ignores entries without a valid date', () => {
			const bad: TimelineEvent = { ...at('x', 2026, 11, 20), dateMs: NaN };
			const groups = groupTimelineByDay([at('a', 2026, 11, 20), bad]);
			expect(groups[1].key).toBe('unknown');
			expect(groups[1].longGapBefore).toBeFalse();
			expect(groups[0].longGapAfter).toBeFalse();
		});
	});
});

describe('docsInLeftColumn (masonry of the detail workspace)', () => {
	it('puts Documents under Activities when the activity column is shorter', () => {
		expect(docsInLeftColumn(200, 600, true)).toBeTrue();
	});

	it('keeps Documents under Main information when the activity column is taller or equal', () => {
		expect(docsInLeftColumn(800, 600, true)).toBeFalse();
		expect(docsInLeftColumn(600, 600, true)).toBeFalse();
	});

	it('never moves Documents to the left in the single-column layout', () => {
		expect(docsInLeftColumn(0, 600, false)).toBeFalse();
	});

	it('keeps Documents on the right when the info column is not measured yet', () => {
		expect(docsInLeftColumn(200, 0, true)).toBeFalse();
	});
});


describe('toggleComposerType (Activities quick composer chips)', () => {
	it('selects a chip when none is open', () => {
		expect(toggleComposerType(null, 'Note')).toBe('Note');
		expect(toggleComposerType(undefined, 'Call')).toBe('Call');
	});

	it('switches to another chip', () => {
		expect(toggleComposerType('Note', 'Call')).toBe('Call');
	});

	it('collapses when the same chip is tapped again', () => {
		expect(toggleComposerType('Appointment', 'Appointment')).toBeNull();
	});
});

describe('iconButtonSlot (narrow screens hide the label)', () => {
	it('uses icon-only when the label is hidden', () => {
		expect(iconButtonSlot(true)).toBe('icon-only');
	});

	it('uses start when the label is shown', () => {
		expect(iconButtonSlot(false)).toBe('start');
	});
});

describe('nextInfoLevel (Main information 3-step expand)', () => {
	it('cycles 0 → 1 → 2 → 0', () => {
		expect(nextInfoLevel(0)).toBe(1);
		expect(nextInfoLevel(1)).toBe(2);
		expect(nextInfoLevel(2)).toBe(0);
	});

	it('clamps invalid values into the cycle', () => {
		expect(nextInfoLevel(-1)).toBe(1);
		expect(nextInfoLevel(9)).toBe(0);
		expect(nextInfoLevel(Number.NaN)).toBe(1);
	});
});

describe('branchNameById (Branch as plain text on the detail)', () => {
	const items = [
		{ Id: 1, Name: 'Tổng công ty' },
		{ Id: 2, Name: 'ADORA SM' },
		{ Id: 3, Name: 'Le DONG PHUONG' },
	];

	it('returns the name of the matching branch', () => {
		expect(branchNameById(items, 3)).toBe('Le DONG PHUONG');
	});

	it('matches ids loosely (string vs number)', () => {
		expect(branchNameById(items, '2' as unknown as number)).toBe('ADORA SM');
	});

	it('returns empty string when the id is missing or unknown', () => {
		expect(branchNameById(items, null)).toBe('');
		expect(branchNameById(items, undefined)).toBe('');
		expect(branchNameById(items, 99)).toBe('');
	});

	it('returns empty string when the list is not loaded yet', () => {
		expect(branchNameById(null, 3)).toBe('');
		expect(branchNameById(undefined, 3)).toBe('');
	});
});
