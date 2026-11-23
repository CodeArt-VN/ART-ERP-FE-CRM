import { Component, ChangeDetectorRef, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NavController, LoadingController, AlertController, ModalController } from '@ionic/angular';

import { PageBase } from 'src/app/page-base';
import { CommonService } from 'src/app/services/core/common.service';
import { EnvService } from 'src/app/services/core/env.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import {
	AC_ARInvoiceProvider,
	BANK_IncomingPaymentDetailProvider,
	BRA_BranchProvider,
	CRM_ActivityProvider,
	CRM_CampaignProvider,
	CRM_ContactProvider,
	CRM_ContractProvider,
	CRM_HallBookingProvider,
	CRM_OpportunityProvider,
	CRM_OpportunityStageHistoryProvider,
	CRM_PipelineProvider,
	CRM_QuotationProvider,
	HRM_StaffProvider,
	SALE_OrderProvider,
} from 'src/app/services/static/services.service';
import {
	ActionResult,
	LostStageInfo,
	PipelinePlan,
	PlanStage,
	PlanStageView,
	PlanTask,
	QualifyResponse,
	StageAgeInfo,
	StageTaskSummary,
	TaskAction,
	TaskDueStatus,
	TimelineEvent,
	TimelineFilter,
	TimelineDayGroup,
} from './pipeline.models';
import {
	applyChainState,
	buildActivityTimeline,
	buildStageMap,
	buildTaskActionMap,
	buildTaskDueMap,
	countTimelineByFilter,
	defaultMarkDone,
	filterTimelineByStage,
	branchNameById,
	docsInLeftColumn,
	groupTimelineByDay,
	filterTimelineEvents,
	gateMessages,
	isTaskFinished,
	mergeDateWithOriginalTime,
	resolveLostStageInfo,
	resolveStageStates,
	stageAgeMetrics,
	stageColor,
	sumBy,
	summarizeStageTasks,
	taskIcon,
	toDateInputValue,
	toggleComposerType,
	iconButtonSlot,
	nextInfoLevel,
} from './pipeline-view.util';
import { hallBookingCalendarUrl, hallBookingDisplayName, isActiveHallBooking, sortOppHallBookings } from './opportunity-hall-booking.util';
import { resolveOppContactDisplay } from './opportunity-contact.util';
import { opportunityStatus } from '../opportunity/opportunity-list.util';
import { centerOptions } from '../hall-detail/hall.util';
import { HallBookModalPage } from '../hall-booking/hall-book-modal.page';
import { StageTransitionModalPage } from './modals/stage-transition-modal.page';
import { ChangePipelineModalPage } from './modals/change-pipeline-modal.page';
import { CrmQuotationModalPage } from './modals/crm-quotation-modal.page';
import { CrmContractModalPage } from './modals/crm-contract-modal.page';
import { ActivityModalPage } from './modals/activity-modal.page';
import { OppContactModalPage } from './modals/opp-contact-modal.page';
import { APIList } from 'src/app/services/static/global-variable';

@Component({
	selector: 'app-opportunity-detail',
	templateUrl: './opportunity-detail.page.html',
	styleUrls: ['./opportunity-detail.page.scss'],
	standalone: false,
})
export class OpportunityDetailPage extends PageBase {
	serviceTypeList: any[] = [];
	lostReasonList: any[] = [];
	pipelineList: any[] = [];
	campaignList: any[] = [];
	customerTypeList = [
		{ Code: 'Personal', Name: 'Personal' },
		{ Code: 'Corporate', Name: 'Corporate' },
	];

	qualifyForm;
	composerForm;
	qualifyResult: QualifyResponse;
	selectedIDPipeline: number;
	plan: PipelinePlan;
	stageViews: PlanStageView[] = [];
	hasUnknownPriorStages = false;
	previewStageId: number = null;
	history: any[] = [];
	activities: any[] = [];
	entityLogs: any[] = [];
	entityLogsLoaded = false;
	private entityLogsLoading = false;

	quotations: any[] = [];
	contracts: any[] = [];
	saleOrders: any[] = [];
	payments: any[] = [];
	invoices: any[] = [];
	hallBookings: any[] = [];

	contactPartner: any = null;
	ownerStaff: any = null;
	oppContacts: any[] = [];
	oppContactDisplay: any[] = [];

	hallBookingDisplayName = hallBookingDisplayName;
	isActiveHallBooking = isActiveHallBooking;

	busy = false;
	timelineFilter: TimelineFilter = 'all';
	/** Timeline shows only the events of the stage selected in the chain. */
	timelineStageOnly = false;

	// Derived view state. Recomputed only when its inputs change (see recomputeStageDerived / recomputeTimeline /
	// recomputeDocTotals); the template must read these fields, never rebuild arrays per change detection.
	currentStage: PlanStage = null;
	previewStage: PlanStageView = null;
	isPreviewingOtherStage = false;
	nextForwardStage: PlanStage = null;
	lostStage: PlanStage = null;
	stageMap: Record<number, PlanStage> = {};
	stageAge: StageAgeInfo | null = null;
	/** Summary of the stage whose checklist is displayed (current stage unless the user clicked another one). */
	previewSummary: StageTaskSummary = summarizeStageTasks(null);
	taskDueMap: Record<number, TaskDueStatus> = {};
	/** Main button of each task row of the displayed stage, keyed by task Id. */
	taskActions: Record<number, TaskAction> = {};
	lostInfo: LostStageInfo = { stageWhenLost: null, isUnknownPrior: true };
	lostReasonName = '';
	serviceTypeName = '';
	timelineEvents: TimelineEvent[] = [];
	filteredTimelineEvents: TimelineEvent[] = [];
	/** filteredTimelineEvents grouped by day, for the journal. */
	timelineDays: TimelineDayGroup[] = [];

	// masonry: the Documents box follows the shorter of the two columns (two-column desktop layout only)
	docsInLeft = false;
	private activityEl: HTMLElement;
	private infoEl: HTMLElement;
	private layoutObserver: ResizeObserver;

	@ViewChild('activityBox') set activityBoxRef(ref: ElementRef<HTMLElement>) {
		this.activityEl = ref?.nativeElement;
		this.observeLayout();
	}

	@ViewChild('infoBox') set infoBoxRef(ref: ElementRef<HTMLElement>) {
		this.infoEl = ref?.nativeElement;
		this.observeLayout();
	}

	private observeLayout() {
		if (typeof ResizeObserver === 'undefined') return;
		if (!this.layoutObserver) this.layoutObserver = new ResizeObserver(() => this.updateDocsPlacement());
		this.layoutObserver.disconnect();
		[this.activityEl, this.infoEl].filter(Boolean).forEach((el) => this.layoutObserver.observe(el));
	}

	// Activities and Main information are measured on their own boxes, so moving Documents never changes the measurement (no loop)
	private updateDocsPlacement() {
		const twoColumns = typeof window !== 'undefined' && window.matchMedia('(min-width: 993px)').matches;
		const next = docsInLeftColumn(this.activityEl?.offsetHeight ?? 0, this.infoEl?.offsetHeight ?? 0, twoColumns);
		if (next !== this.docsInLeft) {
			this.docsInLeft = next;
			this.cdr.detectChanges();
		}
	}

	/** ≤600px: hide .btn-label and use ion-icon slot=icon-only (centered). */
	iconOnlyChrome = false;
	/** ≤360px: composer type buttons are icon-only. */
	composerIconOnly = false;
	private chromeMq?: MediaQueryList;
	private composerMq?: MediaQueryList;
	/** MediaQueryList fires outside Angular; re-enter the zone — never detectChanges from the constructor. */
	private readonly onChromeMq = () => this.zone.run(() => this.syncIconOnlySlots());

	/** Template helper: icon-only when the label is hidden. */
	iconSlot(iconOnly: boolean): 'icon-only' | 'start' {
		return iconButtonSlot(iconOnly);
	}

	private syncIconOnlySlots() {
		const nextChrome = !!this.chromeMq?.matches;
		const nextComposer = !!this.composerMq?.matches;
		if (nextChrome === this.iconOnlyChrome && nextComposer === this.composerIconOnly) return;
		this.iconOnlyChrome = nextChrome;
		this.composerIconOnly = nextComposer;
	}

	private observeIconOnlySlots() {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
		this.chromeMq = window.matchMedia('(max-width: 600px)');
		this.composerMq = window.matchMedia('(max-width: 360px)');
		this.syncIconOnlySlots();
		this.chromeMq.addEventListener?.('change', this.onChromeMq);
		this.composerMq.addEventListener?.('change', this.onChromeMq);
	}

	ngOnDestroy() {
		this.layoutObserver?.disconnect();
		this.chromeMq?.removeEventListener?.('change', this.onChromeMq);
		this.composerMq?.removeEventListener?.('change', this.onChromeMq);
		super.ngOnDestroy();
	}

	/** Branch of the opportunity as plain text (last level name). */
	get branchName(): string {
		return branchNameById(this.env.branchList, this.item?.IDBranch);
	}

	/** Edit popup of the main information block. */
	showEditInfo = false;
	/**
	 * Narrow screens — Main information expand steps:
	 * 0 = customer + remark, 1 = + KPI tiles, 2 = full (Time / Information / audit).
	 * Desktop ignores this and always shows full.
	 */
	infoLevel = 0;

	cycleInfoLevel() {
		this.infoLevel = nextInfoLevel(this.infoLevel);
	}
	/** Narrow screens: checklist under stage-chain stays faded until Expand. */
	stageExpanded = false;
	campaignName = '';
	timelineCounts: Record<TimelineFilter, number> = countTimelineByFilter([]);
	docTotals = { contracts: 0, orders: 0, payments: 0, invoices: 0 };

	composerTypes = ['Note', 'Call', 'Appointment', 'Checklist'].map((c) => ({ Code: c, Icon: taskIcon({ TaskType: c }) }));
	/** null until the user taps a chip — Content / Due date / Add activity stay hidden */
	composerType: string | null = null;

	private originalDateTimes: Record<string, any> = {};
	private readonly dateFields = ['EventDate', 'StartDate', 'PredictedClosingDate'];

	_ContactDataSource = this.buildSelectDataSource((term) =>
		this.contactProvider.search({
			Take: 20,
			Skip: 0,
			Keyword: term,
		})
	);

	_OwnerDataSource = this.buildSelectDataSource((term) =>
		this.staffProvider.search({
			Take: 20,
			Skip: 0,
			Keyword: term,
		})
	);

	stageColor = stageColor;
	taskIcon = taskIcon;
	isTaskFinished = isTaskFinished;

	constructor(
		public pageProvider: CRM_OpportunityProvider,
		public pipelineProvider: CRM_PipelineProvider,
		public historyProvider: CRM_OpportunityStageHistoryProvider,
		public activityProvider: CRM_ActivityProvider,
		public quotationProvider: CRM_QuotationProvider,
		public contractProvider: CRM_ContractProvider,
		public saleOrderProvider: SALE_OrderProvider,
		public paymentDetailProvider: BANK_IncomingPaymentDetailProvider,
		public arInvoiceProvider: AC_ARInvoiceProvider,
		public hallBookingProvider: CRM_HallBookingProvider,
		public contactProvider: CRM_ContactProvider,
		public staffProvider: HRM_StaffProvider,
		public campaignProvider: CRM_CampaignProvider,
		public branchProvider: BRA_BranchProvider,
		public modalController: ModalController,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService,
		private zone: NgZone
	) {
		super();
		this.pageConfig.isDetailPage = true;
		this.pageConfig.ShowHistory = true;

		this.formGroup = formBuilder.group({
			IDBranch: [this.env.selectedBranch],
			Id: new FormControl({ value: '', disabled: true }),
			Code: [''],
			Name: ['', Validators.required],
			Remark: [''],
			IDContact: [null],
			IDOwner: [null],
			IDType: [null],
			IDCampaign: [null],
			IDLead: new FormControl({ value: '', disabled: true }),
			IDSource: new FormControl({ value: '', disabled: true }),
			IDLostReason: [null],
			LostRemark: [''],
			NumberOfGuests: [0],
			EventDate: [''],
			StartDate: [''],
			PredictedClosingDate: [''],
			Amount: [0],
			ExpectedRevenue: [0],
			NextStep: [''],
			IsPrivate: [false],
			Probability: new FormControl({ value: '', disabled: true }),
			IDPipeline: new FormControl({ value: '', disabled: true }),
			IDStage: new FormControl({ value: '', disabled: true }),
			IsClosed: new FormControl({ value: '', disabled: true }),
			ClosedType: new FormControl({ value: '', disabled: true }),
			ClosedDate: new FormControl({ value: '', disabled: true }),
			StageChangedDate: new FormControl({ value: '', disabled: true }),
			Sort: [''],
			IsDisabled: new FormControl({ value: '', disabled: true }),
			IsDeleted: new FormControl({ value: '', disabled: true }),
			CreatedBy: new FormControl({ value: '', disabled: true }),
			CreatedDate: new FormControl({ value: '', disabled: true }),
			ModifiedBy: new FormControl({ value: '', disabled: true }),
			ModifiedDate: new FormControl({ value: '', disabled: true }),
		});

		this.qualifyForm = formBuilder.group({
			IDServiceType: [''],
			CustomerType: [''],
			NumberOfGuests: [''],
			EventDate: [''],
			BookingHistory: [''],
			PastExperience: [''],
			Note: [''],
		});

		this.composerForm = formBuilder.group({
			TaskType: [''],
			Name: ['', Validators.required],
			DueDate: [''],
			Remark: [''],
			MarkDone: [true],
		});

		this.observeIconOnlySlots();
	}

	preLoadData(event?: any): void {
		Promise.all([
			this.env.getType('CRMServiceType'),
			this.env.getType('CRMLostReason'),
			// pipelines are configuration: a deal of a child branch uses the pipelines of its ancestors
			this.pipelineProvider.read({ Take: 100 }),
			this.campaignProvider.read({ Take: 100 }),
		])
			.then((values: any) => {
				this.serviceTypeList = values[0] || [];
				this.lostReasonList = values[1] || [];
				this.pipelineList = values[2]?.data || [];
				this.campaignList = values[3]?.data || [];
				super.preLoadData(event);
			})
			.catch(() => super.preLoadData(event));
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		this.captureOriginalDates(this.item);
		super.loadedData(event, ignoredFromGroup);
		this.normalizeFormDates();

		if (this.item?.Id) {
			this.qualifyForm.patchValue({
				IDServiceType: this.item.IDType,
				NumberOfGuests: this.item.NumberOfGuests || '',
				EventDate: toDateInputValue(this.item.EventDate),
			});
			this.loadPartnerAndOwner();
			this.loadOppContacts();
			this.refreshProcess();
			this.loadDocuments();
			this.loadHallBookings();
			this.loadEntityLogs();
		} else {
			this.hallBookings = [];
			this.oppContacts = [];
			this.oppContactDisplay = [];
			this._ContactDataSource.initSearch();
			this._OwnerDataSource.initSearch();
		}
	}

	private captureOriginalDates(src: any) {
		this.originalDateTimes = {};
		for (const key of this.dateFields) {
			this.originalDateTimes[key] = src ? src[key] : null;
		}
	}

	private normalizeFormDates() {
		if (!this.formGroup || !this.item) return;
		const patch: Record<string, string> = {};
		for (const key of this.dateFields) {
			patch[key] = toDateInputValue(this.item[key]);
		}
		this.formGroup.patchValue(patch, { emitEvent: false });
		this.formGroup.markAsPristine();
	}

	private async loadPartnerAndOwner() {
		if (this.item?.IDContact) {
			try {
				const c: any = await this.contactProvider.getAnItem(this.item.IDContact);
				this.contactPartner = c || null;
				if (c?.Id) {
					this._ContactDataSource.selected = [c];
				}
			} catch {
				this.contactPartner = null;
			}
		} else {
			this.contactPartner = null;
			this._ContactDataSource.selected = [];
		}
		this._ContactDataSource.initSearch();

		if (this.item?.IDOwner) {
			try {
				const s: any = await this.staffProvider.getAnItem(this.item.IDOwner);
				this.ownerStaff = s || null;
				if (s?.Id) {
					this._OwnerDataSource.selected = [s];
				}
			} catch {
				this.ownerStaff = null;
			}
		} else {
			this.ownerStaff = null;
			this._OwnerDataSource.selected = [];
		}
		this._OwnerDataSource.initSearch();
		this.oppContactDisplay = resolveOppContactDisplay(this.contactPartner, this.oppContacts);
		this.cdr.detectChanges();
	}

	private async loadOppContacts() {
		if (!this.item?.Id) {
			this.oppContacts = [];
			this.oppContactDisplay = resolveOppContactDisplay(this.contactPartner, []);
			return;
		}
		try {
			const api = APIList.CRM_OpportunityContact.getList;
			const rows: any = await this.pageProvider.commonService.connect(api.method, api.url(), { IDOpportunity: this.item.Id }).toPromise();
			this.oppContacts = Array.isArray(rows) ? rows : rows?.data || [];
		} catch {
			this.oppContacts = [];
		}
		this.oppContactDisplay = resolveOppContactDisplay(this.contactPartner, this.oppContacts);
		this.cdr.detectChanges();
	}

	onOppContactClick(row: any) {
		if (!this.canManageOppContact || this.isClosed) return;
		this.openOppContactModal(row);
	}

	async openOppContactModal(row?: any) {
		if (!this.item?.Id || !this.canManageOppContact || this.isClosed) return;
		const modal = await this.modalController.create({
			component: OppContactModalPage,
			componentProps: {
				opportunity: this.item,
				item: row ? { ...row } : null,
				canEdit: this.canManageOppContact,
				canDelete: !!(row?.Id && (this.pageConfig?.canDelete || this.pageConfig?.canManageOppContact)),
			},
			cssClass: 'form-1column',
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
		});
		await modal.present();
		const { role } = await modal.onWillDismiss();
		if (role === 'saved') {
			await Promise.all([this.loadOppContacts(), this.loadPartnerAndOwner(), this.refreshProcess()]);
		}
	}

	async saveChange(): Promise<boolean> {
		this.formGroup.updateValueAndValidity();
		if (!this.formGroup.valid) {
			let invalidControls = this.findInvalidControlsRecursive(this.formGroup);
			const translated = await Promise.all(invalidControls.map((control) => this.env.translateResource(control)));
			this.env.showMessage('Please recheck control(s): {value}', 'warning', translated.join(' | '));
			return false;
		}
		if (this.submitAttempt) return false;
		this.submitAttempt = true;

		const submitItem = this.getDirtyValues(this.formGroup) || {};
		for (const key of this.dateFields) {
			if (Object.prototype.hasOwnProperty.call(submitItem, key)) {
				submitItem[key] = mergeDateWithOriginalTime(submitItem[key], this.originalDateTimes[key]);
			}
		}
		const wasCreate = !this.id || this.id == 0 || this.formGroup?.controls?.Id?.value == 0;
		const contactChanged = Object.prototype.hasOwnProperty.call(submitItem, 'IDContact');
		const ownerChanged = Object.prototype.hasOwnProperty.call(submitItem, 'IDOwner');

		try {
			const savedItem: any = await this.pageProvider.save(submitItem, this.pageConfig.isForceCreate);
			if (wasCreate) {
				this.savedChange(savedItem, this.formGroup);
				this.publishListUpsert(this.pageConfig.pageName, true, savedItem, this.formGroup);
				this.captureOriginalDates(this.item);
				this.normalizeFormDates();
				await this.loadPartnerAndOwner();
				await this.refreshProcess();
				await this.loadDocuments();
			} else {
				Object.assign(this.item, submitItem, savedItem || {});
				this.captureOriginalDates(this.item);
				this.savedChange(savedItem, this.formGroup);
				this.normalizeFormDates();
				this.publishListUpsert(this.pageConfig.pageName, false, this.item, this.formGroup);
				if (contactChanged || ownerChanged) {
					await this.loadPartnerAndOwner();
				}
				if (this.hasPipeline) {
					await this.refreshProcess();
				} else {
					this.recomputeAll();
				}
			}
			return true;
		} catch {
			this.env.showMessage('Cannot save, please try again', 'danger');
			this.submitAttempt = false;
			this.cdr.detectChanges();
			return false;
		}
	}

	// ---------------------------------------------------------------- main information edit popup

	openEditInfo() {
		this.showEditInfo = true;
	}

	/** Save the form, then close the popup (stays open when the save fails). */
	async saveEditInfo() {
		if (await this.saveChange()) this.showEditInfo = false;
		this.cdr.detectChanges();
	}

	/** Drop unsaved edits and close the popup. */
	cancelEditInfo() {
		this.formGroup.reset();
		this.formGroup.patchValue(this.item);
		this.normalizeFormDates();
		this.formGroup.markAsPristine();
		this.showEditInfo = false;
	}

	// ---------------------------------------------------------------- permissions & state getters

	get canManageActivities(): boolean {
		return !!(this.pageConfig?.canCompleteActivity || this.pageConfig?.canManageActivity);
	}

	get canEditDocuments(): boolean {
		return !!(this.pageConfig?.canEdit || this.pageConfig?.canAdd || this.pageConfig?.canManageQuotation || this.pageConfig?.canManageContract);
	}

	get canDeleteDocuments(): boolean {
		return !!(this.pageConfig?.canDelete || this.pageConfig?.canManageQuotation || this.pageConfig?.canManageContract);
	}

	get canManageOppContact(): boolean {
		return !!(this.pageConfig?.canEdit || this.pageConfig?.canManageOppContact);
	}

	get hasPipeline(): boolean {
		return !!this.item?.IDPipeline;
	}

	get isClosed(): boolean {
		return !!this.item?.IsClosed;
	}

	/** Same status label/color as the list page status chip. */
	get statusView() {
		return opportunityStatus(this.item || {});
	}

	/** Full-width tab underline follows the active (previewed) stage; defaults to current. */
	get activeChainColorVar(): string {
		return this.previewStage?.colorVar || this.stageViews.find((s) => s.chainState === 'current')?.colorVar || 'var(--ion-color-primary)';
	}

	get isLostDeal(): boolean {
		return this.currentStage?.Outcome === 'Lost';
	}

	get isManualClosed(): boolean {
		return this.isClosed && this.item?.ClosedType === 'Manual';
	}

	get canCloseManually(): boolean {
		const outcome = this.currentStage?.Outcome;
		return !this.isClosed && (outcome === 'Won' || outcome === 'Done');
	}

	// ---------------------------------------------------------------- derived view state (computed once per input change)

	/** Inputs: plan, history, item, lookup lists. */
	private recomputeStageDerived() {
		const stages = this.plan?.Stages || [];
		this.currentStage = stages.find((s) => s.IsCurrent) || null;
		this.stageMap = buildStageMap(stages);
		this.nextForwardStage = this.currentStage ? stages.find((s) => s.Outcome !== 'Lost' && s.Sort > this.currentStage.Sort) || null : null;
		this.lostStage = stages.find((s) => s.Outcome === 'Lost') || null;

		const resolved = resolveStageStates(stages, this.history, this.isLostDeal);
		this.stageViews = applyChainState(resolved.stages);
		this.hasUnknownPriorStages = resolved.hasUnknownPriorStages;
		if (!this.previewStageId || !this.stageViews.some((s) => s.Id === this.previewStageId)) {
			this.previewStageId = this.currentStage?.Id || this.stageViews[0]?.Id || null;
		}
		this.recomputePreview();

		this.stageAge = stageAgeMetrics(this.item?.StageChangedDate, this.currentStage?.ExpectedDays, this.currentStage?.SLAHours, this.isClosed);
		this.lostInfo = resolveLostStageInfo(this.history, this.item, stages);
		this.recomputeItemLabels();
	}

	private recomputePreview() {
		this.previewStage = this.stageViews.find((s) => s.Id === this.previewStageId) || this.stageViews.find((s) => s.IsCurrent) || this.stageViews[0] || null;
		this.isPreviewingOtherStage = !!(this.previewStage && this.currentStage && this.previewStage.Id !== this.currentStage.Id);
		this.previewSummary = summarizeStageTasks(this.previewStage);
		this.taskDueMap = buildTaskDueMap(this.previewStage?.Tasks || []);
		this.taskActions = buildTaskActionMap(this.previewStage?.Tasks || [], { quotations: this.quotations.length, contracts: this.contracts.length });
		if (this.timelineStageOnly) this.applyTimelineFilters();
	}

	/** Inputs: item, lostReasonList, serviceTypeList, campaignList. */
	private recomputeItemLabels() {
		this.lostReasonName = this.item?.IDLostReason ? this.lostReasonList.find((r) => r.Id === this.item.IDLostReason)?.Name || '' : '';
		this.serviceTypeName = this.item?.IDType ? this.serviceTypeList.find((t) => t.Id === this.item.IDType)?.Name || '' : '';
		this.campaignName = this.item?.IDCampaign ? this.campaignList.find((c) => c.Id === this.item.IDCampaign)?.Name || '' : '';
	}

	/** Inputs: item, history, activities, entityLogs, stageMap, timelineFilter. */
	private recomputeTimeline() {
		const visibleHistory = this.pageConfig?.canViewStageHistory ? this.history : [];
		this.timelineEvents = buildActivityTimeline({
			opportunity: this.item,
			history: visibleHistory,
			activities: this.activities,
			entityLogs: this.entityLogs,
			stageMap: this.stageMap,
		});
		this.applyTimelineFilters();
	}

	/** Inputs: timelineEvents, timelineStageOnly, previewStage, timelineFilter. */
	private applyTimelineFilters() {
		const scoped = this.timelineStageOnly ? filterTimelineByStage(this.timelineEvents, this.previewStage?.Id) : this.timelineEvents;
		this.timelineCounts = countTimelineByFilter(scoped);
		this.filteredTimelineEvents = filterTimelineEvents(scoped, this.timelineFilter);
		this.timelineDays = groupTimelineByDay(this.filteredTimelineEvents);
	}

	setTimelineFilter(filter: TimelineFilter) {
		if (this.timelineFilter === filter) return;
		this.timelineFilter = filter;
		this.applyTimelineFilters();
	}

	toggleTimelineStageOnly() {
		this.timelineStageOnly = !this.timelineStageOnly;
		this.applyTimelineFilters();
	}

	/** Inputs: contracts, saleOrders, payments, invoices. */
	private recomputeDocTotals() {
		this.docTotals = {
			contracts: sumBy(this.contracts, 'Amount'),
			orders: sumBy(this.saleOrders, 'TotalAfterTax'),
			payments: sumBy(this.payments, 'Amount'),
			invoices: sumBy(this.invoices, 'TotalAfterTax'),
		};
	}

	/** Recompute everything derived from `item` / `plan` / loaded lists. */
	private recomputeAll() {
		this.recomputeStageDerived();
		this.recomputeTimeline();
		this.recomputeDocTotals();
	}

	// ---------------------------------------------------------------- data loaders

	private api<T>(method: 'GET' | 'POST', path: string, data?: any): Promise<T> {
		return this.pageProvider.commonService.connect(method, ApiSetting.apiDomain(path), data).toPromise() as Promise<T>;
	}

	private errorText(err: any): string {
		const e = err?.error;
		if (typeof e === 'string') return e;
		return e?.Message || e?.ExceptionMessage || 'Cannot save, please try again';
	}

	async refreshProcess() {
		if (!this.item?.Id) return;
		if (this.item.IDPipeline) {
			try {
				this.plan = await this.api<PipelinePlan>('GET', 'CRM/Pipeline/Plan', { idOpportunity: this.item.Id });
			} catch {
				this.plan = null;
			}
			await Promise.all([this.loadHistory(), this.loadActivities()]);
		} else {
			this.plan = null;
			this.history = [];
			await this.loadActivities();
		}
		this.recomputeStageDerived();
		this.recomputeTimeline();
		this.cdr.detectChanges();
	}

	async loadHistory() {
		if (!this.pageConfig?.canViewStageHistory) {
			this.history = [];
			return;
		}
		try {
			const res: any = await this.historyProvider.read({ IDOpportunity: this.item.Id, Take: 100, Skip: 0 }, true);
			this.history = (res.data || []).slice().sort((a, b) => b.Id - a.Id);
		} catch {
			this.history = [];
		}
	}

	async loadActivities() {
		if (!this.item?.Id) return;
		try {
			const res: any = await this.activityProvider.read({ IDOpportunity: this.item.Id, Take: 200, Skip: 0 }, true);
			this.activities = res.data || [];
		} catch {
			this.activities = [];
		}
	}

	async loadEntityLogs() {
		if (!this.item?.Id || this.entityLogsLoading) return;
		this.entityLogsLoading = true;
		this.entityLogsLoaded = true;
		try {
			this.entityLogs = await this.historyService.loadHistory('CRM', 'Opportunity', this.item.Id, 100);
		} catch {
			this.entityLogs = [];
		}
		this.entityLogsLoading = false;
		this.recomputeTimeline();
		this.cdr.detectChanges();
	}

	async refreshTimeline() {
		await this.refreshProcess();
		await this.loadEntityLogs();
	}

	async loadDocuments() {
		if (!this.item?.Id) return;
		const oppId = this.item.Id;
		const [qRes, cRes, oRes]: any = await Promise.all([
			this.quotationProvider.read({ IDOpportunity: oppId, Take: 100 }, true).catch(() => ({ data: [] })),
			this.contractProvider.read({ IDOpportunity: oppId, Take: 100 }, true).catch(() => ({ data: [] })),
			this.saleOrderProvider.read({ IDOpportunity: oppId, Take: 100 }, true).catch(() => ({ data: [] })),
		]);
		this.quotations = qRes?.data || [];
		this.contracts = cRes?.data || [];
		this.saleOrders = oRes?.data || [];

		const contractIds = this.contracts.map((c) => c.Id).filter((id) => id > 0);
		const orderIds = this.saleOrders.map((o) => o.Id).filter((id) => id > 0);

		const paymentCalls: Promise<any>[] = [];
		if (contractIds.length) {
			paymentCalls.push(this.paymentDetailProvider.read({ IDContract: JSON.stringify(contractIds), Take: 100 }, true).catch(() => ({ data: [] })));
		}
		if (orderIds.length) {
			paymentCalls.push(this.paymentDetailProvider.read({ IDSaleOrder: JSON.stringify(orderIds), Take: 100 }, true).catch(() => ({ data: [] })));
		}

		const [payResults, invRes]: any = await Promise.all([
			paymentCalls.length ? Promise.all(paymentCalls) : Promise.resolve([]),
			orderIds.length ? this.arInvoiceProvider.read({ IDSaleOrder: JSON.stringify(orderIds), Take: 100 }, true).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
		]);

		const payMap = new Map<number, any>();
		(payResults || []).forEach((r: any) => {
			(r?.data || []).forEach((p: any) => payMap.set(p.Id, p));
		});
		this.payments = Array.from(payMap.values());
		this.invoices = invRes?.data || [];
		this.recomputeDocTotals();
		this.recomputePreview();
		this.cdr.detectChanges();
	}

	async loadHallBookings() {
		if (!this.item?.Id) {
			this.hallBookings = [];
			return;
		}
		try {
			const api = APIList.CRM_HallBooking.getByOpportunity;
			const rows: any = await this.hallBookingProvider.commonService.connect(api.method, api.url(), { IDOpportunity: this.item.Id }).toPromise();
			this.hallBookings = sortOppHallBookings(Array.isArray(rows) ? rows : rows?.data || []);
		} catch {
			// Fallback when ByOpportunity is not on the server yet (GenCode list lacks DateTimeFrom/To).
			try {
				const res: any = await this.hallBookingProvider.read({ IDOpportunity: this.item.Id, Take: 50 }, true);
				this.hallBookings = sortOppHallBookings(
					(res?.data || []).map((b: any) => ({
						...b,
						HallName: b.HallName || b.Name,
						DateTimeFrom: b.DateTimeFrom || b.EventDate,
						DateTimeTo: b.DateTimeTo || b.EventDate,
					}))
				);
			} catch {
				this.hallBookings = [];
			}
		}
		this.cdr.detectChanges();
	}

	/** Center name for a hall booking row (branch of the hall). */
	hallBookingCenterName(row: any): string {
		return branchNameById(this.env.branchList, row?.IDBranch) || '';
	}

	/** Title action: open hall calendar week view and highlight this opp's booking. */
	openHallBookingCalendar(booking?: any) {
		const active = (this.hallBookings || []).find((b) => isActiveHallBooking(b));
		const row = booking || active || this.hallBookings?.[0];
		this.nav(
			hallBookingCalendarUrl(row?.DateTimeFrom || this.item?.EventDate, {
				bookingId: row?.Id,
				opportunityId: row?.IDOpportunity || this.item?.Id,
			})
		);
	}

	async openHallBookModal(booking?: any) {
		if (!this.item?.Id) return;
		const centers = centerOptions(this.env.branchList);
		const modal = await this.modalController.create({
			component: HallBookModalPage,
			cssClass: 'form-1column',
			componentProps: {
				booking: booking
					? { ...booking, OpportunityName: this.item.Name, OpportunityCode: this.item.Code }
					: { IDOpportunity: this.item.Id, OpportunityName: this.item.Name, OpportunityCode: this.item.Code },
				centers,
				defaultBranch: booking?.IDBranch || this.item.IDBranch || this.env.selectedBranch,
			},
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
		});
		await modal.present();
		const { data } = await modal.onWillDismiss();
		if (data?.saved) await this.loadHallBookings();
	}

	/** Reload the opportunity row (stage, probability, closed flags) and its plan after an action. */
	async reloadAfterAction() {
		const fresh: any = await this.api<any>('GET', 'CRM/Opportunity/' + this.item.Id);
		this.item = fresh;
		this.captureOriginalDates(fresh);
		this.formGroup.patchValue(fresh, { emitEvent: false });
		this.normalizeFormDates();
		this.previewStageId = null;
		await Promise.all([this.refreshProcess(), this.loadDocuments(), this.loadHallBookings()]);
		if (this.entityLogsLoaded) {
			await this.loadEntityLogs();
		}
	}

	// ---------------------------------------------------------------- qualification

	private qualifyBody(apply: boolean, idPipeline?: number) {
		const v = this.qualifyForm.getRawValue();
		return {
			IDOpportunity: this.item.Id,
			IDServiceType: v.IDServiceType || null,
			CustomerType: v.CustomerType || null,
			NumberOfGuests: v.NumberOfGuests ? Number(v.NumberOfGuests) : null,
			EventDate: mergeDateWithOriginalTime(v.EventDate, this.originalDateTimes['EventDate']),
			BookingHistory: v.BookingHistory || null,
			PastExperience: v.PastExperience || null,
			Note: v.Note || null,
			IDPipeline: idPipeline || null,
			Apply: apply,
		};
	}

	async suggestPipeline() {
		if (!this.pageConfig?.canQualify) return;
		this.busy = true;
		try {
			this.qualifyResult = await this.api<QualifyResponse>('POST', 'CRM/Pipeline/Qualify', this.qualifyBody(false));
			this.selectedIDPipeline = this.qualifyResult.Recommended?.IDPipeline;
			this.plan = this.qualifyResult.Plan;
			this.recomputeStageDerived();
		} catch (err) {
			this.env.showMessage(this.errorText(err), 'danger');
		}
		this.busy = false;
	}

	async pickCandidate(idPipeline: number) {
		if (this.selectedIDPipeline === idPipeline) return;
		this.selectedIDPipeline = idPipeline;
		this.busy = true;
		try {
			this.plan = await this.api<PipelinePlan>('GET', 'CRM/Pipeline/Plan', { idPipeline: idPipeline });
			this.recomputeStageDerived();
		} catch (err) {
			this.env.showMessage(this.errorText(err), 'danger');
		}
		this.busy = false;
	}

	async applyPipeline() {
		if (!this.selectedIDPipeline || !this.pageConfig?.canQualify) return;
		this.busy = true;
		try {
			const res = await this.api<QualifyResponse>('POST', 'CRM/Pipeline/Qualify', this.qualifyBody(true, this.selectedIDPipeline));
			if (res.Applied) {
				this.env.showMessage('Saving completed!', 'success');
				this.qualifyResult = null;
				await this.reloadAfterAction();
			}
		} catch (err) {
			this.env.showMessage(this.errorText(err), 'danger');
		}
		this.busy = false;
	}

	/** Opens the popup that lists the pipelines, previews the picked one and applies it. */
	async changePipeline() {
		if (!this.pageConfig?.canQualify || this.isClosed || !this.item?.Id) return;
		const modal = await this.modalController.create({
			component: ChangePipelineModalPage,
			componentProps: {
				opportunity: this.item,
				pipelineList: this.pipelineList,
				qualifyBody: this.qualifyBody(false),
			},
			cssClass: 'form-1column',
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
		});
		await modal.present();
		const { role } = await modal.onWillDismiss();
		if (role === 'saved') {
			await this.reloadAfterAction();
		}
	}

	// ---------------------------------------------------------------- sales path preview & stage transitions

	selectPreviewStage(stage: PlanStageView) {
		this.previewStageId = stage?.Id || null;
		this.recomputePreview();
	}

	backToCurrentStage() {
		this.previewStageId = this.currentStage?.Id || null;
		this.recomputePreview();
	}

	async moveToStage(stage: PlanStage) {
		if (!stage || !this.pageConfig?.canMoveStage || this.isClosed) return;
		const modal = await this.modalController.create({
			component: StageTransitionModalPage,
			componentProps: {
				opportunity: this.item,
				currentStage: this.currentStage,
				targetStage: stage,
				lostReasonList: this.lostReasonList,
				canForceMoveStage: !!this.pageConfig?.canForceMoveStage,
			},
			cssClass: 'form-1column',
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
		});
		await modal.present();
		const { role } = await modal.onWillDismiss();
		if (role === 'saved') {
			await this.reloadAfterAction();
		}
	}

	async closeDeal() {
		if (!this.pageConfig?.canClose) return;
		await this.runAction('CRM/Opportunity/Close');
	}

	async reopenDeal() {
		if (!this.pageConfig?.canReopen) return;
		await this.runAction('CRM/Opportunity/Reopen');
	}

	private async runAction(path: string) {
		this.busy = true;
		try {
			const res = await this.api<ActionResult>('POST', path, { IDOpportunity: this.item.Id });
			if (!res.Success) {
				this.env.showAlert(gateMessages(res.Errors, [], []).join('\n'));
			} else {
				this.env.showMessage('Saving completed!', 'success');
				await this.reloadAfterAction();
			}
		} catch (err) {
			this.env.showMessage(this.errorText(err), 'danger');
		}
		this.busy = false;
	}

	// ---------------------------------------------------------------- stage tasks & activity initialization

	private buildActivityPayloadForTask(task: PlanTask, stage: PlanStage, index = 0) {
		let dueDateIso: string = null;
		if (task.DueOffsetDays != null) {
			const d = new Date();
			d.setDate(d.getDate() + Number(task.DueOffsetDays));
			dueDateIso = d.toISOString();
		}
		return {
			IDOpportunity: this.item.Id,
			IDContact: this.item.IDContact || null,
			IDBranch: this.item.IDBranch || this.env.selectedBranch,
			IDOwner: this.item.IDOwner || null,
			IDStage: stage.Id,
			IDStageTask: task.Id,
			Name: task.Name,
			Remark: task.Guide || null,
			TaskType: task.TaskType || 'Checklist',
			DocumentType: task.DocumentType || null,
			IsRequired: !!task.IsRequired,
			Status: 'Open',
			DueDate: dueDateIso,
			EventDate: task.TaskType === 'Appointment' ? dueDateIso : null,
			Sort: task.Sort ?? index + 1,
		};
	}

	/** Initializes a single unlinked stage task as CRM_Activity, optionally completing it immediately. Returns the new activity Id. */
	async initializeSingleTask(task: PlanTask, completeStatus?: 'Done' | 'Skipped', silent = false): Promise<number | null> {
		if (!this.currentStage || !this.canManageActivities || this.isClosed || this.busy) return null;
		this.busy = true;
		let newId: number = null;
		try {
			const idx = (this.currentStage.Tasks || []).findIndex((t) => t.Id === task.Id);
			const created: any = await this.activityProvider.save(this.buildActivityPayloadForTask(task, this.currentStage, Math.max(0, idx)));
			newId = created?.Id || null;
			if (newId && completeStatus) {
				const res = await this.api<ActionResult>('POST', 'CRM/Activity/Complete', { Id: newId, Status: completeStatus });
				if (!res.Success) {
					this.env.showAlert(gateMessages(res.Errors, [], []).join('\n'), null, 'Cannot complete this task');
				}
			} else if (!completeStatus && !silent) {
				this.env.showMessage('Saving completed!', 'success');
			}
			await this.refreshProcess();
		} catch (err) {
			this.env.showMessage(this.errorText(err), 'danger');
		}
		this.busy = false;
		return newId;
	}

	/** Batch-initializes every unlinked task in the current stage sequentially via POST CRM/Activity. */
	async initializeStageTasks() {
		if (!this.currentStage || !this.canManageActivities || this.isClosed || this.busy) return;
		const unlinked = (this.currentStage.Tasks || []).filter((t) => !t.IDActivity);
		if (!unlinked.length) return;
		this.busy = true;
		try {
			for (let i = 0; i < unlinked.length; i++) {
				await this.activityProvider.save(this.buildActivityPayloadForTask(unlinked[i], this.currentStage, i));
			}
			this.env.showMessage('Saving completed!', 'success');
			await this.refreshProcess();
		} catch (err) {
			this.env.showMessage(this.errorText(err), 'danger');
			await this.refreshProcess();
		}
		this.busy = false;
	}

	async onTaskCheckboxChange(task: PlanTask, checked: boolean) {
		if (!this.canManageActivities || this.isClosed) return;
		const targetStatus: 'Done' | 'Open' = checked ? 'Done' : 'Open';
		// Guard against spurious ionChange emission when value already matches
		if ((task.Status === 'Done') === checked) return;

		if (!task.IDActivity) {
			if (checked) {
				await this.initializeSingleTask(task, 'Done');
			} else {
				await this.initializeSingleTask(task);
			}
			return;
		}
		await this.completeTask(task, targetStatus);
	}

	async completeTask(task: PlanTask, status: 'Done' | 'Skipped' | 'Open') {
		if (!this.canManageActivities || this.isClosed) return;
		if (!task.IDActivity) {
			await this.initializeSingleTask(task, status === 'Open' ? undefined : status);
			return;
		}
		try {
			const res = await this.api<ActionResult>('POST', 'CRM/Activity/Complete', { Id: task.IDActivity, Status: status });
			if (!res.Success) {
				this.env.showAlert(gateMessages(res.Errors, [], []).join('\n'), null, 'Cannot complete this task');
				await this.refreshProcess();
				return;
			}
			await this.refreshProcess();
		} catch (err) {
			this.env.showMessage(this.errorText(err), 'danger');
			await this.refreshProcess();
		}
	}

	/** Main button of a task row: create/open the quotation or contract, or open the task activity. */
	async runTaskAction(task: PlanTask) {
		const action = this.taskActions[task?.Id];
		if (!action || this.busy) return;
		switch (action.kind) {
			case 'new-quotation':
				return this.openQuotationModal();
			case 'open-quotation':
				return this.openQuotationModal(this.quotations[0]);
			case 'new-contract':
				return this.openContractModal();
			case 'open-contract':
				return this.openContractModal(this.contracts[0]);
			default:
				return this.openTaskActivityModal(task);
		}
	}

	canRunTaskAction(action: TaskAction): boolean {
		if (!action) return false;
		if (action.kind === 'open-quotation' || action.kind === 'open-contract') return true;
		if (this.isClosed) return false;
		return action.kind === 'activity' ? this.canManageActivities : this.canEditDocuments;
	}

	// ---------------------------------------------------------------- quick composer & modals

	selectComposerType(taskType: string) {
		const next = toggleComposerType(this.composerType, taskType);
		this.composerType = next;
		if (next) this.composerForm.patchValue({ TaskType: next, MarkDone: defaultMarkDone(next) });
	}

	async submitQuickActivity() {
		if (!this.item?.Id || this.composerForm.invalid || this.busy || !this.canManageActivities) return;
		const v = this.composerForm.getRawValue();
		const markDone = !!v.MarkDone;
		const dueIso = v.DueDate ? `${toDateInputValue(v.DueDate)}T09:00:00` : null;
		this.busy = true;
		try {
			await this.activityProvider.save({
				IDOpportunity: this.item.Id,
				IDContact: this.item.IDContact || null,
				IDBranch: this.item.IDBranch || this.env.selectedBranch,
				IDOwner: this.item.IDOwner || null,
				IDStage: this.currentStage?.Id || this.item.IDStage || null,
				Name: (v.Name || '').trim(),
				TaskType: v.TaskType || 'Note',
				Status: markDone ? 'Done' : 'Open',
				DueDate: dueIso,
				EventDate: v.TaskType === 'Appointment' ? dueIso : null,
				CompletedDate: markDone ? new Date().toISOString() : null,
				IsRequired: false,
				Remark: (v.Remark || '').trim() || null,
			});
			this.env.showMessage('Saving completed!', 'success');
			this.composerForm.reset({
				TaskType: v.TaskType || 'Note',
				Name: '',
				DueDate: '',
				Remark: '',
				MarkDone: defaultMarkDone(v.TaskType),
			});
			await this.refreshProcess();
		} catch (err) {
			this.env.showMessage(this.errorText(err), 'danger');
		}
		this.busy = false;
	}

	async openActivityModal(activity?: any, defaultType = 'Call') {
		if (!this.item?.Id) return;
		const row = activity
			? { ...activity }
			: {
					IDOpportunity: this.item.Id,
					IDContact: this.item.IDContact || null,
					IDBranch: this.item.IDBranch || this.env.selectedBranch,
					IDOwner: this.item.IDOwner || null,
					IDStage: this.currentStage?.Id || this.item.IDStage || null,
					TaskType: defaultType,
					Status: 'Open',
			  };
		const modal = await this.modalController.create({
			component: ActivityModalPage,
			componentProps: {
				item: row,
				stages: this.plan?.Stages || [],
				ownerItem: this.ownerStaff,
				canEdit: this.canManageActivities || !!this.pageConfig?.canEdit,
				canDelete: this.canDeleteDocuments,
			},
			cssClass: 'form-1column',
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
		});
		await modal.present();
		const { role } = await modal.onWillDismiss();
		if (role === 'saved') {
			await this.refreshProcess();
		}
	}

	async openTaskActivityModal(task: PlanTask) {
		if (task.IDActivity) {
			const existing = this.activities.find((a) => a.Id === task.IDActivity) || {
				Id: task.IDActivity,
				IDOpportunity: this.item.Id,
				IDContact: this.item.IDContact || null,
				IDBranch: this.item.IDBranch || this.env.selectedBranch,
				IDStage: this.currentStage?.Id || null,
				IDStageTask: task.Id,
				Name: task.Name,
				TaskType: task.TaskType,
				Status: task.Status || 'Open',
				DueDate: task.DueDate || null,
				IsRequired: task.IsRequired,
				DocumentType: task.DocumentType || null,
				Remark: task.Guide || '',
			};
			await this.openActivityModal(existing);
		} else if (this.canManageActivities && !this.isClosed) {
			const id = await this.initializeSingleTask(task, undefined, true);
			const created = id ? this.activities.find((a) => a.Id === id) : null;
			if (created) await this.openActivityModal(created);
		}
	}

	async openQuotationModal(quotation?: any) {
		if (!this.item?.Id) return;
		const row = quotation
			? { ...quotation }
			: {
					IDOpportunity: this.item.Id,
					IDContact: this.item.IDContact || null,
					IDBranch: this.item.IDBranch || this.env.selectedBranch,
					Name: this.item.Name ? `Quotation - ${this.item.Name}` : '',
			  };
		const modal = await this.modalController.create({
			component: CrmQuotationModalPage,
			componentProps: {
				item: row,
				canEdit: this.canEditDocuments,
				canDelete: this.canDeleteDocuments,
			},
			cssClass: 'form-1column',
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
		});
		await modal.present();
		const { role } = await modal.onWillDismiss();
		if (role === 'saved') {
			await Promise.all([this.loadDocuments(), this.refreshProcess()]);
		}
	}

	async openContractModal(contract?: any) {
		if (!this.item?.Id) return;
		const row = contract
			? { ...contract }
			: {
					IDOpportunity: this.item.Id,
					IDContact: this.item.IDContact || null,
					IDBranch: this.item.IDBranch || this.env.selectedBranch,
					IDQuotation: this.quotations[0]?.Id || null,
					Name: this.item.Name ? `Contract - ${this.item.Name}` : '',
					ContractDate: toDateInputValue(new Date()),
					EventDate: this.item.EventDate || null,
					NumberOfGuests: this.item.NumberOfGuests || 0,
					Amount: this.item.Amount || 0,
			  };
		const modal = await this.modalController.create({
			component: CrmContractModalPage,
			componentProps: {
				item: row,
				quotations: this.quotations,
				canEdit: this.canEditDocuments,
				canDelete: this.canDeleteDocuments,
			},
			cssClass: 'form-1column',
			breakpoints: [0, 0.25, 0.5, 0.75, 1],
			initialBreakpoint: 0.75,
			handleBehavior: 'cycle',
			expandToScroll: false,
		});
		await modal.present();
		const { role } = await modal.onWillDismiss();
		if (role === 'saved') {
			await Promise.all([this.loadDocuments(), this.refreshProcess()]);
		}
	}

	async completeTimelineActivity(ev: TimelineEvent, status: 'Done' | 'Skipped' | 'Open') {
		if (!ev?.raw?.Id || !this.canManageActivities) return;
		await this.completeTask({ Id: 0, Name: ev.title, TaskType: ev.subType || 'Checklist', IsRequired: false, IDActivity: ev.raw.Id, Status: ev.raw.Status }, status);
	}

	dueBadgeColor(due: TaskDueStatus): string {
		switch (due) {
			case 'overdue':
				return 'danger';
			case 'due-today':
				return 'warning';
			case 'upcoming':
				return 'medium';
			default:
				return 'medium';
		}
	}

	trackById(_index: number, item: any): any {
		return item?.Id ?? _index;
	}

	trackByDayKey(_index: number, day: TimelineDayGroup): string {
		// the same day can start a second group when the events are not sorted by date
		return `${day.key}|${day.events[0]?.id}`;
	}

	trackByEventId(_index: number, ev: TimelineEvent): string {
		return ev.id;
	}
}
