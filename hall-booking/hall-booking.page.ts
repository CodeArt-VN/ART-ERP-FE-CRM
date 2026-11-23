import { Component, inject, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { APIList } from 'src/app/services/static/global-variable';
import { lib } from 'src/app/services/static/global-functions';
import { CRM_HallBookingProvider, CRM_HallProvider, CRM_OpportunityProvider } from 'src/app/services/static/services.service';
import { centerOptions } from '../hall-detail/hall.util';
import {
	applyHallCalendarRowHover,
	buildHallResourceTree,
	buildTimeSlots,
	collectGroupResources,
	applyHallEventFocus,
	eventsFromBookings,
	groupSlotSubtotalEvents,
	hallIdsWithLinesFrom,
	HallSlotUnit,
	hallCalendarSlotUnit,
	isBookableLeaf,
	resolveHallResourceIdFromPointer,
} from './hall-booking-calendar.util';
import {
	emptyHallBookingFilter,
	filterBookingRows,
	filterLineRows,
	HallBookingFilterState,
	hideUnbookedHallsAndLines,
	isHallBookingFilterActive,
	leafIdsForHalls,
	applyKeywordFilter,
} from './hall-booking-filter.util';
import { bookableHallSelectOptions, hallBookingViewFromQuery, parseDateTimeLocal, toDateTimeLocalValue } from './hall-booking.util';
import { HallBookModalPage } from './hall-book-modal.page';
import { HallBookingFilterModalPage } from './hall-booking-filter-modal.page';
import { HallBookingListModalPage } from './hall-booking-list-modal.page';

@Component({
	selector: 'app-hall-booking',
	templateUrl: 'hall-booking.page.html',
	styleUrls: ['hall-booking.page.scss'],
	standalone: false,
})
export class HallBookingPage extends PageBase {
	private translate = inject(TranslateService);
	@ViewChild('calendar') calendarComponent: FullCalendarComponent;

	hallRows: any[] = [];
	lineRows: any[] = [];
	/** Full catalogue in branch scope — filter chip options (Floor/Kind) stay stable while search is active. */
	catalogueHallRows: any[] = [];
	catalogueLineRows: any[] = [];
	bookingRows: any[] = [];
	visibleHallCount = 0;
	fc: any = null;
	resourcesExpanded = true;
	hideUnbooked = false;
	filterState: HallBookingFilterState = emptyHallBookingFilter();
	private loadingRange = false;
	private pendingReload = false;
	/** Skip datesSet→reload while we push resources/events (setOption can re-enter datesSet). */
	private suppressDatesSet = false;
	private lastVisibleRangeKey = '';
	private hallHoverWired = false;
	private hallHoverResourceId: string | null = null;
	/** Prevent stacked HallBook modals when FC fires select + other handlers together. */
	private bookModalOpen = false;
	/** Deep-link from opportunity (?date=&view=week&booking=&idOpportunity=). */
	private focusDate: Date | null = null;
	private focusView: string | null = null;
	private focusBookingId: number | null = null;
	private focusOpportunityId: number | null = null;

	get filterActive(): boolean {
		return isHallBookingFilterActive(this.filterState);
	}

	/** Chips shown on the empty overlay (datatable-style) so the user can clear filters. */
	get activeFilterChips(): { key: string; label: string; displayValue: string }[] {
		const f = this.filterState || emptyHallBookingFilter();
		const chips: { key: string; label: string; displayValue: string }[] = [];
		if (f.Keyword?.trim()) chips.push({ key: 'Keyword', label: 'Search', displayValue: f.Keyword.trim() });
		if (f.IDBranches?.length) {
			const names = this.branchMeta()
				.filter((c) => f.IDBranches.includes(Number(c.Id)))
				.map((c) => c.Name || String(c.Id));
			chips.push({ key: 'IDBranches', label: 'Center', displayValue: names.join(', ') || String(f.IDBranches.length) });
		}
		if (f.Floors?.length) {
			const floorWord = this.translate.instant('Floor') || 'Floor';
			chips.push({
				key: 'Floors',
				label: 'Floor',
				displayValue: f.Floors.map((x) => `${floorWord} ${x}`).join(', '),
			});
		}
		if (f.HallKinds?.length) {
			chips.push({
				key: 'HallKinds',
				label: 'Hall type',
				displayValue: f.HallKinds.map((k) => this.translate.instant(k) || k).join(', '),
			});
		}
		if (f.Statuses?.length) {
			chips.push({
				key: 'Statuses',
				label: 'Status',
				displayValue: f.Statuses.map((s) => this.translate.instant(s) || s).join(', '),
			});
		}
		if (this.hideUnbooked) {
			chips.push({ key: 'hideUnbooked', label: 'Hide unbooked halls', displayValue: 'On' });
		}
		return chips;
	}

	get emptySubMessage(): string {
		const n = this.activeFilterChips.length;
		if (n === 1) return 'Try clearing the filter below';
		if (n > 1) return 'Try clearing the filters below';
		return 'Please check again';
	}

	calendarOptions: any = {
		plugins: [resourceTimelinePlugin, interactionPlugin],
		schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
		initialView: 'resourceTimelineWeek',
		height: '100%',
		timeZone: 'local',
		aspectRatio: 1.5,
		headerToolbar: false,
		firstDay: 1,
		weekends: true,
		nowIndicator: true,
		selectable: true,
		selectMirror: true,
		editable: false,
		resourcesInitiallyExpanded: true,
		resourceAreaWidth: '320px',
		/** Shared column width for Day / Week / Month (do not override per view). */
		slotMinWidth: 120,
		views: {
			resourceTimelineDay: {
				slotDuration: '01:00',
				slotLabelFormat: [{ hour: '2-digit', minute: '2-digit', hour12: false }],
			},
			resourceTimelineWeek: {
				slotDuration: { days: 1 },
				dayHeaderFormat: { weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: true },
			},
			/** One column per calendar day across the visible month. */
			resourceTimelineMonth: {
				type: 'resourceTimeline',
				duration: { months: 1 },
				slotDuration: { days: 1 },
				slotLabelFormat: [{ weekday: 'short', day: 'numeric', omitCommas: true }],
			},
		},
		slotLabelFormat: [{ weekday: 'short', day: '2-digit', month: '2-digit', omitCommas: true }],
		resourceAreaColumns: [
			{
				field: 'Name',
				headerContent: () => this.buildNameHeader(),
				width: 220,
				cellContent: (arg) => {
					const el = document.createElement('div');
					const t = arg.resource.extendedProps?.nodeType || '';
					el.className = 'hall-resource-name' + (t ? ` is-${t}` : '');
					el.innerText = arg.resource.extendedProps?.Name || arg.resource.title || '';
					return { domNodes: [el] };
				},
			},
			{
				field: 'Subtotal',
				headerClassNames: ['hall-col-subtotal'],
				cellClassNames: (arg: any) => {
					const t = arg?.resource?.extendedProps?.nodeType;
					const cls = ['hall-col-subtotal'];
					if (t === 'branch' || t === 'floor') cls.push('hall-row-subtotal');
					return cls;
				},
				headerContent: () => {
					const el = document.createElement('div');
					el.className = 'hall-resource-subtotal-header';
					el.textContent = this.translate.instant('Subtotal') || 'Σ';
					return { domNodes: [el] };
				},
				width: 64,
				cellContent: (arg) => {
					const el = document.createElement('div');
					el.className = 'hall-resource-subtotal';
					const text = arg.resource.extendedProps?.Subtotal || '';
					el.innerText = text;
					if (text) el.title = text;
					return { domNodes: [el] };
				},
			},
		],
		resources: [],
		events: [],
		/** Subtotal cells: number only — suppress FC time label ("12a") and event chrome. */
		eventContent: (arg: any) => {
			if (arg?.event?.extendedProps?.isSubtotal) {
				const el = document.createElement('div');
				el.className = 'hall-slot-subtotal-num';
				el.textContent = String(arg.event.extendedProps.count ?? arg.event.title ?? '');
				return { domNodes: [el] };
			}
			return true;
		},
		resourceLaneClassNames: (arg: any) => {
			const t = arg?.resource?.extendedProps?.nodeType;
			return t === 'branch' || t === 'floor' ? ['hall-row-subtotal'] : [];
		},
		resourceLabelClassNames: (arg: any) => {
			const t = arg?.resource?.extendedProps?.nodeType;
			return t === 'branch' || t === 'floor' ? ['hall-row-subtotal'] : [];
		},
		datesSet: this.onDatesSet.bind(this),
		// selectable already fires `select` on a single-cell click — do NOT also bind dateClick
		// or one tap opens two (or more) book modals.
		select: this.onSelect.bind(this),
		eventClick: this.onEventClick.bind(this),
	};

	constructor(
		public pageProvider: CRM_HallBookingProvider,
		public hallProvider: CRM_HallProvider,
		public opportunityProvider: CRM_OpportunityProvider,
		public modalController: ModalController,
		public popoverCtrl: PopoverController,
		public alertCtrl: AlertController,
		public loadingController: LoadingController,
		public env: EnvService,
		public navCtrl: NavController,
		public location: Location,
		public route: ActivatedRoute
	) {
		super();
		this.pageConfig.ShowAdd = false;
		this.pageConfig.ShowDelete = false;
		this.pageConfig.ShowArchive = false;
		this.pageConfig.ShowSearch = false;
		this.pageConfig.isShowFeature = false;
		this.pageConfig.ShowFeature = false;
		this.pageConfig.isFeatureAsMain = false;
	}

	/**
	 * Branch filter for API: current branch + descendants.
	 * `selectedBranchAndChildren` is GenCode Query JSON (`[id,…]`); strip nulls so BE parse matches list APIs.
	 */
	get branchQuery(): any {
		const kids = this.env.selectedBranchAndChildren;
		if (kids == null || kids === '') return this.env.selectedBranch || null;
		if (Array.isArray(kids)) {
			const ids = kids.map(Number).filter((n) => Number.isFinite(n) && n > 0);
			return ids.length ? JSON.stringify(ids) : this.env.selectedBranch || null;
		}
		if (typeof kids === 'string') {
			const cleaned = kids
				.replace(/\[|\]/g, '')
				.split(',')
				.map((s) => Number(String(s).trim()))
				.filter((n) => Number.isFinite(n) && n > 0);
			return cleaned.length ? JSON.stringify(cleaned) : this.env.selectedBranch || null;
		}
		return this.env.selectedBranch || null;
	}

	private parseBranchScopeIds(): number[] {
		const kids = this.env.selectedBranchAndChildren;
		if (Array.isArray(kids)) return kids.map(Number).filter((n) => Number.isFinite(n));
		if (typeof kids === 'string' && kids.trim()) {
			try {
				const parsed = JSON.parse(kids);
				if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => Number.isFinite(n));
			} catch {
				/* ignore */
			}
		}
		return this.env.selectedBranch ? [Number(this.env.selectedBranch)] : [];
	}

	preLoadData(event?: any): void {
		this.applyDeepLinkQuery(this.route.snapshot.queryParamMap);
		super.preLoadData(event);
	}

	/** Read ?date=&view=&booking=&idOpportunity= from the URL (opportunity deep-link). */
	private applyDeepLinkQuery(qp: { get: (name: string) => string | null }) {
		const dateStr = (qp?.get?.('date') || '').trim();
		let d: Date | null = null;
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
		if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
		else d = parseDateTimeLocal(dateStr);
		if (d) {
			this.focusDate = d;
			this.calendarOptions.initialDate = d;
		}
		const view = hallBookingViewFromQuery(qp?.get?.('view'));
		if (view) {
			this.focusView = view;
			this.calendarOptions.initialView = view;
		}
		const bid = Number(qp?.get?.('booking'));
		this.focusBookingId = Number.isFinite(bid) && bid > 0 ? bid : null;
		const oid = Number(qp?.get?.('idOpportunity') || qp?.get?.('IDOpportunity'));
		this.focusOpportunityId = Number.isFinite(oid) && oid > 0 ? oid : null;
	}

	async loadData(event?: any) {
		this.pageConfig.showSpinner = true;
		try {
			await this.loadHallResources();
			await this.reloadEventsForVisibleRange();
		} finally {
			this.pageConfig.showSpinner = false;
			this.loadedData(event);
			setTimeout(() => {
				this.fc = this.calendarComponent?.getApi?.();
				if (this.focusView) this.fc?.changeView?.(this.focusView);
				if (this.focusDate) this.fc?.gotoDate?.(this.focusDate);
				this.fc?.updateSize?.();
				this.wireHallRowHover();
				this.wireNameHeaderExpander();
				this.scrollFocusEventIntoView();
			}, 50);
		}
	}

	/** After deep-link: scroll the highlighted booking into view if it is off-screen. */
	private scrollFocusEventIntoView() {
		const id = this.focusBookingId;
		if (!id) return;
		setTimeout(() => {
			const el = document.querySelector(`.fc-event.hall-event-focus, .fc-event[data-event-id="${id}"]`) as HTMLElement | null;
			el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
		}, 120);
	}

	/** Branch scope for APIs: filter Centers ∩ selectedBranchAndChildren, else selected scope. */
	private effectiveBranchQuery(): any {
		const centers = (this.filterState.IDBranches || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
		if (centers.length) return JSON.stringify(centers);
		return this.branchQuery;
	}

	/** Datatable-style query params pushed to HallBooking/Calendar (and hall list where applicable). */
	private calendarFilterQuery(): Record<string, any> {
		const f = this.filterState || emptyHallBookingFilter();
		const q: Record<string, any> = {};
		const kw = (f.Keyword || '').trim();
		if (kw) q.Keyword = kw;
		if (f.IDBranches?.length) q.IDBranches = JSON.stringify(f.IDBranches.map(Number));
		if (f.Floors?.length) q.Floors = JSON.stringify(f.Floors.map(String));
		if (f.HallKinds?.length) q.HallKinds = JSON.stringify(f.HallKinds.map(String));
		if (f.Statuses?.length) q.Statuses = JSON.stringify(f.Statuses.map(String));
		const branch = this.effectiveBranchQuery();
		if (branch != null) q.IDBranch = branch;
		return q;
	}

	async loadHallResources() {
		const branch = this.effectiveBranchQuery();
		const hq: any = { HallType: 'Hall', Take: 500, IsDisabled: false };
		if (branch != null) hq.IDBranch = branch;
		// Catalogue dims on hall list API (GenCode Floor_in / HallKind_in). Keyword stays on Calendar (guest text).
		const f = this.filterState || emptyHallBookingFilter();
		if (f.Floors?.length) hq.Floor_in = JSON.stringify(f.Floors.map(String));
		if (f.HallKinds?.length) hq.HallKind_in = JSON.stringify(f.HallKinds.map(String));

		const hallRes: any = await this.hallProvider.read(hq, true);
		this.hallRows = hallRes?.data || [];
		if (!this.filterActive) this.catalogueHallRows = this.hallRows;

		this.lineRows = [];
		if (this.hallRows.length) {
			const lq: any = {
				HallType: 'Line',
				Take: 2000,
				IsDisabled: false,
				IDParent: JSON.stringify(this.hallRows.map((h) => h.Id)),
			};
			if (branch != null) lq.IDBranch = branch;
			try {
				const lineRes: any = await this.hallProvider.read(lq, true);
				this.lineRows = lineRes?.data || [];
			} catch {
				this.lineRows = [];
			}
		}
		if (!this.filterActive) this.catalogueLineRows = this.lineRows;

		this.applyResourceTree(this.bookingRows);
	}

	private branchMeta(): { Id: number; Name?: string }[] {
		const centers = centerOptions(this.env.branchList);
		const source = this.catalogueHallRows.length ? this.catalogueHallRows : this.hallRows;
		const ids = new Set((source || []).map((h) => Number(h.IDBranch)).filter(Boolean));
		if (ids.size) return centers.filter((c) => ids.has(Number(c.Id)));
		const kids = this.parseBranchScopeIds();
		if (kids.length) return centers.filter((c) => kids.includes(Number(c.Id)));
		const id = this.env.selectedBranch;
		const hit = centers.find((c) => c.Id == id) || (this.env.branchList || []).find((b) => b?.Id == id);
		return hit ? [{ Id: hit.Id, Name: hit.Name }] : centers;
	}

	/**
	 * Name header label only — expand-all sits in FC's expander placeholder so "Tên" lines up with row names.
	 * Do not mutate the expander from here on every header paint (that re-enters FC and freezes the tab).
	 */
	private buildNameHeader(): { domNodes: HTMLElement[] } {
		const wrap = document.createElement('div');
		wrap.className = 'hall-name-header';
		wrap.textContent = this.translate.instant('Name') || 'Name';
		return { domNodes: [wrap] };
	}

	/** Idempotent: wire once; later calls only refresh icon/title. */
	private wireNameHeaderExpander() {
		const slot = document.querySelector(
			'app-hall-booking .fc-datagrid-header .fc-datagrid-cell:not(.hall-col-subtotal) .fc-datagrid-expander'
		) as HTMLElement | null;
		if (!slot) return;
		slot.classList.add('hall-header-expander');
		let btn = slot.querySelector('.hall-expand-toggle') as HTMLButtonElement | null;
		if (!btn) {
			slot.innerHTML = '';
			btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'hall-expand-toggle';
			const icon = document.createElement('span');
			icon.className = 'fc-icon';
			btn.appendChild(icon);
			btn.addEventListener('click', (ev) => {
				ev.preventDefault();
				ev.stopPropagation();
				this.toggleAllResources(!this.resourcesExpanded);
			});
			slot.appendChild(btn);
		}
		btn.title = this.translate.instant(this.resourcesExpanded ? 'Collapse all' : 'Expand all');
		const icon = btn.querySelector('.fc-icon') as HTMLElement | null;
		if (icon) {
			icon.className = 'fc-icon ' + (this.resourcesExpanded ? 'fc-icon-minus-square' : 'fc-icon-plus-square');
		}
	}

	private slotUnit(): HallSlotUnit {
		const view = this.calendarComponent?.getApi?.()?.view?.type || this.fc?.view?.type || this.calendarOptions.initialView;
		return hallCalendarSlotUnit(view);
	}

	/**
	 * Tree from rows already filtered by API (Keyword/Center/Floor/Kind/Status).
	 * Client only applies hide-unbooked + leaf id safety for events.
	 */
	private resolveVisible(bookings: any[]): { halls: any[]; lines: any[]; bookings: any[]; hallIdsWithLines: Set<number> } {
		let halls = this.hallRows || [];
		let lines = filterLineRows(this.lineRows || [], halls);
		const leafIds = leafIdsForHalls(halls, lines);
		let visibleBookings = filterBookingRows(bookings || [], leafIds);
		if (this.hideUnbooked) {
			const trimmed = hideUnbookedHallsAndLines(halls, lines, visibleBookings);
			halls = trimmed.halls;
			lines = trimmed.lines;
		}
		return { halls, lines, bookings: visibleBookings, hallIdsWithLines: hallIdsWithLinesFrom(halls, lines) };
	}

	private applyResourceTree(bookings: any[]): { resources: any[]; bookings: any[]; hallIdsWithLines: Set<number> } {
		const visible = this.resolveVisible(bookings);
		this.visibleHallCount = visible.halls.length;
		const floorWord = this.translate.instant('Floor') || 'Floor';
		const resources = buildHallResourceTree({
			halls: visible.halls,
			lines: visible.lines,
			branches: this.branchMeta(),
			bookings: visible.bookings,
			floorLabel: (f) => (f ? `${floorWord} ${f}` : floorWord),
		});
		this.calendarOptions.resources = resources;
		return { resources, bookings: visible.bookings, hallIdsWithLines: visible.hallIdsWithLines };
	}

	/**
	 * Push resources+events in one FC batch.
	 * Never setOption('resourceAreaColumns') here — that re-paints the header, re-wires the
	 * expander, and can re-enter FullCalendar until the tab freezes (seen on Search apply).
	 */
	private refreshCalendarView() {
		const { resources, bookings, hallIdsWithLines } = this.applyResourceTree(this.bookingRows);
		const events = this.buildCalendarEvents(bookings, resources, hallIdsWithLines);
		this.calendarOptions.resources = resources;
		this.calendarOptions.events = events;
		const api: any = this.calendarComponent?.getApi?.() || this.fc;
		if (!api) return;
		this.suppressDatesSet = true;
		const apply = () => {
			api.setOption('resources', resources);
			api.setOption('events', events);
		};
		try {
			if (typeof api.batchRendering === 'function') api.batchRendering(apply);
			else apply();
		} finally {
			// Release after FC + Angular settle; keep datesSet muted during that paint.
			requestAnimationFrame(() => {
				this.suppressDatesSet = false;
			});
		}
	}

	private availableFloors(): { Code: string; Name: string }[] {
		const floorWord = this.translate.instant('Floor') || 'Floor';
		const set = new Set<string>();
		(this.catalogueHallRows.length ? this.catalogueHallRows : this.hallRows || []).forEach((h) => {
			const f = String(h.Floor ?? '').trim();
			if (f) set.add(f);
		});
		return Array.from(set)
			.sort()
			.map((f) => ({ Code: f, Name: `${floorWord} ${f}` }));
	}

	private availableKinds(): { Code: string; Name: string }[] {
		const set = new Set<string>();
		(this.catalogueHallRows.length ? this.catalogueHallRows : this.hallRows || []).forEach((h) => {
			const k = String(h.HallKind || '').trim();
			if (k) set.add(k);
		});
		return Array.from(set)
			.sort()
			.map((c) => ({ Code: c, Name: this.translate.instant(c) || c }));
	}

	private buildCalendarEvents(bookings: any[], resources: any[], hallIdsWithLines?: Set<number>) {
		const getCss = (n: string) => lib.getCssVariableValue(n);
		const bookingEvents = applyHallEventFocus(eventsFromBookings(bookings, getCss, hallIdsWithLines), {
			bookingId: this.focusBookingId,
			opportunityId: this.focusOpportunityId,
		});
		const { from, to } = this.visibleRange();
		const slots = buildTimeSlots(from, to, this.slotUnit());
		const groups = collectGroupResources(resources);
		const subtotals = groupSlotSubtotalEvents(groups, bookings, slots, getCss);
		return [...bookingEvents, ...subtotals];
	}

	/** Calendar API with datatable-style filters; syncs hall rows from response Halls when searching. */
	private async fetchCalendarBookings(baseQ: any): Promise<any[]> {
		const apiPath = APIList.CRM_HallBooking.getCalendar;
		const q: any = { ...baseQ, ...this.calendarFilterQuery() };
		const res: any = await this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), q).toPromise();
		this.syncHallsFromCalendar(res);
		return res?.ActiveBookings || [];
	}

	/** When filters active, visible halls = Calendar.Halls (API already applied Keyword/Floor/…). */
	private syncHallsFromCalendar(res: any) {
		if (!this.filterActive) return;
		const halls = res?.Halls || [];
		const ids = new Set(halls.map((h: any) => Number(h.IDHall ?? h.Id)).filter((n: number) => Number.isFinite(n) && n > 0));
		const source = this.catalogueHallRows.length ? this.catalogueHallRows : this.hallRows;
		this.hallRows = (source || []).filter((h) => ids.has(Number(h.Id)));
		const lineSource = this.catalogueLineRows.length ? this.catalogueLineRows : this.lineRows;
		this.lineRows = filterLineRows(lineSource || [], this.hallRows);
		// Guest keyword: drop empty sibling lines (API kept parent hall only).
		const kw = (this.filterState.Keyword || '').trim();
		if (kw) {
			const keyed = applyKeywordFilter(this.hallRows, this.lineRows, res?.ActiveBookings || [], kw);
			this.hallRows = keyed.halls;
			this.lineRows = keyed.lines;
		}
	}

	/** Clear grid then reload halls + calendar from API (datatable search pattern). */
	private async applyFiltersFromApi() {
		this.bookingRows = [];
		this.visibleHallCount = 0;
		this.calendarOptions.events = [];
		this.calendarOptions.resources = [];
		const api: any = this.calendarComponent?.getApi?.() || this.fc;
		if (api) {
			this.suppressDatesSet = true;
			try {
				if (typeof api.batchRendering === 'function') {
					api.batchRendering(() => {
						api.setOption('resources', []);
						api.setOption('events', []);
					});
				} else {
					api.setOption('resources', []);
					api.setOption('events', []);
				}
			} finally {
				requestAnimationFrame(() => {
					this.suppressDatesSet = false;
				});
			}
		}
		this.pageConfig.showSpinner = true;
		try {
			await this.loadHallResources();
			await this.reloadEventsForVisibleRange();
		} finally {
			this.pageConfig.showSpinner = false;
		}
	}

	toggleAllResources(expand: boolean) {
		this.resourcesExpanded = expand;
		const api: any = this.calendarComponent?.getApi?.() || this.fc;
		if (!api?.dispatch) {
			this.calendarOptions.resourcesInitiallyExpanded = expand;
			this.applyResourceTree(this.bookingRows);
			return;
		}
		const store = api.getCurrentData?.()?.resourceStore || {};
		const parentIds = new Set<string>();
		Object.keys(store).forEach((id) => {
			const p = store[id]?.parentId;
			if (p) parentIds.add(p);
		});
		parentIds.forEach((id) => {
			api.dispatch({ type: 'SET_RESOURCE_ENTITY_EXPANDED', id, isExpanded: expand });
		});
		this.wireNameHeaderExpander();
	}

	onDatesSet() {
		if (this.suppressDatesSet) return;
		const { from, to } = this.visibleRange();
		const key = `${from.getTime()}:${to.getTime()}`;
		if (key === this.lastVisibleRangeKey) return;
		this.lastVisibleRangeKey = key;
		this.reloadEventsForVisibleRange();
	}

	private visibleRange(): { from: Date; to: Date } {
		const api = this.calendarComponent?.getApi?.() || this.fc;
		const start = api?.view?.activeStart ? new Date(api.view.activeStart) : new Date();
		const end = api?.view?.activeEnd ? new Date(api.view.activeEnd.getTime() - 1) : new Date(start.getTime() + 7 * 86400000);
		start.setHours(0, 0, 0, 0);
		end.setHours(23, 59, 59, 999);
		return { from: start, to: end };
	}

	async reloadEventsForVisibleRange() {
		// datesSet + loadData often overlap; never drop the later request.
		if (this.loadingRange) {
			this.pendingReload = true;
			return;
		}
		this.loadingRange = true;
		this.pendingReload = false;
		try {
			const { from, to } = this.visibleRange();
			const baseQ: any = {
				DateTimeFrom: toDateTimeLocalValue(from),
				DateTimeTo: toDateTimeLocalValue(to),
			};
			this.bookingRows = await this.fetchCalendarBookings(baseQ);
			this.refreshCalendarView();
		} catch {
			this.bookingRows = [];
			this.refreshCalendarView();
		} finally {
			this.loadingRange = false;
			if (this.pendingReload) {
				this.pendingReload = false;
				await this.reloadEventsForVisibleRange();
			}
		}
	}

	toggleHideUnbooked() {
		this.hideUnbooked = !this.hideUnbooked;
		this.refreshCalendarView();
	}

	async clearFilterChip(key: string) {
		if (key === 'hideUnbooked') {
			this.hideUnbooked = false;
			this.refreshCalendarView();
			return;
		}
		if (key === 'Keyword') {
			this.filterState = { ...this.filterState, Keyword: '' };
		} else if (key === 'IDBranches') {
			this.filterState = { ...this.filterState, IDBranches: [] };
		} else if (key === 'Floors') {
			this.filterState = { ...this.filterState, Floors: [] };
		} else if (key === 'HallKinds') {
			this.filterState = { ...this.filterState, HallKinds: [] };
		} else if (key === 'Statuses') {
			this.filterState = { ...this.filterState, Statuses: [] };
		}
		await this.applyFiltersFromApi();
	}

	async clearAllFilters() {
		this.filterState = emptyHallBookingFilter();
		this.hideUnbooked = false;
		await this.applyFiltersFromApi();
	}

	async openFilter() {
		const modal = await this.modalController.create({
			component: HallBookingFilterModalPage,
			cssClass: 'form-1column',
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
			componentProps: {
				filter: {
					Keyword: this.filterState.Keyword,
					IDBranches: [...(this.filterState.IDBranches || [])],
					Floors: [...(this.filterState.Floors || [])],
					HallKinds: [...(this.filterState.HallKinds || [])],
					Statuses: [...(this.filterState.Statuses || [])],
				},
				centers: this.branchMeta(),
				floors: this.availableFloors(),
				kinds: this.availableKinds(),
				statuses: [
					{ Code: 'Hold', Name: this.translate.instant('Hold') || 'Hold' },
					{ Code: 'Confirmed', Name: this.translate.instant('Confirmed') || 'Confirmed' },
				],
			},
		});
		await modal.present();
		const { data, role } = await modal.onWillDismiss();
		if (role === 'apply' && data) {
			this.filterState = data;
			await this.applyFiltersFromApi();
		}
	}

	fcToday() {
		this.calendarComponent?.getApi()?.today();
	}
	fcPrev() {
		this.calendarComponent?.getApi()?.prev();
	}
	fcNext() {
		this.calendarComponent?.getApi()?.next();
	}
	fcDay() {
		this.calendarComponent?.getApi()?.changeView('resourceTimelineDay');
	}
	fcWeek() {
		this.calendarComponent?.getApi()?.changeView('resourceTimelineWeek');
	}
	fcMonth() {
		this.calendarComponent?.getApi()?.changeView('resourceTimelineMonth');
	}

	/** Sync left label + right lane hover using the same token as app-data-table. */
	private wireHallRowHover() {
		const root = (this.calendarComponent?.getApi?.()?.el || this.fc?.el) as HTMLElement | undefined;
		if (!root) return;
		if ((root as any)._hallRowHoverBound) return;
		(root as any)._hallRowHoverBound = true;
		this.hallHoverWired = true;
		const sync = (ev: PointerEvent) => {
			const id = resolveHallResourceIdFromPointer(root, ev.target, ev.clientY);
			if (id === this.hallHoverResourceId) return;
			this.hallHoverResourceId = id;
			applyHallCalendarRowHover(root, id);
		};
		// pointermove required: timeline day slots are one tall overlay without per-row resource ids.
		root.addEventListener('pointermove', sync);
		root.addEventListener('pointerover', sync);
		root.addEventListener('pointerleave', () => {
			this.hallHoverResourceId = null;
			applyHallCalendarRowHover(root, null);
		});
	}

	private hallFromResource(resource: any): any {
		const xp = resource?.extendedProps || {};
		const id = xp.IDHall || Number(resource?.id);
		return { IDHall: id, Id: id, Name: xp.Name || resource?.title };
	}

	async onSelect(arg: any) {
		arg.view?.calendar?.unselect?.();
		if (!isBookableLeaf(arg.resource)) return;
		await this.openBook(this.hallFromResource(arg.resource), null, arg.start, arg.end);
	}

	async onEventClick(arg: any) {
		if (arg.event?.extendedProps?.isSubtotal) return;
		const booking = arg.event?.extendedProps?.booking;
		if (!booking) return;
		await this.openBook({ IDHall: booking.IDHall, Id: booking.IDHall, Name: booking.HallName }, booking);
	}

	async openBookingList() {
		const modal = await this.modalController.create({
			component: HallBookingListModalPage,
			cssClass: 'form-1column',
			componentProps: { bookings: this.bookingRows },
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();
		if (data?.booking) {
			const b = data.booking;
			await this.openBook({ IDHall: b.IDHall, Id: b.IDHall, Name: b.HallName }, b);
		}
	}

	async openBook(hall?: any, booking?: any, from?: Date, to?: Date) {
		if (this.bookModalOpen) return;
		this.bookModalOpen = true;
		try {
			const defaultFrom = from ? toDateTimeLocalValue(from) : booking?.DateTimeFrom ? toDateTimeLocalValue(booking.DateTimeFrom) : '';
			const defaultTo = to ? toDateTimeLocalValue(to) : booking?.DateTimeTo ? toDateTimeLocalValue(booking.DateTimeTo) : '';
			const modal = await this.modalController.create({
				component: HallBookModalPage,
				cssClass: 'form-1column',
				componentProps: {
					hall,
					booking,
					centers: this.branchMeta(),
					defaultFrom,
					defaultTo,
					branchQuery: this.branchQuery,
					hallOptions: bookableHallSelectOptions(this.hallRows, this.lineRows),
				},
			});
			await modal.present();
			const { data } = await modal.onWillDismiss();
			if (data?.saved) this.reloadEventsForVisibleRange();
		} finally {
			this.bookModalOpen = false;
		}
	}

	goCatalogue() {
		this.nav('/hall');
	}
}
