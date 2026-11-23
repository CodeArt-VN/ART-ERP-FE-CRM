import {
	applyHallCalendarRowHover,
	applyHallEventFocus,
	bookingOverlapsSlot,
	bookingResourceId,
	bookingToEvent,
	buildHallResourceTree,
	buildTimeSlots,
	collectGroupResources,
	dayCountInclusive,
	formatHallCount,
	groupSlotSubtotalEvents,
	hallCalendarSlotUnit,
	hallIdsWithLinesFrom,
	isBookableLeaf,
	resolveHallResourceIdAtY,
	resolveHallResourceIdFromPointer,
} from './hall-booking-calendar.util';

describe('hall-booking-calendar.util', () => {
	const getCss = (n: string) => (n.includes('danger') ? '#eb445a' : n.includes('warning') ? '#ffc409' : n.includes('dark') ? '#111' : '#ccc');

	it('bookingToEvent maps resource and colors; hall-with-lines → hall:{id}', () => {
		const e = bookingToEvent(
			{ Id: 9, IDHall: 3, Status: 'Hold', OpportunityName: 'Opp A', DateTimeFrom: '2026-12-01T11:00:00', DateTimeTo: '2026-12-01T15:00:00' },
			getCss
		);
		expect(e.resourceId).toBe('3');
		expect(e.title).toBe('Opp A');
		expect(e.backgroundColor).toBe('#ffc409');
		expect(bookingResourceId({ IDHall: 2 }, new Set([2]))).toBe('hall:2');
		expect(hallIdsWithLinesFrom([{ Id: 2 }, { Id: 3 }], [{ Id: 21, IDParent: 2 }]).has(2)).toBe(true);
	});

	it('applyHallEventFocus marks matching booking / opportunity', () => {
		const base = [
			bookingToEvent({ Id: 1, IDHall: 3, IDOpportunity: 10, Status: 'Hold', DateTimeFrom: '2027-01-23T17:00:00', DateTimeTo: '2027-01-23T21:00:00' }, getCss),
			bookingToEvent({ Id: 2, IDHall: 4, IDOpportunity: 11, Status: 'Confirmed', DateTimeFrom: '2027-01-23T17:00:00', DateTimeTo: '2027-01-23T21:00:00' }, getCss),
		];
		const byId = applyHallEventFocus(base, { bookingId: 2 });
		expect(byId[0].classNames || []).not.toContain('hall-event-focus');
		expect(byId[1].classNames).toContain('hall-event-focus');
		const byOpp = applyHallEventFocus(base, { opportunityId: 10 });
		expect(byOpp[0].classNames).toContain('hall-event-focus');
		expect(byOpp[1].classNames || []).not.toContain('hall-event-focus');
	});

	it('formatHallCount hides zero', () => {
		expect(dayCountInclusive('2026-11-16', '2026-11-22')).toBe(7);
		expect(formatHallCount(3)).toBe('3');
		expect(formatHallCount(0)).toBe('');
	});

	it('hallCalendarSlotUnit: Day→hour, Week/Month→day', () => {
		expect(hallCalendarSlotUnit('resourceTimelineDay')).toBe('hour');
		expect(hallCalendarSlotUnit('resourceTimelineWeek')).toBe('day');
		expect(hallCalendarSlotUnit('resourceTimelineMonth')).toBe('day');
	});

	it('buildHallResourceTree nests; left Subtotal only on leaf halls/lines when > 0', () => {
		const tree = buildHallResourceTree({
			branches: [{ Id: 24, Name: 'The ADORA Center' }],
			halls: [
				{ Id: 1, IDBranch: 24, Name: 'Amber', Floor: '1', Sort: 1 },
				{ Id: 2, IDBranch: 24, Name: 'Ruby', Floor: '1', Sort: 2 },
				{ Id: 3, IDBranch: 24, Name: 'Marble', Floor: '2', Sort: 1 },
				{ Id: 4, IDBranch: 24, Name: 'Empty', Floor: '2', Sort: 2 },
			],
			lines: [
				{ Id: 21, IDParent: 2, IDBranch: 24, Name: 'Line 1', LineNo: 1 },
				{ Id: 22, IDParent: 2, IDBranch: 24, Name: 'Line 2', LineNo: 2 },
			],
			bookings: [
				{ Id: 100, IDHall: 1 },
				{ Id: 101, IDHall: 21 },
				{ Id: 102, IDHall: 3 },
			],
			floorLabel: (f) => (f ? `Floor ${f}` : 'Floor'),
		});

		expect(tree[0].Subtotal).toBe('3');
		expect(tree[0].bookingCount).toBe(3);
		const floor1 = tree[0].children[0];
		expect(floor1.Subtotal).toBe('2');
		expect(floor1.children[0].Subtotal).toBe('1');
		expect(isBookableLeaf(floor1.children[0])).toBe(true);
		// hall-group left Subtotal = hall + line bookings
		expect(floor1.children[1].id).toBe('hall:2');
		expect(floor1.children[1].Subtotal).toBe('1'); // booking 101 on line 21
		expect(floor1.children[1].children[0].Subtotal).toBe('1');
		expect(floor1.children[1].children[1].Subtotal).toBe('');
		expect(tree[0].children[1].children[1].Subtotal).toBe(''); // Empty hall → blank
		expect(bookingResourceId({ IDHall: 2 }, hallIdsWithLinesFrom([{ Id: 2 }], [{ Id: 21, IDParent: 2 }]))).toBe('hall:2');
	});

	it('buildTimeSlots day/hour and groupSlotSubtotalEvents', () => {
		const days = buildTimeSlots(new Date('2026-11-16T00:00:00'), new Date('2026-11-17T23:59:59'), 'day');
		expect(days.length).toBe(2);
		const hours = buildTimeSlots(new Date('2026-11-16T00:00:00'), new Date('2026-11-16T02:30:00'), 'hour');
		expect(hours.length).toBe(3);

		expect(
			bookingOverlapsSlot(
				{ DateTimeFrom: '2026-11-16T10:00:00', DateTimeTo: '2026-11-16T14:00:00' },
				new Date('2026-11-16T00:00:00'),
				new Date('2026-11-17T00:00:00')
			)
		).toBe(true);

		const tree = buildHallResourceTree({
			branches: [{ Id: 24, Name: 'Center' }],
			halls: [
				{ Id: 1, IDBranch: 24, Name: 'A', Floor: '1' },
				{ Id: 2, IDBranch: 24, Name: 'B', Floor: '1' },
			],
			bookings: [],
		});
		const groups = collectGroupResources(tree);
		expect(groups.some((g) => g.id.startsWith('floor:'))).toBe(true);

		const bookings = [
			{ Id: 1, IDHall: 1, DateTimeFrom: '2026-11-16T10:00:00', DateTimeTo: '2026-11-16T14:00:00' },
			{ Id: 2, IDHall: 2, DateTimeFrom: '2026-11-16T11:00:00', DateTimeTo: '2026-11-16T12:00:00' },
		];
		const ev = groupSlotSubtotalEvents(groups.filter((g) => g.nodeType === 'floor'), bookings, days.slice(0, 1), getCss);
		expect(ev.length).toBe(1);
		expect(ev[0].title).toBe('2');
		expect(ev[0].backgroundColor).toBe('transparent');
		expect(ev[0].display).toBe('background');
		expect(ev[0].extendedProps.isSubtotal).toBe(true);
	});

	it('applyHallCalendarRowHover toggles only datagrid cells + timeline lane', () => {
		const root = document.createElement('div');
		const label = document.createElement('td');
		label.className = 'fc-datagrid-cell';
		label.setAttribute('data-resource-id', 'floor:24:1');
		const lane = document.createElement('td');
		lane.className = 'fc-timeline-lane';
		lane.setAttribute('data-resource-id', 'floor:24:1');
		const other = document.createElement('div');
		other.setAttribute('data-resource-id', 'floor:24:1');
		const otherRes = document.createElement('td');
		otherRes.className = 'fc-datagrid-cell';
		otherRes.setAttribute('data-resource-id', '3');
		root.append(label, lane, other, otherRes);

		expect(applyHallCalendarRowHover(root, 'floor:24:1')).toBe('floor:24:1');
		expect(label.classList.contains('hall-row-hover')).toBe(true);
		expect(lane.classList.contains('hall-row-hover')).toBe(true);
		expect(other.classList.contains('hall-row-hover')).toBe(false);
		expect(otherRes.classList.contains('hall-row-hover')).toBe(false);

		expect(applyHallCalendarRowHover(root, null)).toBeNull();
		expect(label.classList.contains('hall-row-hover')).toBe(false);
		expect(lane.classList.contains('hall-row-hover')).toBe(false);
	});

	it('resolveHallResourceIdAtY / FromPointer maps timeline slots by Y', () => {
		const root = document.createElement('div');
		const lane = document.createElement('td');
		lane.className = 'fc-timeline-lane';
		lane.setAttribute('data-resource-id', '3');
		lane.getBoundingClientRect = () =>
			({ top: 100, bottom: 130, left: 0, right: 100, width: 100, height: 30, x: 0, y: 100, toJSON() {} }) as DOMRect;
		const slots = document.createElement('div');
		slots.className = 'fc-timeline-slots';
		const slot = document.createElement('td');
		slot.className = 'fc-timeline-slot';
		slots.appendChild(slot);
		root.append(lane, slots);

		expect(resolveHallResourceIdAtY(root, 110)).toBe('3');
		expect(resolveHallResourceIdAtY(root, 200)).toBeNull();
		expect(resolveHallResourceIdFromPointer(root, slot, 110)).toBe('3');
		expect(resolveHallResourceIdFromPointer(root, document.createElement('div'), 110)).toBeNull();
	});
});

