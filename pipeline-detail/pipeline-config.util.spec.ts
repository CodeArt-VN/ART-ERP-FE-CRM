import { POST_SIGN_LABELS, POST_SIGN_MODES, TASK_ICONS, TASK_TYPES, changedSortRows, renumberRows, buildStageRows, buildStageRowsFromPlan, newStage, outcomeColor, newTask, nextSort, ruleErrors, stageErrors, taskErrors, tasksOfStage, toPayload, ruleConditions, ruleScore } from './pipeline-config.util';

describe('pipeline-config.util', () => {
	it('every task type has an icon', () => {
		TASK_TYPES.forEach((t) => expect(TASK_ICONS[t]).toBeTruthy());
	});

	it('renumberRows numbers rows from 1 and changedSortRows returns only moved rows', () => {
		const before = [
			{ Id: 1, Sort: 1 },
			{ Id: 2, Sort: 2 },
			{ Id: 3, Sort: 3 },
		];
		// drag 3 to the front; the list component writes 0-based values, renumberRows fixes them
		const dragged = renumberRows([{ Id: 3, Sort: 0 }, { Id: 1, Sort: 1 }, { Id: 2, Sort: 2 }]);
		expect(dragged.map((r) => r.Sort)).toEqual([1, 2, 3]);
		expect(changedSortRows(dragged, before).map((r) => r.Id)).toEqual([3, 1, 2]);
		expect(changedSortRows(renumberRows([{ Id: 1 }, { Id: 2 }, { Id: 3 }]), before)).toEqual([]);
	});

	it('every post-sign mode has a label', () => {
		POST_SIGN_MODES.forEach((m) => expect(POST_SIGN_LABELS[m]).toBeTruthy());
	});

	it('outcomeColor maps every outcome', () => {
		expect(['Open', 'Won', 'Done', 'Lost'].map(outcomeColor)).toEqual(['primary', 'warning', 'success', 'danger']);
	});

	it('buildStageRows lists stages as roots and tasks under them with unique ids', () => {
		const stages = [{ Id: 1, Sort: 1, Name: 'A', ExpectedDays: 2 }, { Id: 2, Sort: 2, Name: 'B' }];
		const tasks = [{ Id: 1, IDStage: 1, Sort: 2, Name: 't2', DueOffsetDays: null }, { Id: 2, IDStage: 1, Sort: 1, Name: 't1', DueOffsetDays: 3 }];
		const rows = buildStageRows(stages, tasks);
		expect(rows.map((r) => r.Id)).toEqual(['S1', 'S2', 'T2', 'T1']);
		expect(rows.map((r) => r.IDParent)).toEqual([null, null, 'S1', 'S1']);
		expect(rows[0].TaskCount).toBe(2);
		expect(rows[1].TaskCount).toBe(0);
		expect(rows[2].Days).toBe(3);
		expect(rows[3].Days).toBe(0);
		expect(rows[2].Stage).toBe(stages[0]);
		expect(rows[2].Task).toBe(tasks[1]);
		expect(new Set(rows.map((r) => r.Id)).size).toBe(rows.length);
	});

	it('buildStageRowsFromPlan flattens nested Plan.Tasks into the same tree shape', () => {
		expect(buildStageRowsFromPlan(null)).toEqual([]);
		const rows = buildStageRowsFromPlan({
			Stages: [
				{ Id: 10, Name: 'A', Outcome: 'Open', Probability: 10, Tasks: [{ Id: 1, Name: 't1', TaskType: 'Call', IsRequired: true }] },
				{ Id: 20, Name: 'B', Outcome: 'Won', Probability: 100, Tasks: [] },
			],
		});
		expect(rows.map((r) => r.Id)).toEqual(['S10', 'S20', 'T1']);
		expect(rows[2].IDParent).toBe('S10');
		expect(rows[2].IsRequired).toBeTrue();
		expect(rows[0].TaskCount).toBe(1);
	});

	it('nextSort returns max + 1', () => {
		expect(nextSort([])).toBe(1);
		expect(nextSort([{ Sort: 3 }, { Sort: 7 }, {}])).toBe(8);
	});

	it('newStage / newTask link to their parents and get the next sort', () => {
		const s = newStage({ Id: 5 }, [{ Sort: 2 }]);
		expect(s.IDPipeline).toBe(5);
		expect(s.Sort).toBe(3);
		const t = newTask({ Id: 9, IDPipeline: 5 }, []);
		expect(t.IDStage).toBe(9);
		expect(t.IDPipeline).toBe(5);
		expect(t.Sort).toBe(1);
	});

	it('tasksOfStage filters and sorts', () => {
		const rows = [
			{ IDStage: 1, Sort: 2, Name: 'b' },
			{ IDStage: 2, Sort: 1, Name: 'x' },
			{ IDStage: 1, Sort: 1, Name: 'a' },
		];
		expect(tasksOfStage(rows, 1).map((r) => r.Name)).toEqual(['a', 'b']);
	});

	it('toPayload strips UI fields, drops an empty Code and converts numbers', () => {
		const stage = toPayload({ Id: 0, Name: 'Báo giá', Code: '', Probability: '40', ExpectedDays: '', _new: true, _open: true });
		expect(stage._new).toBeUndefined();
		expect('Code' in stage).toBeFalse();
		expect(stage.Probability).toBe(40);
		expect(stage.ExpectedDays).toBeNull();
		expect(toPayload({ Name: 'Seeded', Code: 'WEDDING.S1' }).Code).toBe('WEDDING.S1');
		const rule = toPayload({ Name: 'Big wedding', MinGuests: '', MaxGuests: '500', CustomerType: '', IDServiceType: '' });
		expect(rule.MinGuests).toBeNull();
		expect(rule.MaxGuests).toBe(500);
		expect(rule.CustomerType).toBeNull();
		expect(rule.IDServiceType).toBeNull();
	});

	it('validates stage, task and rule rows', () => {
		expect(stageErrors({ Name: '' }).length).toBe(1);
		expect(stageErrors({ Name: 'A', Probability: 120 }).length).toBe(1);
		expect(stageErrors({ Name: 'A', Probability: 50 })).toEqual([]);
		expect(taskErrors({ Name: 'A', IDStage: 1, TaskType: 'Document' }).length).toBe(1);
		expect(taskErrors({ Name: 'A', IDStage: 1, TaskType: 'Document', DocumentType: 'Contract' })).toEqual([]);
		expect(taskErrors({ Name: 'A', TaskType: 'Call' })).toEqual(['Stage is required']);
		expect(ruleErrors({ Name: 'A', MinGuests: 10, MaxGuests: 5 }).length).toBe(1);
		expect(ruleErrors({ Name: 'A', MinGuests: '', MaxGuests: 5 })).toEqual([]);
	});

	describe('rule score and chips', () => {
		it('a rule without conditions scores only its priority and has no chips', () => {
			expect(ruleScore({ Priority: 7 })).toBe(7);
			expect(ruleConditions({ Priority: 7 })).toEqual([]);
		});

		it('every condition adds 100, min and max guests count as two', () => {
			expect(ruleScore({ IDServiceType: 5670, Priority: 5 })).toBe(105);
			expect(ruleScore({ IDServiceType: 1, CustomerType: 'Personal', CustomerHistory: 'New', MinGuests: 10, MaxGuests: 50, Priority: 3 })).toBe(503);
			expect(ruleScore({ IDTargetBranch: 12, Priority: 0 })).toBe(100);
		});

		it('treats empty strings and null as no condition, and 0 guests as a condition', () => {
			expect(ruleScore({ IDServiceType: null, CustomerType: null, MinGuests: '', MaxGuests: null, Priority: 1 })).toBe(1);
			expect(ruleScore({ MinGuests: 0, Priority: 0 })).toBe(100);
		});

		it('builds one chip per condition with the guest range formatted', () => {
			const name = (id: number) => (id === 5670 ? 'Wedding' : '');
			const chips = ruleConditions({ IDServiceType: 5670, CustomerType: 'Personal', CustomerHistory: 'New', MinGuests: 50, MaxGuests: 200 }, name);
			expect(chips.map((c) => c.kind)).toEqual(['service', 'customer', 'history', 'guests']);
			expect(chips[0].text).toBe('Wedding');
			expect(chips[0].translate).toBeFalse();
			expect(chips[1].translate).toBeTrue();
			expect(chips[3].text).toBe('50–200');
			expect(ruleConditions({ MinGuests: 50 })[0].text).toBe('≥ 50');
			expect(ruleConditions({ MaxGuests: 200 })[0].text).toBe('≤ 200');
		});

		it('falls back to the id when the service type is unknown', () => {
			expect(ruleConditions({ IDServiceType: 77 })[0].text).toBe('#77');
		});
	});
});
