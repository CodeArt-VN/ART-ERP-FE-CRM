import { ChangeDetectorRef, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController, NavController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { concat, firstValueFrom, Observable, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { NFC, NDEFWriteOptions } from '@exxili/capacitor-nfc';
import { environment } from 'src/environments/environment';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, CRM_MemberCardProvider } from 'src/app/services/static/services.service';
import { Rd300WebSerialWriter } from './serial-writer/rd300-web-serial-writer';

type RequestMode = 'Insert' | 'Update';
type StepKey = 1 | 2;
type WritePhase = 'idle' | 'waitingForCard' | 'validatingCard' | 'writing' | 'saving' | 'success' | 'error' | 'completed';

interface ContactOption {
	Id: number;
	Name?: string;
	Code?: string;
	Phone1?: string;
	Email?: string;
}

interface ImportQueueSummary {
	TotalRows: number;
	ValidForQueueCount: number;
	CreatedContactCount: number;
	AlreadyHasMemberCardCount: number;
	DisabledOrDeletedCount: number;
	DuplicatePhoneCount: number;
	InvalidRowCount: number;
}

interface ImportQueueResult {
	Summary?: ImportQueueSummary;
	ValidContactsForQueue?: ContactOption[];
	FileUrl?: string;
}

interface WriteRequestViewModel {
	requestId: string;
	mode: RequestMode;
	memberCardId?: number;
	displayName: string;
	displayCode: string;
	remark: string;
	selectedContactId?: number;
	selectedContact?: ContactOption | null;
	memberCardPayload?: any;
	requestStatus: 'Pending' | 'Completed' | 'Failed';
	serialNumber?: string;
	raw: any;
}

@Component({
	selector: 'app-write-nfc-modal',
	templateUrl: 'write-nfc-modal.page.html',
	styleUrls: ['write-nfc-modal.page.scss'],
	standalone: false,
})
export class WriteNfcModalPage extends PageBase implements OnDestroy {
	@Input() title = 'Write NFC Card';
	@ViewChild('importFileInput') importFileInput?: ElementRef<HTMLInputElement>;

	currentStep: StepKey = 1;
	requestKeyword = '';
	requestList: WriteRequestViewModel[] = [];
	selectedRequest: WriteRequestViewModel = null;
	statusList = [];
	private localRequestList: WriteRequestViewModel[] = [];
	private removedRequestIds = new Set<string>();

	contactOptions: ContactOption[] = [];
	contactList$: Observable<ContactOption[]>;
	contactListLoading = false;
	contactListInput$ = new Subject<string>();
	contactListSelected: ContactOption[] = [];
	contactPickerOpen = false;
	contactPickerKeyword = '';
	contactPickerOptions: ContactOption[] = [];
	contactPickerLoading = false;
	contactPickerSelection: { [contactId: number]: ContactOption } = {};
	selectedContactId: number = null;
	selectedContact: ContactOption = null;
	importSummary: ImportQueueSummary | null = null;
	importChecklistUrl = '';
	lastImportedQueueCount = 0;

	writePhase: WritePhase = 'idle';
	statusMessage = 'Prepare the request queue to start batch write.';
	errorMessage = '';
	lastDetectedSerial = '';
	lastSavedItem: any = null;

	private writeToken = 0;
	private removeWriteListener?: () => void;
	private removeErrorListener?: () => void;
	private removeReadListener?: () => void;
	private hasWrittenPayload = false;
	private rd300Writer?: Rd300WebSerialWriter;

	constructor(
		public pageProvider: CRM_MemberCardProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		private contactProvider: CRM_ContactProvider,
		private zone: NgZone,
		public cdr: ChangeDetectorRef
	) {
		super();
		this.pageConfig.isDetailPage = false;
		this.pageConfig.infiniteScroll = true;
	}

	ngOnDestroy(): void {
		super.ngOnDestroy();
		this.writeToken++;
		this.contactListInput$.complete();
		void this.cleanupReaders();
	}

	preLoadData(event?: any): void {
		Promise.all([this.env.getStatus('StandardApprovalStatus')]).then((values: any) => {
			this.statusList = values[0] || [];
			super.preLoadData(event);
		});
	}

	loadData(event = null, forceReload = false) {
		this.query.Take = this.query.Take || 20;
		this.query.SortBy = this.query.SortBy || '[Id_desc]';
		super.loadData(event, forceReload);
	}

	loadedData(event = null) {
		this.items.forEach((item) => {
			item._Status = this.statusList.find((status) => status.Code == item.Status);
			item.Avatar = item._Member?.Code ? environment.staffAvatarsServer + item._Staff?.Code + '.jpg' : 'assets/avartar-empty.jpg';
			item.Email = item._Member?.Email ? item._Staff?.Email.replace(environment.loginEmail, '') : '';
		});

		this.initContactSearch();
		this.contactListInput$.next('');
		this.rebuildRequestList();
		super.loadedData(event);
	}

	get stepOffset(): string {
		return `translateX(-${(this.currentStep - 1) * 100}%)`;
	}

	get isBusy(): boolean {
		return ['waitingForCard', 'validatingCard', 'writing', 'saving'].includes(this.writePhase);
	}

	get isPrimaryDisabled(): boolean {
		if (this.currentStep === 1) return !this.canStartBatch;
		return this.isBusy || !['error', 'completed'].includes(this.writePhase);
	}

	get footerPrimaryLabel(): string {
		if (this.currentStep === 1) return 'Start Batch Write';
		if (this.writePhase === 'completed') return 'Finish';
		if (this.writePhase === 'error' && this.hasWrittenPayload && this.lastDetectedSerial) return 'Save To Database';
		return 'Retry Current Request';
	}

	get writeStateLabel(): string {
		switch (this.writePhase) {
			case 'waitingForCard':
				return 'Waiting For Card';
			case 'validatingCard':
				return 'Validating Card';
			case 'writing':
				return 'Writing Data';
			case 'saving':
				return 'Saving To Database';
			case 'success':
				return 'Request Completed';
			case 'completed':
				return 'Batch Completed';
			case 'error':
				return 'Action Required';
			default:
				return 'Preparation';
		}
	}

	get requestEmptyMessage(): string {
		if (this.pageConfig.showSpinner) return 'Loading card write requests.';
		return 'No card write requests available.';
	}

	get filteredRequestList(): WriteRequestViewModel[] {
		const keyword = `${this.requestKeyword || ''}`.trim().toLowerCase();
		if (!keyword) return this.requestList;

		return this.requestList.filter((item) => {
			const searchSource = [item.displayName, item.displayCode, item.selectedContact?.Name, item.selectedContact?.Code, item.selectedContactId]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return searchSource.includes(keyword);
		});
	}

	get totalRequestCount(): number {
		return this.requestList.length;
	}

	get completedRequestCount(): number {
		return this.requestList.filter((item) => item.requestStatus === 'Completed').length;
	}

	get failedRequestCount(): number {
		return this.requestList.filter((item) => item.requestStatus === 'Failed').length;
	}

	get pendingRequestCount(): number {
		return this.requestList.filter((item) => item.requestStatus === 'Pending').length;
	}

	get pendingWithoutContactCount(): number {
		return this.requestList.filter((item) => item.requestStatus === 'Pending' && !item.selectedContactId).length;
	}

	get readyRequestCount(): number {
		return this.getBatchRequests().length;
	}

	get canStartBatch(): boolean {
		return this.pendingRequestCount > 0 && this.pendingWithoutContactCount === 0 && !this.isBusy;
	}

	get selectedContactCount(): number {
		return Object.keys(this.contactPickerSelection).length;
	}

	get batchProgressValue(): number {
		const total = this.totalRequestCount || 1;
		return this.completedRequestCount / total;
	}

	get currentBatchSequence(): number {
		if (!this.selectedRequest) return 0;
		const queue = this.getBatchQueueOrder();
		const index = queue.findIndex((item) => item.requestId === this.selectedRequest.requestId);
		return index >= 0 ? index + 1 : 0;
	}

	get batchQueuePreview(): WriteRequestViewModel[] {
		return this.requestList.filter((item) => item.requestStatus === 'Pending');
	}

	get hasImportSummary(): boolean {
		return !!this.importSummary;
	}

	get activeWriterLabel(): string {
		return this.isNativeNfcPlatform() ? 'Native NFC' : 'RD300 Web Serial';
	}

	trackByRequest(_: number, item: WriteRequestViewModel): string {
		return item.requestId;
	}

	trackByContact(_: number, item: ContactOption): number {
		return item.Id;
	}

	compareContactById = (first: ContactOption | null, second: ContactOption | null): boolean => {
		if (!first && !second) return true;
		if (!first || !second) return false;
		return first.Id === second.Id;
	};

	onRequestSearch(event: any): void {
		const keyword = `${event?.detail?.value ?? event?.target?.value ?? ''}`;
		this.requestKeyword = keyword;

		if (keyword.length > 2 || keyword === '') {
			this.query.Keyword = keyword;
			this.query.Skip = 0;
			this.pageConfig.isEndOfData = false;
			this.loadData('search', true);
		}
	}

	loadMoreRequests(event: any): void {
		if (this.currentStep !== 1 || this.pageConfig.isEndOfData) {
			event?.target?.complete();
			return;
		}

		this.loadData(event);
	}

	async closeModal(role: 'cancel' | 'confirm' = 'cancel'): Promise<void> {
		this.writeToken++;
		await this.cleanupReaders();
		await this.modalController.dismiss(
			{
				savedItem: this.lastSavedItem,
				request: this.selectedRequest,
				serialNumber: this.lastDetectedSerial || this.selectedRequest?.serialNumber || null,
				completedCount: this.completedRequestCount,
				totalCount: this.totalRequestCount,
			},
			role
		);
	}

	openImportFilePicker(): void {
		if (this.isBusy) return;
		this.importFileInput?.nativeElement?.click();
	}

	async onImportFileSelected(event: Event): Promise<void> {
		const input = event?.target as HTMLInputElement;
		const file = input?.files?.[0];
		if (!file) return;

		try {
			await this.importContactsFromExcel(file);
		} catch (error) {
			this.env.showMessage(this.resolveErrorMessage(error, 'Cannot import contacts from the selected Excel file.'), 'danger');
		} finally {
			if (input) {
				input.value = '';
			}
		}
	}

	downloadImportChecklist(): void {
		if (!this.importChecklistUrl) return;
		this.downloadURLContent(this.importChecklistUrl);
	}

	async addNewRequest(): Promise<void> {
		this.contactPickerOpen = true;
		this.contactPickerKeyword = '';
		this.contactPickerSelection = {};
		await this.loadContactPickerOptions();
	}

	closeContactPicker(): void {
		this.contactPickerOpen = false;
		this.contactPickerKeyword = '';
		this.contactPickerLoading = false;
		this.contactPickerSelection = {};
	}

	onContactPickerSearch(event: any): void {
		this.contactPickerKeyword = `${event?.detail?.value ?? event?.target?.value ?? ''}`;
		void this.loadContactPickerOptions(this.contactPickerKeyword);
	}

	toggleContactPickerSelection(contact: ContactOption): void {
		if (!contact?.Id || this.isContactQueued(contact.Id)) return;

		if (this.contactPickerSelection[contact.Id]) {
			delete this.contactPickerSelection[contact.Id];
		} else {
			this.contactPickerSelection = {
				...this.contactPickerSelection,
				[contact.Id]: contact,
			};
		}
	}

	isContactPickerSelected(contactId: number): boolean {
		return !!this.contactPickerSelection[contactId];
	}

	isContactQueued(contactId: number): boolean {
		return this.requestList.some((item) => item.selectedContactId === contactId);
	}

	async addSelectedContactsToQueue(): Promise<void> {
		const contacts = Object.values(this.contactPickerSelection);
		if (!contacts.length) {
			this.env.showMessage('Please select at least one contact.', 'warning');
			return;
		}

		this.contactPickerLoading = true;
		try {
			const nextRequests = await this.buildRequestsFromContacts(contacts);
			if (!nextRequests.length) {
				this.env.showMessage('All selected contacts are already in the queue.', 'warning');
				return;
			}

			this.localRequestList = [...nextRequests, ...this.localRequestList];
			this.rebuildRequestList();
			this.selectRequest(nextRequests[0]);
			this.closeContactPicker();
			this.env.showMessage(`${nextRequests.length} contact(s) were added to the queue.`, 'success');
		} catch (error) {
			this.env.showMessage(this.resolveErrorMessage(error, 'Cannot prepare the selected contacts.'), 'danger');
		} finally {
			this.contactPickerLoading = false;
		}
	}

	removeQueuedRequest(request: WriteRequestViewModel, event?: Event): void {
		event?.stopPropagation();
		if (!request || this.isBusy) return;

		this.localRequestList = this.localRequestList.filter((item) => item.requestId !== request.requestId);
		this.removedRequestIds.add(request.requestId);
		this.rebuildRequestList();

		if (this.selectedRequest?.requestId === request.requestId) {
			const nextRequest = this.requestList.find((item) => item.requestStatus === 'Pending') || this.requestList[0] || null;
			if (nextRequest) {
				this.selectRequest(nextRequest);
			} else {
				this.selectedRequest = null;
				this.selectedContact = null;
				this.selectedContactId = null;
				this.resetBatchState(true);
			}
		}

		this.env.showMessage(`Removed ${request.displayName} from the queue.`, 'primary');
	}

	selectRequest(request: WriteRequestViewModel): void {
		if (!request) return;
		if (this.isBusy && this.currentStep === 2) return;

		this.selectedRequest = request;
		this.selectedContact = request.selectedContact || null;
		this.selectedContactId = request.selectedContactId || null;
		this.syncSelectedContactIntoOptions();
		this.triggerContactSearch();
		this.resetBatchState(false);
	}

	async onContactSelected(contact: ContactOption | null): Promise<void> {
		this.selectedContact = contact || null;
		this.selectedContactId = this.selectedContact?.Id || null;

		if (this.selectedRequest) {
			this.selectedRequest.selectedContactId = this.selectedContactId;
			this.selectedRequest.selectedContact = this.selectedContact;
		}

		this.syncSelectedContactIntoOptions();
		this.rebuildRequestList();
	}

	goToStep(step: StepKey): void {
		this.currentStep = step;
		this.cdr.detectChanges();
	}

	goToPreviousStep(): void {
		if (this.currentStep === 1 || this.isBusy) return;

		this.writeToken++;
		void this.cleanupReaders();
		this.resetBatchState(true);
		this.goToStep(1);
	}

	async handlePrimaryAction(): Promise<void> {
		if (this.currentStep === 1) {
			await this.startBatchSession();
			return;
		}

		if (this.writePhase === 'completed') {
			await this.closeModal('confirm');
			return;
		}

		if (this.writePhase === 'error' && this.hasWrittenPayload && this.lastDetectedSerial) {
			await this.saveToDatabase(this.lastDetectedSerial);
			return;
		}

		await this.startWriteFlow();
	}

	private async startBatchSession(): Promise<void> {
		if (this.pendingWithoutContactCount > 0) {
			this.env.showMessage('Please assign a contact to every pending request before starting batch write.', 'warning');
			return;
		}

		const nextRequest = this.getFirstPendingRequest();
		if (!nextRequest) {
			this.env.showMessage('No pending request is ready for batch write.', 'warning');
			return;
		}

		this.selectRequest(nextRequest);
		this.goToStep(2);
		await this.startWriteFlow();
	}

	private async startWriteFlow(): Promise<void> {
		if (!this.selectedRequest || !this.selectedContactId) {
			this.writePhase = 'error';
			this.errorMessage = 'Please assign a contact before continuing.';
			this.statusMessage = '';
			return;
		}

		const token = ++this.writeToken;
		this.resetBatchState(false);
		this.writePhase = 'waitingForCard';

		if (!this.isNativeNfcPlatform()) {
			await this.startRd300WriteFlow(token);
			return;
		}

		this.statusMessage = `Place an NFC card near the phone to write member ${this.selectedRequest.displayName}.`;

		const pluginReady = await this.ensureNfcReady();
		if (!pluginReady || token !== this.writeToken) return;

		await this.cleanupNfc();
		if (token !== this.writeToken) return;

		this.removeErrorListener = NFC.onError((error) => {
			this.runInZone(() => {
				if (token !== this.writeToken) return;
				this.writePhase = 'error';
				this.errorMessage = this.resolveErrorMessage(error, 'Cannot continue the NFC batch write session.');
				this.statusMessage = '';
			});
		});

		await this.writeCardData(token);
	}

	private async startRd300WriteFlow(token: number): Promise<void> {
		if (token !== this.writeToken) return;

		await this.cleanupNfc();
		this.runInZone(() => {
			if (token !== this.writeToken) return;
			this.writePhase = 'waitingForCard';
			this.statusMessage = `Place an NFC card on the RD300 reader to write member ${this.selectedRequest.displayName}.`;
			this.errorMessage = '';
		});

		try {
			const writer = this.getRd300Writer();
			const result = await writer.writeMemberCard(this.selectedContactId);
			if (token !== this.writeToken) return;

			this.runInZone(() => {
				if (token !== this.writeToken) return;
				this.lastDetectedSerial = result.cardCode;
				this.writePhase = 'validatingCard';
				this.statusMessage = `RD300 wrote ${result.tagType === 'desfire-ev3' ? 'DESFire EV3' : 'NTAG'} data. Checking the card before saving.`;
				this.errorMessage = '';
			});

			await this.validateWrittenCardAndSave(result.cardCode, token, 'RD300 write completed. Saving to the database.');
		} catch (error) {
			if (token !== this.writeToken) return;
			this.runInZone(() => {
				if (token !== this.writeToken) return;
				this.writePhase = 'error';
				this.errorMessage = this.resolveErrorMessage(error, 'Cannot write the NFC card with RD300.');
				this.statusMessage = '';
			});
		}
	}

	private async writeCardData(token: number): Promise<void> {
		if (token !== this.writeToken) return;

		this.runInZone(() => {
			if (token !== this.writeToken) return;
			this.writePhase = 'waitingForCard';
			this.statusMessage = 'Place an NFC card near the phone and keep it steady until the write completes.';
			this.errorMessage = '';
		});

		this.removeWriteListener?.();
		this.removeWriteListener = NFC.onWrite((result?: any) => {
			void this.handleWriteSuccess(result, token);
		});

		try {
			this.runInZone(() => {
				if (token !== this.writeToken) return;
				this.writePhase = 'writing';
				this.statusMessage = 'Ready to write. Place the NFC card near the phone now.';
			});
			await NFC.writeNDEF(this.buildWritePayload());
		} catch (error) {
			if (token !== this.writeToken) return;
			this.writePhase = 'error';
			this.errorMessage = this.resolveErrorMessage(error, 'Cannot initialize the NFC write session.');
			this.statusMessage = '';
		}
	}

	private async handleWriteSuccess(result: any, token: number): Promise<void> {
		if (token !== this.writeToken) return;

		const rawSerialNumber = `${result?.tagInfo?.uid || result?.uid || ''}`.trim();
		const normalizedSerialNumber = this.normalizeCardCode(rawSerialNumber);
		if (!normalizedSerialNumber) {
			this.runInZone(() => {
				if (token !== this.writeToken) return;
				this.writePhase = 'error';
				this.errorMessage = 'The NFC write completed but the card serial number was not returned by the device.';
				this.statusMessage = '';
			});
			return;
		}

		this.runInZone(() => {
			if (token !== this.writeToken) return;
			this.hasWrittenPayload = true;
			this.lastDetectedSerial = rawSerialNumber;
			this.writePhase = 'validatingCard';
			this.statusMessage = 'Checking the written card before saving.';
			this.errorMessage = '';
		});

		await this.validateWrittenCardAndSave(rawSerialNumber, token, 'NFC write completed. Saving to the database.');
	}

	private async validateWrittenCardAndSave(serialNumber: string, token: number, successMessage: string): Promise<void> {
		if (token !== this.writeToken) return;

		const duplicatedRequest = this.findRequestByCardCode(serialNumber, this.selectedRequest?.requestId);
		if (duplicatedRequest) {
			await this.retryCurrentRequestWithAnotherCard(`Card ${serialNumber} is already assigned in the current queue. Please place another card.`);
			return;
		}

		try {
			const existsInDatabase = await this.checkCardCodeExistsInDatabase(serialNumber, this.selectedRequest?.memberCardId);
			if (token !== this.writeToken) return;
			if (existsInDatabase) {
				await this.retryCurrentRequestWithAnotherCard(`Card ${serialNumber} has already been used in the system. Please place another card.`);
				return;
			}
		} catch (error) {
			this.writePhase = 'error';
			this.errorMessage = this.resolveErrorMessage(error, 'Cannot validate the card code in the database.');
			this.statusMessage = '';
			return;
		}

		this.statusMessage = successMessage;
		await this.saveToDatabase(serialNumber);
	}

	private async saveToDatabase(serialNumber: string): Promise<void> {
		if (!this.selectedRequest || !this.selectedContactId) {
			this.writePhase = 'error';
			this.errorMessage = 'Missing data required to save the MemberCard to the database.';
			this.statusMessage = '';
			return;
		}

		this.writePhase = 'saving';
		this.errorMessage = '';
		this.statusMessage = 'Updating MemberCard data in the database.';

		try {
			await this.cleanupNfc();
			const payload = this.buildSavePayload(serialNumber);
			const savedItem: any = await this.pageProvider.save(payload, this.selectedRequest.mode === 'Insert');

			this.lastSavedItem = savedItem;
			this.selectedRequest.requestStatus = 'Completed';
			this.selectedRequest.serialNumber = serialNumber;
			this.selectedRequest.displayCode = serialNumber;
			this.selectedRequest.memberCardId = savedItem?.Id || this.selectedRequest.memberCardId;
			this.selectedRequest.memberCardPayload = savedItem || payload;
			this.hasWrittenPayload = false;
			this.writePhase = 'success';
			this.statusMessage = 'The card was written successfully. Preparing the next request.';
			this.env.showMessage(`Card written successfully for ${this.selectedRequest.displayName}.`, 'success');

			const completedRequestId = this.selectedRequest.requestId;
			const nextRequest = this.getNextPendingRequest();
			if (!nextRequest) {
				this.writePhase = 'completed';
				this.statusMessage = 'All selected requests have been written successfully.';
				setTimeout(() => {
					if (this.writePhase === 'completed') {
						void this.closeModal('confirm');
					}
				}, 500);
				return;
			}

			setTimeout(() => {
				if (this.selectedRequest?.requestId !== completedRequestId || this.currentStep !== 2) return;
				this.selectRequest(nextRequest);
				void this.startWriteFlow();
			}, 250);
		} catch (error) {
			this.selectedRequest.requestStatus = 'Failed';
			this.writePhase = 'error';
			this.errorMessage = this.resolveErrorMessage(error, 'Cannot save MemberCard data to the database.');
			this.statusMessage = '';
		}
	}

	private buildWritePayload(): NDEFWriteOptions<string> {
		return {
			records: [
				{
					type: 'T',
					payload: JSON.stringify({
						IDBP: this.selectedContactId,
					}),
				},
			],
		};
	}

	private buildSavePayload(serialNumber: string): any {
		const basePayload =
			this.selectedRequest?.memberCardPayload && typeof this.selectedRequest.memberCardPayload === 'object' ? { ...this.selectedRequest.memberCardPayload } : {};
		const payload: any = {
			Code: serialNumber,
			IDMember: this.selectedContactId,
			Status: 'Approved',
		};

		if (!payload.Name && (basePayload?.Name || this.selectedContact?.Name || this.selectedRequest?.displayName)) {
			payload.Name = basePayload?.Name || this.selectedContact?.Name || this.selectedRequest?.displayName;
		}

		if (this.selectedRequest.mode === 'Update') {
			const memberCardId = this.selectedRequest.memberCardId || basePayload?.Id;
			if (!memberCardId) {
				throw new Error('Missing MemberCard Id for update.');
			}

			payload.Id = memberCardId;
		} else {
			payload.StartDate = new Date().toISOString();
			payload.Id = 0;
		}

		return payload;
	}

	private async ensureNfcReady(): Promise<boolean> {
		if (!this.isNativeNfcPlatform()) {
			this.writePhase = 'error';
			this.errorMessage = 'NFC is not supported on the web platform.';
			return false;
		}

		if (!Capacitor.isPluginAvailable('NFC')) {
			this.writePhase = 'error';
			this.errorMessage = 'The NFC plugin is not available in the current build.';
			return false;
		}

		try {
			const support = await NFC.isSupported();
			if (!support?.supported) {
				this.writePhase = 'error';
				this.errorMessage = 'This device does not support NFC or NFC is turned off.';
				return false;
			}
		} catch (error) {
			this.writePhase = 'error';
			this.errorMessage = this.resolveErrorMessage(error, 'Cannot determine the NFC status of this device.');
			return false;
		}

		return true;
	}

	private initContactSearch(): void {
		this.contactList$ = concat(
			of(this.contactListSelected),
			this.contactListInput$.pipe(
				distinctUntilChanged(),
				tap(() => (this.contactListLoading = true)),
				switchMap((term) =>
					this.contactProvider
						.search({
							SkipAddress: true,
							SortBy: ['Id_desc'],
							Take: 20,
							Skip: 0,
							Keyword: term || '',
						})
						.pipe(
							map((result: any) => (Array.isArray(result) ? result : result?.data || [])),
							tap((contacts: ContactOption[]) => {
								this.contactOptions = contacts || [];
								this.syncSelectedContactIntoOptions();
							}),
							catchError((error) => {
								this.env.showMessage(this.resolveErrorMessage(error, 'Cannot load the contact list.'), 'danger');
								return of([]);
							}),
							tap(() => {
								this.contactListLoading = false;
								this.cdr.detectChanges();
							})
						)
				)
			)
		);
	}

	private async loadContactPickerOptions(keyword = ''): Promise<void> {
		this.contactPickerLoading = true;
		try {
			const result: any = await firstValueFrom(
				this.contactProvider.search({
					SkipAddress: true,
					SortBy: ['Id_desc'],
					Take: 30,
					Skip: 0,
					Keyword: keyword || '',
				})
			);
			this.contactPickerOptions = Array.isArray(result) ? result : result?.data || [];
		} catch (error) {
			this.contactPickerOptions = [];
			this.env.showMessage(this.resolveErrorMessage(error, 'Cannot load contacts for the picker.'), 'danger');
		} finally {
			this.contactPickerLoading = false;
			this.cdr.detectChanges();
		}
	}

	private async importContactsFromExcel(file: File): Promise<void> {
		const response = (await this.env.showLoading('Processing the import file.', this.uploadImportFile(file))) as ImportQueueResult;
		const importedContacts = Array.isArray(response?.ValidContactsForQueue) ? response.ValidContactsForQueue : [];
		const nextRequests = await this.buildRequestsFromContacts(importedContacts);

		if (nextRequests.length) {
			this.localRequestList = [...nextRequests, ...this.localRequestList];
			this.rebuildRequestList();
			this.selectRequest(nextRequests[0]);
		}

		this.importSummary = response?.Summary || null;
		this.importChecklistUrl = response?.FileUrl || '';
		this.lastImportedQueueCount = nextRequests.length;

		const skippedQueuedCount = Math.max(importedContacts.length - nextRequests.length, 0);
		const summaryMessage = this.buildImportSummaryMessage(this.importSummary, nextRequests.length, skippedQueuedCount);

		this.env.showMessage(`${nextRequests.length} contact(s) were added to the queue from the import file.`, nextRequests.length ? 'success' : 'warning');

		if (this.importChecklistUrl) {
			await this.env
				.showPrompt(summaryMessage, 'Would you like to download the import checklist now?', 'Import Contact Queue', 'Download Checklist', 'Close')
				.then(() => {
					this.downloadImportChecklist();
				})
				.catch(() => undefined);
			return;
		}

		await this.env.showPrompt(summaryMessage, null, 'Import Contact Queue', 'Close', null).catch(() => undefined);
	}

	private uploadImportFile(file: File): Promise<ImportQueueResult> {
		const apiPath = {
			postImport: {
				method: 'UPLOAD',
				url: () => 'CRM/MemberCard/ImportContactQueue',
			},
		};

		return this.pageProvider.commonService.import(apiPath, file) as Promise<ImportQueueResult>;
	}

	private buildImportSummaryMessage(summary: ImportQueueSummary | null, addedToQueueCount: number, skippedQueuedCount: number): string {
		if (!summary) {
			return `Added ${addedToQueueCount} contact(s) to the queue.`;
		}

		const lines = [
			`Total rows: ${summary.TotalRows || 0}`,
			`Added to queue: ${addedToQueueCount}`,
			`Created contacts: ${summary.CreatedContactCount || 0}`,
			`Already has member card: ${summary.AlreadyHasMemberCardCount || 0}`,
			`Disabled or deleted contact: ${summary.DisabledOrDeletedCount || 0}`,
			`Duplicate phone: ${summary.DuplicatePhoneCount || 0}`,
			`Invalid rows: ${summary.InvalidRowCount || 0}`,
		];

		if (skippedQueuedCount > 0) {
			lines.push(`Skipped because the contact was already queued: ${skippedQueuedCount}`);
		}

		return lines.join('<br>');
	}

	private async buildRequestsFromContacts(contacts: ContactOption[]): Promise<WriteRequestViewModel[]> {
		const dedupedContacts = contacts.filter((contact, index, source) => source.findIndex((item) => item.Id === contact.Id) === index && !this.isContactQueued(contact.Id));
		if (!dedupedContacts.length) return [];

		const existingCardsByContactId = await this.resolveExistingMemberCards(dedupedContacts.map((item) => item.Id));
		return dedupedContacts.map((contact, index) => this.createRequestFromContact(contact, existingCardsByContactId.get(contact.Id), index));
	}

	private async resolveExistingMemberCards(contactIds: number[]): Promise<Map<number, any>> {
		const mapByContactId = new Map<number, any>();
		if (!contactIds.length) return mapByContactId;

		try {
			const result: any = await this.pageProvider.read(
				{
					IDMember: contactIds,
					Take: Math.max(contactIds.length, 30),
				},
				true
			);
			const records = Array.isArray(result?.data) ? result.data : [];
			records.forEach((item) => {
				const contactId = item?.IDMember || item?._Member?.Id;
				if (contactId && !mapByContactId.has(contactId)) {
					mapByContactId.set(contactId, item);
				}
			});
		} catch {
			for (const contactId of contactIds) {
				try {
					const result: any = await this.pageProvider.read(
						{
							IDMember_eq: contactId,
							Take: 1,
						},
						true
					);
					const matched = Array.isArray(result?.data) ? result.data[0] : null;
					if (matched) {
						mapByContactId.set(contactId, matched);
					}
				} catch {
					/* ignore fallback errors per item */
				}
			}
		}

		return mapByContactId;
	}

	private createRequestFromContact(contact: ContactOption, existingMemberCard: any, index: number): WriteRequestViewModel {
		const hasExistingMemberCard = !!existingMemberCard?.Id;
		return {
			requestId: `${hasExistingMemberCard ? existingMemberCard.Id : 'contact'}-${contact.Id}-${Date.now()}-${index}`,
			mode: hasExistingMemberCard ? 'Update' : 'Insert',
			memberCardId: existingMemberCard?.Id || null,
			displayName: contact?.Name || `Contact #${contact.Id}`,
			displayCode: existingMemberCard?.Code || '',
			remark: hasExistingMemberCard ? 'Existing MemberCard will be updated during batch write.' : 'A new MemberCard will be created during batch write.',
			selectedContactId: contact.Id,
			selectedContact: contact,
			memberCardPayload: existingMemberCard || null,
			requestStatus: 'Pending',
			serialNumber: existingMemberCard?.SerialNumber || existingMemberCard?.Code || '',
			raw: existingMemberCard || { _Member: contact },
		};
	}

	private normalizeRequests(source: any[] = this.items): WriteRequestViewModel[] {
		if (!Array.isArray(source) || !source.length) return [];

		return source.map((raw, index) => {
			const explicitMode = `${raw?.Mode || raw?.Type || raw?.mode || ''}`.toLowerCase();
			const memberCardPayload = raw?.MemberCard || raw?.memberCard || raw?.Payload || raw?.payload || (this.looksLikeMemberCard(raw) ? { ...raw } : null);
			const memberCardId =
				raw?.MemberCardId ||
				raw?.IDMemberCard ||
				raw?.memberCardId ||
				memberCardPayload?.Id ||
				(explicitMode === 'update' ? raw?.Id : null) ||
				(this.looksLikeMemberCard(raw) ? raw?.Id : null);
			const mode: RequestMode = explicitMode === 'insert' ? 'Insert' : memberCardId ? 'Update' : 'Insert';
			const preselectedContact = raw?._Member || raw?.Contact || raw?._Contact || null;
			const selectedContactId = raw?.IDMember || raw?.IDContact || preselectedContact?.Id || null;

			return {
				requestId: `${memberCardId || raw?.Id || raw?.Code || raw?.SerialNumber || index}`,
				mode,
				memberCardId,
				displayName: raw?.Name || raw?.Title || preselectedContact?.Name || `Card Write Request #${index + 1}`,
				displayCode: raw?.Code || raw?.RequestCode || raw?.MemberCardCode || '',
				remark: raw?.Remark || raw?.Description || '',
				selectedContactId,
				selectedContact: preselectedContact,
				memberCardPayload,
				requestStatus: this.normalizeRequestStatus(raw),
				serialNumber: raw?.SerialNumber || raw?.Code || '',
				raw,
			};
		});
	}

	private rebuildRequestList(): void {
		const existingRequests = new Map(this.requestList.map((item) => [item.requestId, item]));
		const remoteRequests = this.normalizeRequests(this.items).map((item) => this.mergeRequestState(item, existingRequests.get(item.requestId)));
		const nextRequestList = this.mergeUniqueRequests([...this.localRequestList, ...remoteRequests]).filter((item) => !this.removedRequestIds.has(item.requestId));
		this.requestList = nextRequestList;
		this.syncSelectedRequestReference();
	}

	private mergeRequestState(request: WriteRequestViewModel, existing?: WriteRequestViewModel): WriteRequestViewModel {
		if (!existing) return request;

		return {
			...request,
			requestStatus: existing.requestStatus || request.requestStatus,
			selectedContactId: existing.selectedContactId ?? request.selectedContactId,
			selectedContact: existing.selectedContact ?? request.selectedContact,
			memberCardPayload: existing.memberCardPayload ?? request.memberCardPayload,
			serialNumber: existing.serialNumber || request.serialNumber,
			displayCode: existing.displayCode || request.displayCode,
		};
	}

	private mergeUniqueRequests(requests: WriteRequestViewModel[]): WriteRequestViewModel[] {
		const uniqueRequests = new Map<string, WriteRequestViewModel>();

		requests.forEach((request) => {
			const requestKey = this.getRequestIdentityKey(request);
			if (!uniqueRequests.has(requestKey)) {
				uniqueRequests.set(requestKey, request);
			}
		});

		return Array.from(uniqueRequests.values());
	}

	private getRequestIdentityKey(request: WriteRequestViewModel): string {
		if (request.memberCardId) return `member-card-${request.memberCardId}`;

		const cardCode = this.normalizeCardCode(request.serialNumber || request.displayCode);
		if (cardCode) return `card-code-${cardCode}`;

		return `request-id-${request.requestId}`;
	}

	private syncSelectedRequestReference(): void {
		if (!this.selectedRequest) return;

		const matchedRequest = this.requestList.find((item) => item.requestId === this.selectedRequest.requestId);
		if (!matchedRequest) return;

		this.selectedRequest = matchedRequest;
		this.selectedContact = matchedRequest.selectedContact || this.selectedContact;
		this.selectedContactId = matchedRequest.selectedContactId || this.selectedContactId;
	}

	private looksLikeMemberCard(raw: any): boolean {
		if (!raw || typeof raw !== 'object') return false;
		return ['Code', 'StartDate', 'EndDate', 'Quota', 'DailyLimit', 'IDMember'].some((key) => Object.prototype.hasOwnProperty.call(raw, key));
	}

	private getBatchRequests(): WriteRequestViewModel[] {
		return this.requestList.filter((item) => item.requestStatus === 'Pending' && !!item.selectedContactId);
	}

	private getFirstPendingRequest(): WriteRequestViewModel | null {
		return this.getBatchRequests()[0] || null;
	}

	private getBatchQueueOrder(): WriteRequestViewModel[] {
		return this.requestList.filter((item) => item.requestStatus !== 'Failed');
	}

	private getNextPendingRequest(): WriteRequestViewModel | null {
		const pendingRequests = this.getBatchRequests();
		if (!pendingRequests.length) return null;

		const currentIndex = pendingRequests.findIndex((item) => item.requestId === this.selectedRequest?.requestId);
		if (currentIndex >= 0 && currentIndex < pendingRequests.length - 1) {
			return pendingRequests[currentIndex + 1];
		}

		if (currentIndex === -1) return pendingRequests[0];
		return null;
	}

	private findRequestByCardCode(cardCode: string, excludeRequestId?: string): WriteRequestViewModel | null {
		const normalizedCardCode = this.normalizeCardCode(cardCode);
		if (!normalizedCardCode) return null;

		return (
			this.requestList.find((item) => {
				if (excludeRequestId && item.requestId === excludeRequestId) return false;
				const requestCardCode = this.normalizeCardCode(item.serialNumber || item.displayCode || item.raw?.Code || item.raw?.SerialNumber);
				return requestCardCode === normalizedCardCode;
			}) || null
		);
	}

	private async checkCardCodeExistsInDatabase(cardCode: string, excludeMemberCardId?: number): Promise<boolean> {
		const normalizedCardCode = this.normalizeCardCode(cardCode);
		if (!normalizedCardCode) return false;

		const result: any = await this.pageProvider.read(
			{
				Code_eq: cardCode,
				Take: 5,
			},
			true
		);
		const records = Array.isArray(result?.data) ? result.data : [];
		return records.some((item) => {
			const sameCode = this.normalizeCardCode(item?.Code || item?.SerialNumber) === normalizedCardCode;
			if (!sameCode) return false;
			if (excludeMemberCardId && item?.Id === excludeMemberCardId) return false;
			return true;
		});
	}

	private normalizeCardCode(value: any): string {
		return `${value || ''}`.trim().toLowerCase();
	}

	private normalizeRequestStatus(raw: any): WriteRequestViewModel['requestStatus'] {
		const status = `${raw?.Status || ''}`.trim();
		if (status === 'Approved') return 'Completed';
		if (status === 'Unapproved') return 'Failed';
		return 'Pending';
	}

	private resetBatchState(resetForPreparation = false): void {
		this.writePhase = resetForPreparation ? 'idle' : this.writePhase === 'completed' ? 'completed' : 'idle';
		this.statusMessage = resetForPreparation
			? 'Prepare the request queue to start batch write.'
			: this.currentStep === 2 && this.selectedRequest
			? `Ready to process ${this.selectedRequest.displayName}.`
			: 'Prepare the request queue to start batch write.';
		this.errorMessage = '';
		this.lastDetectedSerial = '';
		this.hasWrittenPayload = false;
		this.lastSavedItem = null;
	}

	private async retryCurrentRequestWithAnotherCard(message: string): Promise<void> {
		this.hasWrittenPayload = false;
		this.runInZone(() => {
			this.writePhase = 'error';
			this.errorMessage = message;
			this.statusMessage = 'Please place another NFC card for the current request.';
		});

		this.env.showMessage(message, 'warning');
		await this.cleanupNfc();

		setTimeout(() => {
			if (this.currentStep !== 2 || !this.selectedRequest || this.selectedRequest.requestStatus !== 'Pending') return;
			if (this.isBusy) return;
			void this.startWriteFlow();
		}, 450);
	}

	private syncSelectedContactIntoOptions(): void {
		if (!this.selectedContactId && this.selectedRequest?.selectedContactId) {
			this.selectedContactId = this.selectedRequest.selectedContactId;
		}

		if (!this.selectedContact && this.selectedRequest?.selectedContact) {
			this.selectedContact = this.selectedRequest.selectedContact;
		}

		if (this.selectedContactId) {
			const matchedContact = this.contactOptions.find((item) => item.Id === this.selectedContactId) || null;
			if (matchedContact) {
				this.selectedContact = matchedContact;
			}
		}

		if (this.selectedContact && !this.contactOptions.some((item) => item.Id === this.selectedContact.Id)) {
			this.contactOptions = [this.selectedContact, ...this.contactOptions];
		}
		this.contactListSelected = this.selectedContact ? [this.selectedContact] : [];
	}

	private triggerContactSearch(): void {
		this.contactListSelected = this.selectedContact ? [this.selectedContact] : [];
		this.contactListInput$.next('');
	}

	private async cleanupNfc(): Promise<void> {
		this.removeWriteListener?.();
		this.removeWriteListener = undefined;
		this.removeErrorListener?.();
		this.removeErrorListener = undefined;
		this.removeReadListener?.();
		this.removeReadListener = undefined;

		await NFC.cancelScan().catch(() => undefined);
		await NFC.cancelWriteAndroid().catch(() => undefined);
	}

	private async cleanupReaders(): Promise<void> {
		await this.cleanupNfc();
		await this.rd300Writer?.disconnect().catch(() => undefined);
		this.rd300Writer = undefined;
	}

	private getRd300Writer(): Rd300WebSerialWriter {
		if (!this.rd300Writer) {
			this.rd300Writer = new Rd300WebSerialWriter((message) => {
				this.runInZone(() => {
					this.statusMessage = message;
					this.cdr.detectChanges();
				});
			});
		}

		return this.rd300Writer;
	}

	private isNativeNfcPlatform(): boolean {
		const platform = Capacitor.getPlatform();
		return platform === 'ios' || platform === 'android';
	}

	private resolveErrorMessage(error: any, fallback: string): string {
		const message = `${error?.error || error?.message || error || fallback}`.trim();
		if (!message) return fallback;
		if (/permission/i.test(message)) return 'The device has not granted the required NFC permission.';
		if (/cancelled|canceled|cancel/i.test(message)) return 'The NFC session was canceled.';
		return message;
	}

	private runInZone(callback: () => void): void {
		this.zone.run(() => {
			callback();
			this.cdr.detectChanges();
		});
	}
}
