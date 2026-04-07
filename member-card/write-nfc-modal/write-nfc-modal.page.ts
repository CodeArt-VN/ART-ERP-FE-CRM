import { ChangeDetectorRef, Component, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { concat, Observable, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { NFC, NDEFMessagesTransformable, NDEFWriteOptions, TagInfo } from '@exxili/capacitor-nfc';
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
export class WriteNfcModalPage implements OnInit, OnDestroy {
	@Input() requests: any[] = [];
	@Input() selectedItems: any[] = [];
	@Input() title = 'Ghi thẻ NFC';

	currentStep: StepKey = 1;
	requestKeyword = '';
	requestList: WriteRequestViewModel[] = [];
	selectedRequest: WriteRequestViewModel = null;

	contactOptions: ContactOption[] = [];
	contactList$: Observable<ContactOption[]>;
	contactListLoading = false;
	contactListInput$ = new Subject<string>();
	contactListSelected: ContactOption[] = [];
	selectedContactId: number = null;
	selectedContact: ContactOption = null;

	writePhase: WritePhase = 'idle';
	statusMessage = 'Đưa thẻ NFC vào điện thoại để bắt đầu ghi.';
	errorMessage = '';
	lastDetectedSerial = '';
	lastSavedItem: any = null;

	private writeToken = 0;
	private removeWriteListener?: () => void;
	private removeErrorListener?: () => void;
	private removeReadListener?: () => void;
	private hasWrittenPayload = false;

	constructor(
		private modalController: ModalController,
		private memberCardProvider: CRM_MemberCardProvider,
		private contactProvider: CRM_ContactProvider,
		private env: EnvService,
		private zone: NgZone,
		private cdr: ChangeDetectorRef
	) {}

	async ngOnInit(): Promise<void> {
		this.requestList = this.normalizeRequests();
		this.initContactSearch();
		this.contactListInput$.next('');
	}

	ngOnDestroy(): void {
		this.writeToken++;
		this.contactListInput$.complete();
		void this.cleanupNfc();
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
		if (this.currentStep === 1 || this.currentStep === 2) return 'Tiếp tục';
		if (this.writePhase === 'success') return this.hasPendingRequest() ? 'Xử lý tiếp' : 'Hoàn tất';
		if (this.writePhase === 'error' && this.lastDetectedSerial) return 'Lưu lại database';
		if (this.writePhase === 'error' && this.hasWrittenPayload) return 'Đọc lại serial';
		if (this.writePhase === 'error') return 'Thử lại';
		return 'Bắt đầu ghi';
	}

	get writeStateLabel(): string {
		switch (this.writePhase) {
			case 'writing':
				return 'Đang ghi dữ liệu';
			case 'awaitingSerial':
				return 'Đang chờ đọc serial';
			case 'saving':
				return 'Đang lưu database';
			case 'success':
				return 'Ghi thành công';
			case 'error':
				return 'Ghi thất bại';
			default:
				return 'Đang chờ đưa thẻ vào điện thoại';
		}
	}

	get requestEmptyMessage(): string {
		return 'Chưa có danh sách yêu cầu ghi thẻ để xử lý.';
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

	addNewRequest(): void {
		const newRequest: WriteRequestViewModel = {
			requestId: `new-${Date.now()}`,
			mode: 'Insert',
			memberCardId: null,
			displayName: 'Yêu cầu ghi thẻ mới',
			displayCode: '',
			remark: 'Tạo mới MemberCard',
			selectedContactId: null,
			selectedContact: null,
			memberCardPayload: null,
			requestStatus: 'Pending',
			serialNumber: '',
			raw: {},
		};

		this.requestList = [newRequest, ...this.requestList];
		this.requestKeyword = '';
		this.selectRequest(newRequest);
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
			this.errorMessage = 'Cần chọn yêu cầu ghi thẻ và IDContact trước khi bắt đầu.';
			this.writePhase = 'error';
			return;
		}

		const token = ++this.writeToken;
		this.resetStep3State();
		this.writePhase = 'writing';
		this.statusMessage = 'Đưa thẻ NFC vào điện thoại để bắt đầu ghi dữ liệu.';

		const pluginReady = await this.ensureNfcReady();
		if (!pluginReady || token !== this.writeToken) return;

		await this.cleanupNfc();

		this.removeWriteListener = NFC.onWrite(() => {
			this.runInZone(() => {
				if (token !== this.writeToken) return;
				this.hasWrittenPayload = true;
				this.writePhase = 'awaitingSerial';
				this.statusMessage = 'Đã ghi dữ liệu. Đưa lại thẻ vào điện thoại để đọc serial.';
				void this.captureSerialNumber(token);
			});
		});

		this.removeErrorListener = NFC.onError((error) => {
			this.runInZone(() => {
				if (token !== this.writeToken) return;
				this.writePhase = 'error';
				this.errorMessage = this.resolveErrorMessage(error, this.hasWrittenPayload ? 'Không thể đọc serial của thẻ.' : 'Không thể ghi dữ liệu vào thẻ NFC.');
				this.statusMessage = '';
			});
		});

		try {
			const payload = this.buildWritePayload();
			await NFC.writeNDEF(payload);
		} catch (error) {
			if (token !== this.writeToken) return;
			this.writePhase = 'error';
			this.errorMessage = this.resolveErrorMessage(error, 'Không thể khởi tạo phiên ghi NFC.');
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
					this.errorMessage = 'Không đọc được serial của thẻ NFC.';
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
				this.errorMessage = this.resolveErrorMessage(error, 'Không thể khởi động phiên đọc serial NFC.');
			}
		}
	}

	private async saveToDatabase(serialNumber: string): Promise<void> {
		if (!this.selectedRequest || !this.selectedContactId) {
			this.writePhase = 'error';
			this.errorMessage = 'Thiếu dữ liệu để lưu MemberCard xuống database.';
			return;
		}

		this.writePhase = 'saving';
		this.errorMessage = '';
		this.statusMessage = 'Đang cập nhật dữ liệu MemberCard xuống database.';

		try {
			await this.cleanupNfc();
			const payload = this.buildSavePayload(serialNumber);
			const savedItem :any = await this.memberCardProvider.save(payload, this.selectedRequest.mode === 'Insert');

			this.lastSavedItem = savedItem;
			this.selectedRequest.requestStatus = 'Completed';
			this.selectedRequest.serialNumber = serialNumber;
			this.selectedRequest.memberCardId = savedItem?.Id || this.selectedRequest.memberCardId;
			this.selectedRequest.memberCardPayload = savedItem || payload;
			this.writePhase = 'success';
			this.statusMessage = 'Đã ghi dữ liệu NFC và cập nhật database thành công.';
			this.env.showMessage('Ghi thẻ NFC thành công', 'success');
		} catch (error) {
			this.selectedRequest.requestStatus = 'Failed';
			this.writePhase = 'error';
			this.errorMessage = this.resolveErrorMessage(error, 'Không thể lưu dữ liệu MemberCard xuống database.');
			this.statusMessage = '';
		}
	}

	private buildWritePayload(): NDEFWriteOptions<string> {
		return {
			records: [
				{
					type: 'T',
					payload: `${this.selectedContactId}`,
				},
			],
		};
	}

	private buildSavePayload(serialNumber: string): any {
		const basePayload = this.selectedRequest?.memberCardPayload && typeof this.selectedRequest.memberCardPayload === 'object' ? { ...this.selectedRequest.memberCardPayload } : {};
		const payload: any = {
			...basePayload,
			Code: serialNumber,
			IDMember: this.selectedContactId,
			IDBranch: basePayload?.IDBranch || this.env.selectedBranch,
		};

		if (!payload.Name && (basePayload?.Name || this.selectedContact?.Name || this.selectedRequest?.displayName)) {
			payload.Name = basePayload?.Name || this.selectedContact?.Name || this.selectedRequest?.displayName;
		}

		if (this.selectedRequest.mode === 'Update') {
			const memberCardId = this.selectedRequest.memberCardId || basePayload?.Id;
			if (!memberCardId) {
				throw new Error('Thiếu MemberCard Id để cập nhật dữ liệu.');
			}

			payload.Id = memberCardId;
		} else {
			delete payload.Id;
		}

		return payload;
	}

	private async ensureNfcReady(): Promise<boolean> {
		if (Capacitor.getPlatform() === 'web') {
			this.writePhase = 'error';
			this.errorMessage = 'NFC không hỗ trợ trên nền tảng web.';
			return false;
		}

		if (!Capacitor.isPluginAvailable('NFC')) {
			this.writePhase = 'error';
			this.errorMessage = 'Plugin NFC chưa sẵn sàng trong bản build hiện tại.';
			return false;
		}

		try {
			const support = await NFC.isSupported();
			if (!support?.supported) {
				this.writePhase = 'error';
				this.errorMessage = 'Thiết bị này không hỗ trợ NFC hoặc NFC đang bị tắt.';
				return false;
			}
		} catch (error) {
			this.writePhase = 'error';
			this.errorMessage = this.resolveErrorMessage(error, 'Không kiểm tra được trạng thái NFC của thiết bị.');
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
								this.env.showMessage(this.resolveErrorMessage(error, 'Không tải được danh sách contact.'), 'danger');
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

	private normalizeRequests(): WriteRequestViewModel[] {
		const source = Array.isArray(this.requests) && this.requests.length ? this.requests : this.selectedItems;
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
				requestId: `${memberCardId || raw?.Id || index}-${index}`,
				mode,
				memberCardId,
				displayName: raw?.Name || raw?.Title || preselectedContact?.Name || `Yêu cầu ghi thẻ #${index + 1}`,
				displayCode: raw?.Code || raw?.RequestCode || raw?.MemberCardCode || '',
				remark: raw?.Remark || raw?.Description || '',
				selectedContactId,
				selectedContact: preselectedContact,
				memberCardPayload,
				requestStatus: 'Pending',
				serialNumber: raw?.SerialNumber || raw?.Code || '',
				raw,
			};
		});
	}

	private looksLikeMemberCard(raw: any): boolean {
		if (!raw || typeof raw !== 'object') return false;
		return ['Code', 'StartDate', 'EndDate', 'Quota', 'DailyLimit', 'IDMember'].some((key) => Object.prototype.hasOwnProperty.call(raw, key));
	}

	private moveToNextPendingRequest(): void {
		const nextRequest = this.requestList.find((item) => item.requestStatus !== 'Completed' && item.requestId !== this.selectedRequest?.requestId);
		if (!nextRequest) {
			void this.closeModal('confirm');
			return;
		}

		this.selectRequest(nextRequest);
	}

	private hasPendingRequest(): boolean {
		return this.requestList.some((item) => item.requestStatus !== 'Completed' && item.requestId !== this.selectedRequest?.requestId);
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
		this.statusMessage = 'Đưa thẻ NFC vào điện thoại để bắt đầu ghi.';
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
	}

	private resolveErrorMessage(error: any, fallback: string): string {
		const message = `${error?.error || error?.message || error || fallback}`.trim();
		if (!message) return fallback;
		if (/permission/i.test(message)) return 'Thiết bị chưa cấp quyền cần thiết để dùng NFC.';
		if (/cancelled|canceled|cancel/i.test(message)) return 'Phiên NFC đã bị hủy.';
		return message;
	}

	private runInZone(callback: () => void): void {
		this.zone.run(() => {
			callback();
			this.cdr.detectChanges();
		});
	}
}
