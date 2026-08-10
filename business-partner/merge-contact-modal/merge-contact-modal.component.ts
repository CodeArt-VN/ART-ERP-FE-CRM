import { Component, Input, OnInit } from '@angular/core';
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

	mergePreview: any = null;
	mergeMasterId = 0;
	mergeFieldMap: Record<string, number> = {};
	/** Editable final scalar values shown in middle + sticky preview. */
	mergeFieldValues: Record<string, string> = {};
	/** Multi-select Address / Tax (MST) by distinct key (not every duplicate row). */
	selectedAddressKeys: Record<string, boolean> = {};
	selectedTaxKeys: Record<string, boolean> = {};
	mergeMasterSearch = '';
	mergeShowAllFields = false;
	mergePreviewLoading = false;
	mergeSubmitting = false;
	/** Cached — do NOT recompute via getters every CD (freezes UI). */
	filteredMergeContacts: any[] = [];
	visibleMergeFields: any[] = [];
	mergeAddressOptions: any[] = [];
	mergeTaxOptions: any[] = [];
	mergeRelatedByContactEntries: { id: string; summary: string }[] = [];
	mergeRelatedTotals = {
		SaleOrders: 0,
		PurchaseOrders: 0,
		Invoices: 0,
		Payments: 0,
		Documents: 0,
	};
	mergeScalarPreviewRows: { key: string; value: string }[] = [];
	mergeSelectedAddressesPreview: any[] = [];
	mergeSelectedTaxPreview: any[] = [];
	mergeFields: { Key: string; HasConflict: boolean; Options: { Value: string; SourceIds: number[] }[] }[] = [];
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
		public env: EnvService
	) {}

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
		this.mergeRelatedTotals = { SaleOrders: 0, PurchaseOrders: 0, Invoices: 0, Payments: 0, Documents: 0 };
		this.mergeScalarPreviewRows = [];
		this.mergeSelectedAddressesPreview = [];
		this.mergeSelectedTaxPreview = [];
		this.mergeFieldMap = {};
		this.mergeFieldValues = {};
		this.selectedAddressKeys = {};
		this.selectedTaxKeys = {};
	}

	loadMergePreview() {
		const ids = (this.contactIds || []).filter((id) => !!id);
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
				this.mergeMasterId = data?.SuggestedMasterId || ids[0];
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
					});
				} else {
					const g = taxMap.get(key);
					if (!g.Ids.includes(t.Id)) {
						g.Ids.push(t.Id);
						g.IdSources.push({ Id: t.Id, SourceId: c.Id });
					}
					if (!g.SourceIds.includes(c.Id)) g.SourceIds.push(c.Id);
					if (t.IsDefault) g.IsDefault = true;
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

		// Default-select new distinct keys; keep previous choices for keys that remain.
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

		this.rebuildRelatedMovePreview(contacts);
		this.refreshMergeResultPreview();
	}

	/** FE derives field options/conflicts from Contacts scalars (API no longer returns Fields). */
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
			return { Key: key, HasConflict: Options.length > 1, Options };
		});
	}

	normalizeScalar(val: any): string {
		if (val === null || val === undefined) return '';
		if (typeof val === 'boolean') return val ? 'true' : 'false';
		return String(val).trim();
	}

	/** Totals to move = sum Related of all non-master contacts (recomputed when Master changes). */
	rebuildRelatedMovePreview(contacts: any[]) {
		const totals = { SaleOrders: 0, PurchaseOrders: 0, Invoices: 0, Payments: 0, Documents: 0 };
		const entries = [];
		for (const c of contacts || []) {
			if (c.Id === this.mergeMasterId) continue;
			const related = c.Related || {};
			const summary = this.formatRelatedCounts(related);
			if (summary) {
				entries.push({ id: String(c.Id), summary });
			}
			totals.SaleOrders += related.SaleOrders || 0;
			totals.PurchaseOrders += related.PurchaseOrders || 0;
			totals.Invoices += related.Invoices || 0;
			totals.Payments += (related.IncomingPayments || 0) + (related.OutgoingPayments || 0);
		}
		totals.Documents = totals.SaleOrders + totals.PurchaseOrders + totals.Invoices + totals.Payments;
		this.mergeRelatedTotals = totals;
		this.mergeRelatedByContactEntries = entries;
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
		const fromMaster = (group.IdSources || []).find((x) => x.SourceId === this.mergeMasterId);
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
		for (const key of this.mergeScalarFieldKeys) {
			this.mergeFieldMap[key] = this.mergeMasterId;
			this.mergeFieldValues[key] = this.getMergeScalarRawValue(this.mergeMasterId, key);
		}
	}

	initMergeChildSelections() {
		this.selectedAddressKeys = {};
		this.selectedTaxKeys = {};
	}

	setMergeMaster(id: number) {
		if (this.mergeMasterId === id) {
			return;
		}
		this.mergeMasterId = id;
		this.initMergeFieldMap();
		this.rebuildMergeViewCache();
	}

	applyMasterAllFields() {
		for (const key of this.mergeScalarFieldKeys) {
			this.mergeFieldMap[key] = this.mergeMasterId;
			this.mergeFieldValues[key] = this.getMergeScalarRawValue(this.mergeMasterId, key);
		}
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
						break;
					}
				}
				if ((this.mergeFieldValues[field.Key] || '').trim()) {
					break;
				}
			}
		}
		this.refreshMergeResultPreview();
	}

	pickMergeFieldOption(fieldKey: string, sourceId: number, value: string) {
		this.mergeFieldMap[fieldKey] = sourceId;
		this.mergeFieldValues[fieldKey] = value ?? this.getMergeScalarRawValue(sourceId, fieldKey);
		this.refreshMergeResultPreview();
	}

	onMergeFieldValueEdit() {
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
		this.refreshMergeResultPreview();
	}

	getMergeContactById(id: number) {
		return (this.mergePreview?.Contacts || []).find((c) => c.Id === id);
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
			if (value === 'true') return 'Cá nhân';
			if (value === 'false') return 'Tổ chức';
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
		const parts = [];
		if (counts.SaleOrders) parts.push(`${counts.SaleOrders} SO`);
		if (counts.PurchaseOrders) parts.push(`${counts.PurchaseOrders} PO`);
		if (counts.Invoices) parts.push(`${counts.Invoices} inv`);
		if (counts.IncomingPayments || counts.OutgoingPayments) {
			parts.push(`${(counts.IncomingPayments || 0) + (counts.OutgoingPayments || 0)} pay`);
		}
		return parts.join(', ');
	}

	mergeContact() {
		if (!this.mergeMasterId) {
			this.env.showMessage('Please select the primary contact', 'warning');
			return;
		}
		const ids = (this.contactIds || []).filter((id) => !!id);
		const mergedIds = ids.filter((id) => id !== this.mergeMasterId);
		if (mergedIds.length < 1) {
			this.env.showMessage('Please select at least 2 contacts to merge', 'warning');
			return;
		}

		const fieldMap: any = {};
		for (const key of this.mergeScalarFieldKeys) {
			fieldMap[key] = {
				FromId: this.mergeFieldMap[key] ?? this.mergeMasterId,
				Value: this.mergeFieldValues[key] ?? '',
			};
		}

		const payload = {
			MasterId: this.mergeMasterId,
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
