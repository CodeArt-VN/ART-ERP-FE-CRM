/** Contracts of CRM/Pipeline/Qualify|Plan and CRM/Opportunity/MoveStage|Close|Reopen, CRM/Activity/Complete. */

export interface PlanTask {
	Id: number;
	Name: string;
	TaskType: string;
	DocumentType?: string;
	IsRequired: boolean;
	DueOffsetDays?: number;
	Guide?: string;
	IDActivity?: number;
	Status?: string;
	DueDate?: string;
	Sort?: number;
}

export interface PlanStage {
	Id: number;
	Name: string;
	Sort: number;
	Outcome: 'Open' | 'Won' | 'Done' | 'Lost';
	Probability: number;
	ExpectedDays?: number;
	SLAHours?: number;
	Guide?: string;
	Icon?: string;
	Color?: string;
	IsRequireLostReason: boolean;
	RequiredFields: string[];
	Tasks: PlanTask[];
	IsCurrent: boolean;
	IsPassed: boolean;
	RequiredTotal: number;
	RequiredDone: number;
}

/** Visual state of one arrow in the stage chain. */
export type StageChainState = 'current' | 'done' | 'future';

export interface PlanStageView extends PlanStage {
	effectivePassed: boolean;
	chainState?: StageChainState;
	/** 1-based position in the chain (compact label on narrow screens). */
	order?: number;
	/** `var(--ion-color-<stage color>)` and its `-contrast`, set as css variables on the arrow. */
	colorVar?: string;
	contrastVar?: string;
}

export interface PipelinePlan {
	IDPipeline: number;
	PipelineName: string;
	PostSignMode?: string;
	TotalStages: number;
	CurrentIDStage?: number;
	Stages: PlanStage[];
}

export interface QualifyCandidate {
	IDPipeline: number;
	PipelineName: string;
	Score: number;
	IsDefault: boolean;
	Reasons: string[];
}

export interface QualifyResponse {
	Recommended: QualifyCandidate;
	Candidates: QualifyCandidate[];
	Plan: PipelinePlan;
	Customer: { History: string; Returning: boolean; PreviousContracts: number; PreviousOpportunities: number; LastEventDate?: string };
	IDServiceType?: number;
	CustomerType?: string;
	Applied: boolean;
	Warnings: string[];
}

export interface MoveStageResponse {
	Success: boolean;
	Errors: string[];
	MissingFields: string[];
	PendingTasks: string[];
	IDStage?: number;
	IsClosed?: boolean;
}

export interface ActionResult {
	Success: boolean;
	Message?: string;
	Errors: string[];
}

export type TaskDueStatus = 'overdue' | 'due-today' | 'upcoming' | 'none';

/** Main button of a stage task row; `activity` opens the task's CRM_Activity. */
export type TaskActionKind = 'new-quotation' | 'open-quotation' | 'new-contract' | 'open-contract' | 'activity';

export interface TaskAction {
	kind: TaskActionKind;
	/** i18n key */
	label: string;
	icon: string;
}

export interface StageAgeInfo {
	days: number;
	hours: number;
	isOverExpected: boolean;
	isOverSla: boolean;
}

export type StageActionGroup = 'lead' | 'consult' | 'quote' | 'signed' | 'prepare' | 'event' | 'paid' | 'lost' | 'default';

export type TimelineKind = 'stage' | 'activity' | 'milestone' | 'edit';
export type TimelineFilter = 'all' | 'stage' | 'activity' | 'note_call' | 'milestone' | 'edit';

export interface TimelineEvent {
	id: string;
	kind: TimelineKind;
	subType?: string;
	title: string;
	subtitle?: string;
	note?: string;
	actor?: string;
	date: string;
	dateMs: number;
	icon: string;
	color: string;
	badge?: string;
	raw?: any;
}

/** Timeline events of one calendar day (journal entry group). */
export interface TimelineDayGroup {
	/** Local day, yyyy-MM-dd. */
	key: string;
	/** Start of that local day in ms. */
	dayMs: number;
	events: TimelineEvent[];
	/** Calendar days between this group and the previous displayed group (0 for the first group). */
	gapDays: number;
	/** The connector to the previous group spans 2 or more calendar days (drawn dashed). */
	longGapBefore: boolean;
	/** The connector to the next group spans 2 or more calendar days (drawn dashed). */
	longGapAfter: boolean;
}

export interface LostStageInfo {
	stageWhenLost: string | null;
	isUnknownPrior: boolean;
	lostDate?: string | null;
	lostBy?: string | null;
}

export interface StageTaskSummary {
	total: number;
	done: number;
	requiredTotal: number;
	requiredDone: number;
	requiredPercent: number;
	overdueCount: number;
	dueTodayCount: number;
	uninitializedCount: number;
	nextRequiredTask: PlanTask | null;
}
