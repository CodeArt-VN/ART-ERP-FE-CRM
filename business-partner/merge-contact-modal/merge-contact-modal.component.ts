import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { CRM_ContactProvider } from 'src/app/services/static/services.service';
import { ApiSetting } from 'src/app/services/static/api-setting';

@Component({
	selector: 'app-merge-contact-modal',
	templateUrl: './merge-contact-modal.component.html',
	styleUrls: ['./merge-contact-modal.component.scss'],
	standalone: false,
})
export class MergeContactModalComponent implements OnInit {
	/** Contact Ids selected on the list page. */
	@Input() contactIds: number[] = [];

	mergeForm: FormGroup;
	mergePreview: any = null;
	mergeMasterId = 0;
	mergeFieldMap: Record<string, number> = {};
	/** Editable final scalar values shown in sticky preview. */
	mergeFieldValues: Record<string, string> = {};
	/** Per-field free-text edit mode (default = pick from contacts). */
	fieldEditMode: Record<string, boolean> = {};
	/** Multi-select Address / Tax (MST) by distinct key (not every duplicate row). */
	selectedAddressKeys: Record<string, boolean> = {};
	selectedTaxKeys: Record<string, boolean> = {};
	/** Exactly one selected tax key is default. */
	defaultTaxKey = '';
	mergeMasterSearch = '';
	mergeShowAllFields = false;
	mergePreviewLoading = false;
	mergeSubmitting = false;
	/** Cached — do NOT recompute via getters every CD (freezes UI). */
	filteredMergeContacts: any[] = [];
	visibleMergeFields: any[] = [];
	mergeAddressOptions: any[] = [];
	mergeTaxOptions: any[] = [];
	mergeRelatedByContactEntries: { id: string; name: string; summary: string }[] = [];
	mergeRelatedTotals = {
		SaleOrders: 0,
		PurchaseOrders: 0,
		Invoices: 0,
		Payments: 0,
		MemberCards: 0,
		Documents: 0,
	};
	mergeScalarPreviewRows: { key: string; value: string }[] = [];
	mergeSelectedAddressesPreview: any[] = [];
	mergeSelectedTaxPreview: any[] = [];
	mergeFields: {
		Key: string;
		HasConflict: boolean;
		Options: { Value: string; SourceIds: number[] }[];
		formField: any;
	}[] = [];
	isPersonalOptions = [
		{ Value: 'true', Name: 'Individual' },
		{ Value: 'false', Name: 'Organization' },
	];
	mergeScalarFieldKeys = [
		'Code',
		'Name',
		'WorkPhone',
		'OtherPhone',
		'Email',
		'CompanyName',
		'IsPersonal',
		'Title',
		'Website',
		'Fax',
		'Remark',
	];

	constructor(
		public modalController: ModalController,
		public pageProvider: CRM_ContactProvider,
		public env: EnvService,
		public formBuilder: FormBuilder
	) {
		const controls: Record<string, any> = {};
		for (const key of this.mergeScalarFieldKeys) {
			controls[key] = [''];
		}
		this.mergeForm = this.formBuilder.group(controls);
	}

	ngOnInit(): void {
		this.loadMergePreview();
	}

	dismiss(role: string = 'cancel', data: any = null) {
		return this.modalController.dismiss(data, role);
	}

	clearMergeViewCache() {
		this.filteredMergeContacts = [];
		this.visibleMergeFields = [];
		this.mergeFields = [];
		this.mergeAddressOptions = [];
		this.mergeTaxOptions = [];
		this.mergeRelatedByContactEntries = [];
		this.mergeRelatedTotals = {
			SaleOrders: 0,
			PurchaseOrders: 0,
			Invoices: 0,
			Payments: 0,
			MemberCards: 0,
			Documents: 0,
		};
		this.mergeScalarPreviewRows = [];
		this.mergeSelectedAddressesPreview = [];
		this.mergeSelectedTaxPreview = [];
		this.mergeFieldMap = {};
		this.mergeFieldValues = {};
		this.fieldEditMode = {};
		this.selectedAddressKeys = {};
		this.selectedTaxKeys = {};
		this.defaultTaxKey = '';
	}

	loadMergePreview() {
		const ids = (this.contactIds || []).filter((id) => !!id).map((id) => Number(id));
		if (ids.length < 2) {
			this.env.showMessage('Please select at least 2 contacts to merge', 'warning');
			this.dismiss('cancel');
			return;
		}

		this.mergePreview = null;
		this.mergePreviewLoading = true;
		this.mergeMasterSearch = '';
		this.mergeShowAllFields = false;
		this.clearMergeViewCache();

		this.pageProvider.commonService
			.connect('POST', ApiSetting.apiDomain('CRM/Contact/MergePreview'), { Ids: ids })
			.toPromise()
			.then((data: any) => {
				this.mergePreview = data;
				this.mergeMasterId = Number(data?.SuggestedMasterId || ids[0]);
				this.initMergeFieldMap();
				this.initMergeChildSelections();
				this.rebuildMergeViewCache();
			})
			.catch((err) => {
				this.env.showMessage(err, 'danger');
				this.dismiss('cancel');
			})
			.finally(() => {
				this.mergePreviewLoading = false;
			});
	}

	/** Rebuild list caches once per data/master/search/toggle change — stable refs for *ngFor. */
	rebuildMergeViewCache() {
		const contacts = this.mergePreview?.Contacts || [];
		const q = (this.mergeMasterSearch || '').trim().toLowerCase();
		this.filteredMergeContacts = !q
			? contacts
			: contacts.filter((c) => {
					const haystack = [c.Id, c.Code, c.Name, c.WorkPhone, c.Email, c.CompanyName]
						.filter(Boolean)
						.join(' ')
						.toLowerCase();
					return haystack.includes(q);
				});

		this.mergeFields = this.buildMergeFieldsFromContacts(contacts);
		this.syncFieldMapToOptionSourceIds();
		this.openEditForEmptyOptionFields();
		this.refreshFieldFormConfigs();
		this.visibleMergeFields = this.mergeShowAllFields
			? this.mergeFields
			: this.mergeFields.filter((f) => f.HasConflict || (f.Options?.length ?? 0) > 0);

		// Distinct Address / MST — UI 1 dòng; merge chỉ keep 1 Id (ưu tiên Master).
		const addrMap = new Map<string, any>();
		const taxMap = new Map<string, any>();
		for (const c of contacts) {
			for (const a of c.Addresses || []) {
				const key = this.addressDistinctKey(a);
				if (!addrMap.has(key)) {
					addrMap.set(key, {
						...a,
						Key: key,
						Ids: [a.Id],
						SourceIds: [c.Id],
						IdSources: [{ Id: a.Id, SourceId: c.Id }],
					});
				} else {
					const g = addrMap.get(key);
					if (!g.Ids.includes(a.Id)) {
						g.Ids.push(a.Id);
						g.IdSources.push({ Id: a.Id, SourceId: c.Id });
					}
					if (!g.SourceIds.includes(c.Id)) g.SourceIds.push(c.Id);
				}
			}
			for (const t of c.TaxInfos || []) {
				const key = this.taxDistinctKey(t);
				if (!taxMap.has(key)) {
					taxMap.set(key, {
						...t,
						Key: key,
						Ids: [t.Id],
						SourceIds: [c.Id],
						IdSources: [{ Id: t.Id, SourceId: c.Id }],
						WasDefault: !!t.IsDefault,
					});
				} else {
					const g = taxMap.get(key);
					if (!g.Ids.includes(t.Id)) {
						g.Ids.push(t.Id);
						g.IdSources.push({ Id: t.Id, SourceId: c.Id });
					}
					if (!g.SourceIds.includes(c.Id)) g.SourceIds.push(c.Id);
					if (t.IsDefault) g.WasDefault = true;
				}
			}
		}
		this.mergeAddressOptions = Array.from(addrMap.values()).map((g) => ({
			...g,
			KeepId: this.pickKeepIdForDistinctGroup(g),
		}));
		this.mergeTaxOptions = Array.from(taxMap.values()).map((g) => ({
			...g,
			KeepId: this.pickKeepIdForDistinctGroup(g),
		}));

		for (const a of this.mergeAddressOptions) {
			if (this.selectedAddressKeys[a.Key] === undefined) {
				this.selectedAddressKeys[a.Key] = true;
			}
		}
		for (const t of this.mergeTaxOptions) {
			if (this.selectedTaxKeys[t.Key] === undefined) {
				this.selectedTaxKeys[t.Key] = true;
			}
		}
		this.ensureDefaultTaxSelection();

		this.rebuildRelatedMovePreview(contacts);
		this.syncFormFromFieldValues();
		this.refreshMergeResultPreview();
	}

	/** FE derives field options/conflicts from Contacts scalars. */
	buildMergeFieldsFromContacts(contacts: any[]) {
		return this.mergeScalarFieldKeys.map((key) => {
			const optionMap = new Map<string, { Value: string; SourceIds: number[] }>();
			for (const c of contacts || []) {
				const raw = this.normalizeScalar(c?.[key]);
				if (!raw) continue;
				const existing = optionMap.get(raw);
				if (existing) {
					if (!existing.SourceIds.includes(c.Id)) existing.SourceIds.push(c.Id);
				} else {
					optionMap.set(raw, { Value: raw, SourceIds: [c.Id] });
				}
			}
			const Options = Array.from(optionMap.values()).sort((a, b) => b.SourceIds.length - a.SourceIds.length);
			return { Key: key, HasConflict: Options.length > 1, Options, formField: null as any };
		});
	}

	buildFieldFormConfig(field: { Key: string }) {
		// Only used in edit mode — free input / IsPersonal select.
		if (field.Key === 'IsPersonal') {
			return {
				id: field.Key,
				label: field.Key,
				type: 'select',
				form: this.mergeForm,
				dataSource: this.isPersonalOptions,
				bindValue: 'Value',
				bindLabel: 'Name',
			};
		}
		return {
			id: field.Key,
			label: field.Key,
			type: field.Key === 'Remark' ? 'textarea' : 'text',
			form: this.mergeForm,
		};
	}

	refreshFieldFormConfigs() {
		for (const field of this.mergeFields) {
			field.formField = this.buildFieldFormConfig(field);
		}
	}

	/** No contact values → open free input by default. */
	openEditForEmptyOptionFields() {
		for (const field of this.mergeFields) {
			if (!(field.Options?.length > 0)) {
				this.fieldEditMode[field.Key] = true;
			}
		}
	}

	/** Radio binds SourceIds[0]; align map so selected option highlights correctly. */
	syncFieldMapToOptionSourceIds() {
		for (const field of this.mergeFields) {
			const val = this.normalizeScalar(this.mergeFieldValues[field.Key]);
			const match = field.Options?.find((o) => o.Value === val);
			if (match?.SourceIds?.length) {
				this.mergeFieldMap[field.Key] = match.SourceIds[0];
			}
		}
	}

	normalizeScalar(val: any): string {
		if (val === null || val === undefined) return '';
		if (typeof val === 'boolean') return val ? 'true' : 'false';
		return String(val).trim();
	}

	getContactRelated(c: any) {
		return c?.Related || c?.related || {};
	}

	/** Totals to move = sum Related of all non-master contacts (recomputed when Master changes). */
	rebuildRelatedMovePreview(contacts: any[]) {
		const masterId = Number(this.mergeMasterId);
		const totals = {
			SaleOrders: 0,
			PurchaseOrders: 0,
			Invoices: 0,
			Payments: 0,
			MemberCards: 0,
			Documents: 0,
		};
		const entries = [];
		for (const c of contacts || []) {
			if (Number(c.Id) === masterId) continue;
			const related = this.getContactRelated(c);
			const summary = this.formatRelatedCounts(related);
			entries.push({
				id: String(c.Id),
				name: c.Name || c.Code || '',
				summary: summary || '',
			});
			totals.SaleOrders += Number(related.SaleOrders || related.saleOrders || 0);
			totals.PurchaseOrders += Number(related.PurchaseOrders || related.purchaseOrders || 0);
			totals.Invoices += Number(related.Invoices || related.invoices || 0);
			totals.Payments +=
				Number(related.IncomingPayments || related.incomingPayments || 0) +
				Number(related.OutgoingPayments || related.outgoingPayments || 0);
			totals.MemberCards += Number(related.MemberCards || related.memberCards || 0);
		}
		totals.Documents =
			totals.SaleOrders + totals.PurchaseOrders + totals.Invoices + totals.Payments + totals.MemberCards;
		this.mergeRelatedTotals = { ...totals };
		this.mergeRelatedByContactEntries = [...entries];
	}

	addressDistinctKey(a: any) {
		return [a?.AddressLine1, a?.AddressLine2, a?.Ward, a?.Province, a?.Country]
			.map((x) => String(x || '').trim().toLowerCase())
			.join('|');
	}

	taxDistinctKey(t: any) {
		return [t?.TaxCode, t?.CompanyName].map((x) => String(x || '').trim().toLowerCase()).join('|');
	}

	/** 1 distinct group → keep đúng 1 Id (ưu tiên bản của Master). */
	pickKeepIdForDistinctGroup(group: { Ids?: number[]; IdSources?: { Id: number; SourceId: number }[]; Id?: number }) {
		const masterId = Number(this.mergeMasterId);
		const fromMaster = (group.IdSources || []).find((x) => Number(x.SourceId) === masterId);
		if (fromMaster?.Id) {
			return fromMaster.Id;
		}
		return group.Ids?.[0] ?? group.Id;
	}

	refreshMergeResultPreview() {
		this.mergeScalarPreviewRows = this.mergeScalarFieldKeys.map((key) => ({
			key,
			value: this.formatMergeFieldOption(key, this.mergeFieldValues[key] ?? '') || '—',
		}));
		this.mergeSelectedAddressesPreview = this.mergeAddressOptions.filter((a) => this.selectedAddressKeys[a.Key]);
		this.mergeSelectedTaxPreview = this.mergeTaxOptions.filter((t) => this.selectedTaxKeys[t.Key]);
	}

	syncFormFromFieldValues() {
		if (!this.mergeForm) return;
		this.mergeForm.patchValue({ ...this.mergeFieldValues }, { emitEvent: false });
	}

	onMergeMasterSearch() {
		this.rebuildMergeViewCache();
	}

	toggleMergeShowAllFields() {
		this.mergeShowAllFields = !this.mergeShowAllFields;
		this.rebuildMergeViewCache();
	}

	trackByContactId(_: number, item: { Id?: number }) {
		return item?.Id;
	}

	trackByFieldKey(_: number, field: { Key?: string; key?: string }) {
		return field?.Key ?? field?.key;
	}

	trackByAddressId(_: number, item: { Key?: string; Id?: number }) {
		return item?.Key ?? item?.Id;
	}

	trackByTaxId(_: number, item: { Key?: string; Id?: number }) {
		return item?.Key ?? item?.Id;
	}

	initMergeFieldMap() {
		this.mergeFieldMap = {};
		this.mergeFieldValues = {};
		this.fieldEditMode = {};
		for (const key of this.mergeScalarFieldKeys) {
			this.mergeFieldMap[key] = this.mergeMasterId;
			this.mergeFieldValues[key] = this.getMergeScalarRawValue(this.mergeMasterId, key);
			this.fieldEditMode[key] = false;
		}
		this.syncFormFromFieldValues();
	}

	initMergeChildSelections() {
		this.selectedAddressKeys = {};
		this.selectedTaxKeys = {};
		this.defaultTaxKey = '';
	}

	setMergeMaster(id: number) {
		const nextId = Number(id);
		if (Number(this.mergeMasterId) === nextId) {
			return;
		}
		this.mergeMasterId = nextId;
		this.initMergeFieldMap();
		this.rebuildMergeViewCache();
	}

	applyMasterAllFields() {
		for (const key of this.mergeScalarFieldKeys) {
			this.mergeFieldMap[key] = this.mergeMasterId;
			this.mergeFieldValues[key] = this.getMergeScalarRawValue(this.mergeMasterId, key);
			this.fieldEditMode[key] = false;
		}
		this.openEditForEmptyOptionFields();
		this.refreshFieldFormConfigs();
		this.syncFormFromFieldValues();
		this.refreshMergeResultPreview();
	}

	fillBlankMergeFields() {
		for (const field of this.mergeFields) {
			if ((this.mergeFieldValues[field.Key] || '').trim()) {
				continue;
			}
			for (const opt of field.Options || []) {
				for (const sourceId of opt.SourceIds || []) {
					const raw = this.getMergeScalarRawValue(sourceId, field.Key);
					if (raw) {
						this.mergeFieldMap[field.Key] = sourceId;
						this.mergeFieldValues[field.Key] = raw;
						this.fieldEditMode[field.Key] = false;
						break;
					}
				}
				if ((this.mergeFieldValues[field.Key] || '').trim()) {
					break;
				}
			}
		}
		this.openEditForEmptyOptionFields();
		this.refreshFieldFormConfigs();
		this.syncFormFromFieldValues();
		this.refreshMergeResultPreview();
	}

	enableFieldEdit(fieldKey: string) {
		this.fieldEditMode = { ...this.fieldEditMode, [fieldKey]: true };
		this.refreshFieldFormConfigs();
		this.syncFormFromFieldValues();
	}

	disableFieldEdit(fieldKey: string) {
		this.fieldEditMode = { ...this.fieldEditMode, [fieldKey]: false };
		const field = this.mergeFields.find((f) => f.Key === fieldKey);
		const current = this.normalizeScalar(this.mergeForm?.get(fieldKey)?.value);
		const match = field?.Options?.find((o) => o.Value === current);
		if (match) {
			this.mergeFieldMap[fieldKey] = match.SourceIds[0];
			this.mergeFieldValues[fieldKey] = match.Value;
		} else {
			this.mergeFieldValues[fieldKey] = current;
			this.mergeFieldMap[fieldKey] = this.mergeMasterId;
		}
		this.refreshFieldFormConfigs();
		this.syncFormFromFieldValues();
		this.refreshMergeResultPreview();
	}

	pickMergeFieldOption(fieldKey: string, sourceId: number, value: string) {
		this.fieldEditMode = { ...this.fieldEditMode, [fieldKey]: false };
		this.mergeFieldMap[fieldKey] = sourceId;
		this.mergeFieldValues[fieldKey] = value ?? this.getMergeScalarRawValue(sourceId, fieldKey);
		this.refreshMergeResultPreview();
	}

	onMergeFieldControlChange(fieldKey: string) {
		const raw = this.normalizeScalar(this.mergeForm?.get(fieldKey)?.value);
		this.mergeFieldValues[fieldKey] = raw;
		this.mergeFieldMap[fieldKey] = this.mergeMasterId;
		this.refreshMergeResultPreview();
	}

	selectAllMergeAddresses(selected: boolean) {
		for (const a of this.mergeAddressOptions) {
			this.selectedAddressKeys[a.Key] = selected;
		}
		this.refreshMergeResultPreview();
	}

	selectAllMergeTaxes(selected: boolean) {
		for (const t of this.mergeTaxOptions) {
			this.selectedTaxKeys[t.Key] = selected;
		}
		this.ensureDefaultTaxSelection();
		this.refreshMergeResultPreview();
	}

	onTaxSelectionChange(key: string) {
		if (!this.selectedTaxKeys[key] && this.defaultTaxKey === key) {
			this.defaultTaxKey = '';
		}
		this.ensureDefaultTaxSelection();
		this.refreshMergeResultPreview();
	}

	setDefaultTaxKey(key: string) {
		if (!key) return;
		this.selectedTaxKeys[key] = true;
		this.defaultTaxKey = key;
		this.refreshMergeResultPreview();
	}

	/** Exactly one default among currently selected taxes. */
	ensureDefaultTaxSelection() {
		const selected = this.mergeTaxOptions.filter((t) => this.selectedTaxKeys[t.Key]);
		if (!selected.length) {
			this.defaultTaxKey = '';
			return;
		}
		if (selected.some((t) => t.Key === this.defaultTaxKey)) {
			return;
		}
		const prefer = selected.find((t) => t.WasDefault) || selected[0];
		this.defaultTaxKey = prefer?.Key || '';
	}

	getDefaultTaxKeepId(): number | null {
		const t = this.mergeTaxOptions.find((x) => x.Key === this.defaultTaxKey && this.selectedTaxKeys[x.Key]);
		return t?.KeepId ? Number(t.KeepId) : null;
	}

	getMergeContactById(id: number) {
		const nid = Number(id);
		return (this.mergePreview?.Contacts || []).find((c) => Number(c.Id) === nid);
	}

	getMergeScalarRawValue(contactId: number, fieldKey: string) {
		const contact = this.getMergeContactById(contactId);
		if (!contact) {
			return '';
		}
		return this.normalizeScalar(contact[fieldKey]);
	}

	formatMergeFieldOption(fieldKey: string, value: string) {
		if (fieldKey === 'IsPersonal') {
			if (value === 'true') return 'Individual';
			if (value === 'false') return 'Organization';
			return value || '';
		}
		return value;
	}

	formatAddressLine(a: any) {
		return [a?.AddressLine1, a?.AddressLine2, a?.Ward, a?.Province, a?.Country].filter(Boolean).join(' · ') || '—';
	}

	formatRelatedCounts(counts: any) {
		if (!counts) {
			return '';
		}
		const so = Number(counts.SaleOrders || counts.saleOrders || 0);
		const po = Number(counts.PurchaseOrders || counts.purchaseOrders || 0);
		const inv = Number(counts.Invoices || counts.invoices || 0);
		const pay =
			Number(counts.IncomingPayments || counts.incomingPayments || 0) +
			Number(counts.OutgoingPayments || counts.outgoingPayments || 0);
		const cards = Number(counts.MemberCards || counts.memberCards || 0);
		const parts = [];
		if (so) parts.push(`${so} SO`);
		if (po) parts.push(`${po} PO`);
		if (inv) parts.push(`${inv} inv`);
		if (pay) parts.push(`${pay} pay`);
		if (cards) parts.push(`${cards} card`);
		return parts.join(', ');
	}

	mergeContact() {
		if (!this.mergeMasterId) {
			this.env.showMessage('Please select the primary contact', 'warning');
			return;
		}
		const ids = (this.contactIds || []).filter((id) => !!id).map((id) => Number(id));
		const mergedIds = ids.filter((id) => id !== Number(this.mergeMasterId));
		if (mergedIds.length < 1) {
			this.env.showMessage('Please select at least 2 contacts to merge', 'warning');
			return;
		}

		// Pull latest values from form (edit mode may not have flushed yet).
		for (const key of this.mergeScalarFieldKeys) {
			this.mergeFieldValues[key] = this.normalizeScalar(this.mergeForm?.get(key)?.value);
		}

		const fieldMap: any = {};
		for (const key of this.mergeScalarFieldKeys) {
			fieldMap[key] = {
				FromId: this.mergeFieldMap[key] ?? this.mergeMasterId,
				Value: this.mergeFieldValues[key] ?? '',
			};
		}

		const payload = {
			MasterId: Number(this.mergeMasterId),
			MergedIds: mergedIds,
			FieldMap: fieldMap,
			KeepAddressIds: this.mergeAddressOptions
				.filter((a) => this.selectedAddressKeys[a.Key])
				.map((a) => a.KeepId)
				.filter((id) => !!id),
			KeepTaxInfoIds: this.mergeTaxOptions
				.filter((t) => this.selectedTaxKeys[t.Key])
				.map((t) => t.KeepId)
				.filter((id) => !!id),
			DefaultTaxInfoId: this.getDefaultTaxKeepId(),
			Options: {
				FillBlanksFromMerged: false,
				ReparentChildren: true,
				SoftDeleteMerged: true,
			},
		};

		this.mergeSubmitting = true;
		this.pageProvider.commonService
			.connect('POST', ApiSetting.apiDomain('CRM/Contact/Merge'), payload)
			.toPromise()
			.then((result: any) => {
				this.env.showMessage(result?.Message || 'Merged successfully', 'success');
				this.dismiss('merged', result);
			})
			.catch((err) => {
				this.env.showMessage(err, 'danger');
			})
			.finally(() => {
				this.mergeSubmitting = false;
			});
	}
}
