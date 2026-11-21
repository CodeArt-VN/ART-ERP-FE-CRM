import {
	CAPACITY_FIELDS,
	HALL_KINDS,
	HALL_KIND_COLORS,
	HALL_KIND_ICONS,
	MAX_QUICK_LINES,
	buildQuickLines,
	capacityErrors,
	conflictReason,
	centerOptions,
	countLines,
	defaultCenter,
	explainSaveFailure,
	centerDivider,
	floorDivider,
	SAVE_FAILED_KEY,
	hallErrors,
	hallKindColor,
	hallKindIcon,
	lineCode,
	lineErrors,
	missingLineNos,
	newLine,
	nextLineNo,
	normalizeHallNumbers,
	parseLineCount,
	primaryCapacity,
	slugName,
	suggestHallCode,
	toLinePayload,
} from './hall.util';

describe('hall.util', () => {
	describe('hall code', () => {
		it('slugName drops accents, maps Đ and joins with dashes', () => {
			expect(slugName('Cát Tường')).toBe('CAT-TUONG');
			expect(slugName('  Đại sảnh  (A) ')).toBe('DAI-SANH-A');
			expect(slugName('')).toBe('');
			expect(slugName(null)).toBe('');
		});

		it('suggestHallCode matches the seeded shape and is empty when a part is missing', () => {
			expect(suggestHallCode('DP1', 'Crystal')).toBe('DP1-CRYSTAL');
			expect(suggestHallCode('DP2', 'VIP 1')).toBe('DP2-VIP-1');
			expect(suggestHallCode('DP3', 'Cát Tường')).toBe('DP3-CAT-TUONG');
			expect(suggestHallCode('', 'Crystal')).toBe('');
			expect(suggestHallCode('DP1', '   ')).toBe('');
		});

		it('lineCode appends -L<k> and is empty without a hall code', () => {
			expect(lineCode('DP1-CRYSTAL', 2)).toBe('DP1-CRYSTAL-L2');
			expect(lineCode('', 2)).toBe('');
		});
	});

	describe('kind colour and icon', () => {
		it('every hall kind has a colour and an icon, unknown kinds fall back', () => {
			HALL_KINDS.forEach((k) => {
				expect(hallKindColor(k)).toBe(HALL_KIND_COLORS[k]);
				expect(hallKindIcon(k)).toBe(HALL_KIND_ICONS[k]);
			});
			expect(hallKindColor('VIP')).toBe('warning');
			expect(hallKindColor('Outdoor')).toBe('success');
			expect(hallKindColor('Other')).toBe('medium');
			expect(hallKindIcon('Other')).toBe('business-outline');
		});

		it('colours are Ionic tokens, never hex', () => {
			Object.values(HALL_KIND_COLORS).forEach((c) => expect(c.startsWith('#')).toBeFalse());
		});
	});

	describe('numbers', () => {
		it('normalizeHallNumbers turns empty into null, strings into numbers, keeps the branch a number', () => {
			const out = normalizeHallNumbers({ IDBranch: '24', CapTheater: '1,200', AreaSqm: '350.5', MinGuests: '', MaxGuests: null, Name: 'A' });
			expect(out.IDBranch).toBe(24);
			expect(out.CapTheater).toBe(1200);
			expect(out.AreaSqm).toBe(350.5);
			expect(out.MinGuests).toBeNull();
			expect(out.MaxGuests).toBeNull();
			expect(out.Name).toBe('A');
		});

		it('normalizeHallNumbers leaves absent keys absent (dirty values only)', () => {
			expect('CapCircle' in normalizeHallNumbers({ Name: 'A' })).toBeFalse();
		});
	});

	describe('capacity validation', () => {
		it('accepts a blank capacity and equal / ordered min and max', () => {
			expect(capacityErrors({})).toEqual([]);
			expect(capacityErrors({ MinGuests: 100, MaxGuests: 100, MinTables: 10, MaxTables: 30 })).toEqual([]);
			expect(capacityErrors({ MinGuests: '', MaxGuests: 50 })).toEqual([]);
		});

		it('rejects negative numbers and non-numbers', () => {
			expect(capacityErrors({ CapCircle: -1 })).toContain('Numbers cannot be negative');
			expect(capacityErrors({ AreaSqm: -0.5 })).toContain('Numbers cannot be negative');
			expect(capacityErrors({ CapCircle: 'abc' })).toContain('Please enter valid numbers');
		});

		it('rejects a fractional capacity but allows a fractional area', () => {
			expect(capacityErrors({ CapTheater: 10.5 })).toContain('Capacity must be whole numbers');
			expect(capacityErrors({ AreaSqm: 10.5 })).toEqual([]);
		});

		it('requires max >= min for guests and tables', () => {
			expect(capacityErrors({ MinGuests: 200, MaxGuests: 100 })).toEqual(['Max guests must be greater than or equal to min guests']);
			expect(capacityErrors({ MinTables: 20, MaxTables: 10 })).toEqual(['Max tables must be greater than or equal to min tables']);
		});

		it('hallErrors needs a center and a name', () => {
			expect(hallErrors({})).toEqual(['Center is required', 'Name is required']);
			expect(hallErrors({ IDBranch: 24, Name: '  ' })).toEqual(['Name is required']);
			expect(hallErrors({ IDBranch: 24, Name: 'Crystal', MinGuests: 5, MaxGuests: 1 })).toEqual(['Max guests must be greater than or equal to min guests']);
			expect(hallErrors({ IDBranch: 24, Name: 'Crystal' })).toEqual([]);
		});

		it('lineErrors needs a whole line number from 1 and a name', () => {
			expect(lineErrors({ Name: 'Line 1' })).toEqual(['Line number must be a whole number from 1']);
			expect(lineErrors({ LineNo: 0, Name: 'Line 1' })).toEqual(['Line number must be a whole number from 1']);
			expect(lineErrors({ LineNo: 1.5, Name: 'Line 1' })).toEqual(['Line number must be a whole number from 1']);
			expect(lineErrors({ LineNo: 2, Name: '' })).toEqual(['Name is required']);
			expect(lineErrors({ LineNo: '3', Name: 'Line 3' })).toEqual([]);
		});
	});

	describe('primary capacity', () => {
		it('picks the largest layout with its label', () => {
			expect(primaryCapacity({ CapCircle: 300, CapTheater: 600, CapBuffet: 450 })).toEqual({ value: 600, label: 'Theater' });
		});

		it('keeps the first layout on a tie', () => {
			expect(primaryCapacity({ CapCircle: 300, CapBuffet: 300 })).toEqual({ value: 300, label: 'Round table' });
		});

		it('falls back to MaxGuests without a layout, and to null when empty', () => {
			expect(primaryCapacity({ MaxGuests: 400 })).toEqual({ value: 400, label: null });
			expect(primaryCapacity({ CapCircle: 0, MaxGuests: null })).toBeNull();
			expect(primaryCapacity({})).toBeNull();
			expect(primaryCapacity(null)).toBeNull();
		});

		it('every layout has a distinct column and label', () => {
			expect(CAPACITY_FIELDS.length).toBe(7);
			expect(new Set(CAPACITY_FIELDS.map((c) => c.id)).size).toBe(7);
			expect(new Set(CAPACITY_FIELDS.map((c) => c.label)).size).toBe(7);
		});
	});

	describe('lines', () => {
		const hall = { Id: 5, Code: 'DP1-CRYSTAL', IDBranch: 24 };

		it('missingLineNos and nextLineNo skip the numbers that exist', () => {
			expect(missingLineNos([], 3)).toEqual([1, 2, 3]);
			expect(missingLineNos([{ LineNo: 2 }], 3)).toEqual([1, 3]);
			expect(missingLineNos([{ LineNo: 1 }, { LineNo: 2 }, { LineNo: 3 }], 3)).toEqual([]);
			expect(nextLineNo([])).toBe(1);
			expect(nextLineNo([{ LineNo: 1 }, { LineNo: 3 }])).toBe(2);
			expect(nextLineNo([{ LineNo: 1 }, { LineNo: 2 }])).toBe(3);
		});

		it('buildQuickLines creates only the missing lines with code, name, branch and sort', () => {
			const rows = buildQuickLines(hall, [{ LineNo: 2 }], 3);
			expect(rows.map((r) => r.LineNo)).toEqual([1, 3]);
			expect(rows.map((r) => r.Code)).toEqual(['DP1-CRYSTAL-L1', 'DP1-CRYSTAL-L3']);
			expect(rows.map((r) => r.Name)).toEqual(['Line 1', 'Line 3']);
			expect(rows.map((r) => r.Sort)).toEqual([1, 3]);
			rows.forEach((r) => {
				expect(r.IDParent).toBe(5);
				expect(r.IDBranch).toBe(24);
				expect(r.HallType).toBe('Line');
				expect(r.Id).toBe(0);
			});
		});

		it('buildQuickLines falls back to H<id> when the hall has no code', () => {
			expect(buildQuickLines({ Id: 9, IDBranch: 24 }, [], 1)[0].Code).toBe('H9-L1');
		});

		it('newLine proposes the next free number', () => {
			const l = newLine(hall, [{ LineNo: 1 }]);
			expect(l.LineNo).toBe(2);
			expect(l.Code).toBe('DP1-CRYSTAL-L2');
			expect(l.Name).toBe('Line 2');
			expect(l.IDParent).toBe(5);
		});

		it('parseLineCount accepts whole numbers 1..max only', () => {
			expect(parseLineCount('3')).toBe(3);
			expect(parseLineCount(MAX_QUICK_LINES)).toBe(MAX_QUICK_LINES);
			expect(parseLineCount(MAX_QUICK_LINES + 1)).toBeNull();
			expect(parseLineCount(0)).toBeNull();
			expect(parseLineCount('2.5')).toBeNull();
			expect(parseLineCount('')).toBeNull();
			expect(parseLineCount('x')).toBeNull();
		});

		it('toLinePayload drops UI fields, IsDisabled and an empty Code, and converts numbers', () => {
			const body = toLinePayload({ Id: 0, _checked: true, IsDisabled: false, Code: '', LineNo: '2', CapCircle: '', Name: 'Line 2', AreaSqm: '12.5' });
			expect(body).toEqual({ Id: 0, LineNo: 2, CapCircle: null, Name: 'Line 2', AreaSqm: 12.5 });
		});

		it('countLines counts per parent and ignores rows without one', () => {
			expect(countLines([{ IDParent: 1 }, { IDParent: 1 }, { IDParent: 2 }, {}])).toEqual({ 1: 2, 2: 1 });
			expect(countLines(null)).toEqual({});
		});
	});

	describe('conflictReason', () => {
		const others = [
			{ Id: 1, IDBranch: 24, HallType: 'Hall', Code: 'DP1-CRYSTAL', Name: 'Crystal' },
			{ Id: 2, IDBranch: 24, HallType: 'Line', IDParent: 1, LineNo: 1, Code: 'DP1-CRYSTAL-L1', Name: 'Line 1' },
			{ Id: 3, IDBranch: 25, HallType: 'Hall', Code: 'DP2-RUBY', Name: 'Ruby' },
		];

		it('finds a duplicate code in the same center, ignoring case and itself', () => {
			expect(conflictReason({ Id: 0, IDBranch: 24, HallType: 'Hall', Code: 'dp1-crystal', Name: 'X' }, others)).toBe('A hall with this code already exists in this center');
			expect(conflictReason({ Id: 1, IDBranch: 24, HallType: 'Hall', Code: 'DP1-CRYSTAL', Name: 'Crystal' }, others)).toBe('');
		});

		it('a code in another center is not a conflict', () => {
			expect(conflictReason({ Id: 0, IDBranch: 24, HallType: 'Hall', Code: 'DP2-RUBY', Name: 'Ruby 2' }, others)).toBe('');
		});

		it('finds a duplicate hall name in the same center', () => {
			expect(conflictReason({ Id: 0, IDBranch: 24, HallType: 'Hall', Code: 'NEW', Name: ' crystal ' }, others)).toBe('A hall with this name already exists in this center');
		});

		it('a line may reuse a hall name but not a line number of its hall', () => {
			expect(conflictReason({ Id: 0, IDBranch: 24, HallType: 'Line', IDParent: 1, LineNo: 3, Code: 'X', Name: 'Crystal' }, others)).toBe('');
			expect(conflictReason({ Id: 0, IDBranch: 24, HallType: 'Line', IDParent: 1, LineNo: 1, Code: 'X', Name: 'Other' }, others)).toBe('This line number already exists in this hall');
		});
	});

	describe('centers', () => {
		const dp = [
			{ Id: 24, Code: 'DP1', Name: 'Adora 1' },
			{ Id: 25, Code: 'DP2', Name: 'Adora 2' },
		];

		it('centerOptions keeps DP branches only, flags disabled ones and skips job titles', () => {
			const opts = centerOptions([{ Id: 1, Code: 'ROOT', Name: 'Root' }, { Id: 24, Code: 'DP1', Name: 'Adora 1', disabled: true }, { Id: 25, Code: 'dp2', Name: 'Adora 2' }, { Id: 9, Code: 'DP3', Type: 'TitlePosition' }]);
			expect(opts.map((o) => o.Id)).toEqual([24, 25]);
			expect(opts[0].disabled).toBeTrue();
			expect(opts[1].disabled).toBeFalse();
		});

		it('centerOptions offers every branch when none is a DP center', () => {
			expect(centerOptions([{ Id: 1, Code: 'A', Name: 'A' }, { Id: 2, Code: 'B', Name: 'B' }]).map((o) => o.Id)).toEqual([1, 2]);
			expect(centerOptions(null)).toEqual([]);
		});

		it('defaultCenter prefers the selected branch, then a single center below it', () => {
			expect(defaultCenter(dp, 25, [1, 24, 25])).toBe(25);
			expect(defaultCenter(dp, 1, [1, 24])).toBe(24);
			expect(defaultCenter(dp, 1, [1, 24, 25])).toBeNull();
			expect(defaultCenter(dp, 1, null)).toBeNull();
			expect(defaultCenter([], 1, [1])).toBeNull();
		});
	});

	describe('centerDivider', () => {
		const branches = [{ Id: 24, Name: 'The ADORA Center' }, { Id: 25, Name: 'Adora Plaza' }];
		const page1 = [{ Id: 1, IDBranch: 24 }, { Id: 2, IDBranch: 24 }, { Id: 3, IDBranch: 25 }];
		const labels = (rows: any[]) => rows.map((r, i) => centerDivider(r, i, rows, branches));

		it('puts the center name only on the first hall of each center', () => {
			expect(labels(page1)).toEqual(['The ADORA Center', null, 'Adora Plaza']);
		});

		it('does not repeat a divider when the next page continues the same center', () => {
			const all = [...page1, { Id: 4, IDBranch: 25 }, { Id: 5, IDBranch: 26 }];
			expect(labels(all)).toEqual(['The ADORA Center', null, 'Adora Plaza', null, null]);
		});

		it('gives no divider to a hall without a center or with an unknown one', () => {
			expect(centerDivider({ Id: 1 }, 0, [{ Id: 1 }], branches)).toBeNull();
			expect(centerDivider({ Id: 1, IDBranch: 99 }, 0, [{ Id: 1, IDBranch: 99 }], branches)).toBeNull();
			expect(centerDivider({ Id: 1, IDBranch: 24 }, 0, [{ Id: 1, IDBranch: 24 }], null)).toBeNull();
		});
	});

	describe('floorDivider', () => {
		const rows = [
			{ Id: 1, IDBranch: 24, Floor: '1' },
			{ Id: 2, IDBranch: 24, Floor: '1' },
			{ Id: 3, IDBranch: 24, Floor: 'G' },
			{ Id: 4, IDBranch: 25, Floor: 'G' },
			{ Id: 5, IDBranch: 25, Floor: null },
			{ Id: 6, IDBranch: 25, Floor: '' },
		];
		const labels = (list: any[]) => list.map((r, i) => floorDivider(r, i, list, 'Tầng'));

		it('labels the first hall of each floor and nothing in between', () => {
			expect(labels(rows)).toEqual(['Tầng 1', null, 'Tầng G', 'Tầng G', '—', null]);
		});

		it('starts a floor again when the center changes even if the floor text is the same', () => {
			expect(floorDivider(rows[3], 3, rows, 'Tầng')).toBe('Tầng G');
		});

		it('continues the last floor when the next page appends rows, without repeating the label', () => {
			const all = [...rows.slice(0, 3), { Id: 7, IDBranch: 24, Floor: 'G' }, { Id: 8, IDBranch: 24, Floor: '2' }];
			expect(labels(all)).toEqual(['Tầng 1', null, 'Tầng G', null, 'Tầng 2']);
		});

		it('falls back to the English word and tolerates a missing item', () => {
			expect(floorDivider({ IDBranch: 1, Floor: '3' }, 0, [{ IDBranch: 1, Floor: '3' }], '')).toBe('Floor 3');
			expect(floorDivider(null, 0, [], 'Floor')).toBeNull();
		});
	});

	describe('explainSaveFailure', () => {
		it('names the broken rule from the rows of the same center', async () => {
			const rows = [{ Id: 1, IDBranch: 24, HallType: 'Hall', Code: 'DP1-CRYSTAL', Name: 'Crystal' }];
			let asked: any;
			const msg = await explainSaveFailure(async (q) => ((asked = q), rows), { Id: 0, IDBranch: 24, HallType: 'Hall', Code: 'DP1-CRYSTAL', Name: 'Other' });
			expect(msg).toBe('A hall with this code already exists in this center');
			expect(asked.IDBranch).toBe(24);
			expect(asked.IsDisabled).toBe('skipped');
		});

		it('falls back to the generic key when nothing matches or the lookup fails', async () => {
			expect(await explainSaveFailure(async () => [], { Id: 0, IDBranch: 24, HallType: 'Hall', Code: 'A', Name: 'B' })).toBe(SAVE_FAILED_KEY);
			expect(await explainSaveFailure(async () => Promise.reject('x'), { Id: 0, IDBranch: 24 })).toBe(SAVE_FAILED_KEY);
		});
	});
});
