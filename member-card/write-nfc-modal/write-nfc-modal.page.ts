import { ChangeDetectorRef, Component, Input, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, ModalController, NavController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { concat, Observable, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { NFC, NDEFMessagesTransformable, NDEFWriteOptions, TagInfo } from '@exxili/capacitor-nfc';
import { environment } from 'src/environments/environment';
import { PageBase } from 'src/app/page-base';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider, CRM_MemberCardProvider } from 'src/app/services/static/services.service';

type RequestMode = 'Insert' | 'Update';
type StepKey = 1 | 2 | 3;
type WritePhase = 'idle' | 'writing' | 'awaitingSerial' | 'saving' | 'success' | 'error';

interface ContactOption {
	Id: number;
	Name?: string;
	Code?: string;
	Phone1?: string;
	Email?: string;
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

	currentStep: StepKey = 1;
	requestKeyword = '';
	requestList: WriteRequestViewModel[] = [];
	selectedRequest: WriteRequestViewModel = null;
	statusList = [];
	private localRequestList: WriteRequestViewModel[] = [];

	contactOptions: ContactOption[] = [];
	contactList$: Observable<ContactOption[]>;
	contactListLoading = false;
	contactListInput$ = new Subject<string>();
	contactListSelected: ContactOption[] = [];
	selectedContactId: number = null;
	selectedContact: ContactOption = null;

	writePhase: WritePhase = 'idle';
	statusMessage = 'Place the NFC card near the phone to start writing.';
	errorMessage = '';
	lastDetectedSerial = '';
	lastSavedItem: any = null;

	private writeToken = 0;
	private removeWriteListener?: () => void;
	private removeErrorListener?: () => void;
	private removeReadListener?: () => void;
	private hasWrittenPayload = false;
	private addRequestLoading?: HTMLIonLoadingElement;

	constructor(
		public pageProvider: CRM_MemberCardProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public modalController: ModalController,
		public loadingController: LoadingController,
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
		void this.cleanupNfc();
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

	get canStartWrite(): boolean {
		return !!this.selectedRequest && !!this.selectedContactId && !this.isBusy;
	}

	get isPrimaryDisabled(): boolean {
		if (this.isBusy) return true;
		if (this.currentStep === 1) return !this.selectedRequest;
		if (this.currentStep === 2) return !this.selectedContactId;
		if (this.writePhase === 'idle') return !this.canStartWrite;
		return false;
	}

	get isBusy(): boolean {
		return ['writing', 'awaitingSerial', 'saving'].includes(this.writePhase);
	}

	get footerPrimaryLabel(): string {
		if (this.currentStep === 1 || this.currentStep === 2) return 'Continue';
		if (this.writePhase === 'success') return this.hasPendingRequest() ? 'Process Next' : 'Finish';
		if (this.writePhase === 'error' && this.lastDetectedSerial) return 'Save To Database';
		if (this.writePhase === 'error' && this.hasWrittenPayload) return 'Read Serial Again';
		if (this.writePhase === 'error') return 'Retry';
		return 'Start Writing';
	}

	get writeStateLabel(): string {
		switch (this.writePhase) {
			case 'writing':
				return 'Writing Data';
			case 'awaitingSerial':
				return 'Waiting For Serial';
			case 'saving':
				return 'Saving To Database';
			case 'success':
				return 'Write Successful';
			case 'error':
				return 'Write Failed';
			default:
				return 'Waiting For NFC Card';
		}
	}

	get requestEmptyMessage(): string {
		if (this.pageConfig.showSpinner) return 'Loading card write requests.';
		return 'No card write requests available.';
	}

	get filteredRequestList(): WriteRequestViewModel[] {
		const keyword = `${this.requestKeyword || ''}`.trim().toLowerCase();
		if (!keyword) return this.requestList;

		return this.requestList.filter((item) => `${item.displayCode || ''}`.toLowerCase().includes(keyword));
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
		await this.cleanupNfc();
		await this.modalController.dismiss(
			{
				savedItem: this.lastSavedItem,
				request: this.selectedRequest,
				serialNumber: this.lastDetectedSerial || this.selectedRequest?.serialNumber || null,
			},
			role
		);
	}

	async addNewRequest(): Promise<void> {
		const token = ++this.writeToken;
		await this.cleanupNfc();

		this.removeReadListener?.();
		this.removeReadListener = NFC.onRead((data) => {
			this.runInZone(() => {
				if (token !== this.writeToken) return;

				const serialNumber = this.extractSerialNumber(data);
				if (!serialNumber) {
					void this.dismissAddRequestLoading();
					this.env.showMessage('Cannot read the serial number. Please try again.', 'danger');
					return;
				}

				this.removeReadListener?.();
				this.removeErrorListener?.();
				void this.dismissAddRequestLoading();
				void NFC.cancelScan().catch(() => {});

				const duplicatedRequest = this.findRequestByCardCode(serialNumber);
				if (duplicatedRequest) {
					this.env.showMessage(`Card ${serialNumber} already exists in the request list.`, 'warning');
					return;
				}

				void this.checkCardCodeExistsInDatabase(serialNumber)
					.then((isDuplicatedInDatabase) => {
						this.runInZone(() => {
							if (token !== this.writeToken) return;
							if (isDuplicatedInDatabase) {
								this.env.showMessage(`Card ${serialNumber} already exists in the database.`, 'warning');
								return;
							}

							const newRequest: WriteRequestViewModel = {
								requestId: `new-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
								mode: 'Insert',
								memberCardId: null,
								displayName: `New Card Write Request #${this.requestList.length + 1}`,
								displayCode: serialNumber,
								remark: 'Create New MemberCard',
								selectedContactId: null,
								selectedContact: null,
								memberCardPayload: null,
								requestStatus: 'Pending',
								serialNumber: serialNumber,
								raw: {},
							};

							this.localRequestList = [newRequest, ...this.localRequestList];
							this.rebuildRequestList();
							this.requestKeyword = '';
							this.env.showMessage(`Serial scanned successfully: ${serialNumber}`, 'success');
						});
					})
					.catch((error) => {
						this.runInZone(() => {
							if (token !== this.writeToken) return;
							this.env.showMessage(this.resolveErrorMessage(error, 'Cannot check duplicate card codes in the database.'), 'danger');
						});
					});
			});
		});

		this.removeErrorListener = NFC.onError((error) => {
			this.runInZone(() => {
				if (token !== this.writeToken) return;
				void this.dismissAddRequestLoading();
				this.env.showMessage(this.resolveErrorMessage(error, 'Cannot read the NFC card.'), 'danger');
			});
		});

		try {
			if (Capacitor.getPlatform() === 'android') {
				await this.presentAddRequestLoading();
				this.env.showMessage('Place the new NFC card near the phone to scan the serial number.', 'primary');
				// await NFC.startScan();
			} else {
				await NFC.startScan({ mode: 'auto' });
			}
		} catch (error) {
			await this.dismissAddRequestLoading();
			this.env.showMessage(this.resolveErrorMessage(error, 'Failed to open the NFC scanner.'), 'danger');
		}
	}

	selectRequest(request: WriteRequestViewModel): void {
		this.selectedRequest = request;
		this.selectedContact = request.selectedContact || null;
		this.selectedContactId = request.selectedContactId || null;
		this.syncSelectedContactIntoOptions();
		this.triggerContactSearch();
		this.resetStep3State();
		this.goToStep(2);
	}

	async onContactSelected(contact: ContactOption | null): Promise<void> {
		this.selectedContact = contact || null;
		this.selectedContactId = this.selectedContact?.Id || null;

		if (this.selectedRequest) {
			this.selectedRequest.selectedContactId = this.selectedContactId;
			this.selectedRequest.selectedContact = this.selectedContact;
		}

		this.syncSelectedContactIntoOptions();

		if (this.selectedContactId) {
			this.goToStep(3);
		}
	}

	goToStep(step: StepKey): void {
		this.currentStep = step;
		this.cdr.detectChanges();
	}

	goToPreviousStep(): void {
		if (this.isBusy) return;
		if (this.currentStep === 3) {
			this.goToStep(2);
			return;
		}
		if (this.currentStep === 2) {
			this.goToStep(1);
		}
	}

	async handlePrimaryAction(): Promise<void> {
		if (this.currentStep === 1) {
			if (this.selectedRequest) {
				this.goToStep(2);
			}
			return;
		}

		if (this.currentStep === 2) {
			if (this.selectedContactId) {
				this.goToStep(3);
			}
			return;
		}

		if (this.writePhase === 'success') {
			if (this.hasPendingRequest()) {
				this.moveToNextPendingRequest();
				return;
			}

			await this.closeModal('confirm');
			return;
		}

		if (this.writePhase === 'error' && this.lastDetectedSerial) {
			await this.saveToDatabase(this.lastDetectedSerial);
			return;
		}

		if (this.writePhase === 'error' && this.hasWrittenPayload) {
			await this.captureSerialNumber(this.writeToken);
			return;
		}

		await this.startWriteFlow();
	}

	private async startWriteFlow(): Promise<void> {
		if (!this.selectedRequest || !this.selectedContactId) {
			this.errorMessage = 'Please select a card write request and Contact ID before starting.';
			this.writePhase = 'error';
			return;
		}

		const token = ++this.writeToken;
		this.resetStep3State();
		this.writePhase = 'writing';
		this.statusMessage = 'Place the NFC card near the phone to start writing data.';

		const pluginReady = await this.ensureNfcReady();
		if (!pluginReady || token !== this.writeToken) return;

		await this.cleanupNfc();

		this.removeWriteListener = NFC.onWrite(() => {
			this.runInZone(() => {
				if (token !== this.writeToken) return;
				this.hasWrittenPayload = true;

				if (this.selectedRequest?.serialNumber) {
					this.lastDetectedSerial = this.selectedRequest.serialNumber;
					this.statusMessage = 'Data written successfully. Updating the database...';
					void this.saveToDatabase(this.lastDetectedSerial);
				} else {
					this.writePhase = 'awaitingSerial';
					this.statusMessage = 'Data written successfully. Place the card near the phone again to read the serial number.';
					void this.captureSerialNumber(token);
				}
			});
		});

		this.removeErrorListener = NFC.onError((error) => {
			this.runInZone(() => {
				if (token !== this.writeToken) return;
				this.writePhase = 'error';
				this.errorMessage = this.resolveErrorMessage(
					error,
					this.hasWrittenPayload ? 'Cannot read the card serial number.' : 'Cannot write data to the NFC card.'
				);
				this.statusMessage = '';
			});
		});

		try {
			const payload = this.buildWritePayload();
			await NFC.writeNDEF(payload);
		} catch (error) {
			if (token !== this.writeToken) return;
			this.writePhase = 'error';
			this.errorMessage = this.resolveErrorMessage(error, 'Cannot initialize the NFC write session.');
		}
	}

	private async captureSerialNumber(token: number): Promise<void> {
		if (token !== this.writeToken) return;

		this.removeReadListener?.();
		this.removeReadListener = NFC.onRead((data) => {
			this.runInZone(() => {
				if (token !== this.writeToken) return;
				const serialNumber = this.extractSerialNumber(data);
				if (!serialNumber) {
					this.writePhase = 'error';
					this.errorMessage = 'Cannot read the NFC card serial number.';
					return;
				}

				this.lastDetectedSerial = serialNumber;
				void this.saveToDatabase(serialNumber);
			});
		});

		if (Capacitor.getPlatform() === 'ios') {
			try {
				await NFC.startScan({ mode: 'auto' });
			} catch (error) {
				if (token !== this.writeToken) return;
				this.writePhase = 'error';
				this.errorMessage = this.resolveErrorMessage(error, 'Cannot start the NFC serial read session.');
			}
		}
	}

	private async saveToDatabase(serialNumber: string): Promise<void> {
		if (!this.selectedRequest || !this.selectedContactId) {
			this.writePhase = 'error';
			this.errorMessage = 'Missing data required to save the MemberCard to the database.';
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
			this.selectedRequest.memberCardId = savedItem?.Id || this.selectedRequest.memberCardId;
			this.selectedRequest.memberCardPayload = savedItem || payload;
			this.writePhase = 'success';
			const completedRequestId = this.selectedRequest.requestId;
			const shouldMoveToNextPendingRequest = this.hasPendingRequest();
			if (shouldMoveToNextPendingRequest) {
				setTimeout(() => {
					if (this.writePhase === 'success' && this.selectedRequest?.requestId === completedRequestId) {
						this.moveToNextPendingRequest();
					}
				});
			}
			this.statusMessage = 'NFC data was written and the database was updated successfully.';
			this.env.showMessage('NFC card written successfully.', 'success');
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
		if (Capacitor.getPlatform() === 'web') {
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
		const nextRequestList = this.mergeUniqueRequests([...this.localRequestList, ...remoteRequests]);
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

	private moveToNextPendingRequest(): void {
		const nextRequest = this.getNextPendingRequest();
		if (!nextRequest) {
			void this.closeModal('confirm');
			return;
		}

		this.selectRequest(nextRequest);
	}

	private hasPendingRequest(): boolean {
		return !!this.getNextPendingRequest();
	}

	private getNextPendingRequest(): WriteRequestViewModel | null {
		return this.requestList.find((item) => item.requestStatus === 'Pending' && item.requestId !== this.selectedRequest?.requestId) || null;
	}

	private findRequestByCardCode(cardCode: string): WriteRequestViewModel | null {
		const normalizedCardCode = this.normalizeCardCode(cardCode);
		if (!normalizedCardCode) return null;

		return (
			this.requestList.find((item) => {
				const requestCardCode = this.normalizeCardCode(item.serialNumber || item.displayCode || item.raw?.Code || item.raw?.SerialNumber);
				return requestCardCode === normalizedCardCode;
			}) || null
		);
	}

	private async checkCardCodeExistsInDatabase(cardCode: string): Promise<boolean> {
		const normalizedCardCode = this.normalizeCardCode(cardCode);
		if (!normalizedCardCode) return false;

		const result: any = await this.pageProvider.read(
			{
				Code_eq: cardCode,
				Take: 1,
			},
			true
		);
		const records = Array.isArray(result?.data) ? result.data : [];
		return records.some((item) => this.normalizeCardCode(item?.Code || item?.SerialNumber) === normalizedCardCode);
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

	private extractSerialNumber(data: NDEFMessagesTransformable): string {
		const stringView = data?.string?.();
		const numberView = data?.numberArray?.();
		const tagInfo = (stringView?.tagInfo || numberView?.tagInfo || {}) as TagInfo;
		if (tagInfo?.uid) return `${tagInfo.uid}`.trim();

		const firstRecord = stringView?.messages?.[0]?.records?.[0];
		if (firstRecord?.type === 'ID' && typeof firstRecord.payload === 'string') {
			return firstRecord.payload.trim();
		}

		return '';
	}

	private resetStep3State(): void {
		this.writePhase = 'idle';
		this.statusMessage = 'Place the NFC card near the phone to start writing.';
		this.errorMessage = '';
		this.lastDetectedSerial = '';
		this.hasWrittenPayload = false;
		this.lastSavedItem = null;
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
		await this.dismissAddRequestLoading();
	}

	private async presentAddRequestLoading(): Promise<void> {
		await this.dismissAddRequestLoading();
		this.addRequestLoading = await this.loadingController.create({
			message: 'Waiting to scan the NFC card...',
			spinner: 'crescent',
			backdropDismiss: false,
		});
		await this.addRequestLoading.present();
	}

	private async dismissAddRequestLoading(): Promise<void> {
		if (!this.addRequestLoading) return;

		const loading = this.addRequestLoading;
		this.addRequestLoading = undefined;
		await loading.dismiss().catch(() => undefined);
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
