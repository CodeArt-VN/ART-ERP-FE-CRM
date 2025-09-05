import { Component, ChangeDetectorRef, ViewChild, ElementRef, QueryList, ViewChildren, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { NavController, LoadingController, AlertController } from '@ionic/angular';
import { PageBase } from 'src/app/page-base';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { FormBuilder, Validators, FormControl, FormArray } from '@angular/forms';
import { CommonService } from 'src/app/services/core/common.service';
import { CRM_BrandProvider, CRM_PolLevelProvider, CRM_RewardCategoryProvider, CRM_RewardProvider, PR_ProgramProvider } from 'src/app/services/static/services.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { environment } from 'src/environments/environment';
import { DynamicScriptLoaderService } from 'src/app/services/custom/custom.service';
import { thirdPartyLibs } from 'src/app/services/static/thirdPartyLibs';

declare var Quill: any;

@Component({
	selector: 'app-reward-detail',
	templateUrl: './reward-detail.page.html',
	styleUrls: ['./reward-detail.page.scss'],
	standalone: false,
})
export class RewardDetailPage extends PageBase {
	Image: any;
	noImage = 'assets/avartar-empty.jpg';
	imageServer = environment.posImagesServer;
	statusList = [];
	typeList = [];
	brandList = [];
	programList = [];
	rewardCategoryList = [];

	editor: any;
	contentBeforeChange = '';
	isEdit = true;
	_content = '';
	@ViewChildren('quillEditor') quillElement: QueryList<ElementRef>;
	constructor(
		public pageProvider: CRM_RewardProvider,
		public brandProvider: CRM_BrandProvider,
		public programProvider: PR_ProgramProvider,
		public rewardCategoryProvider: CRM_RewardCategoryProvider,
		public env: EnvService,
		public navCtrl: NavController,
		public route: ActivatedRoute,
		public alertCtrl: AlertController,
		public formBuilder: FormBuilder,
		public cdr: ChangeDetectorRef,
		public loadingController: LoadingController,
		public commonService: CommonService,
		private dynamicScriptLoaderService: DynamicScriptLoaderService
	) {
		super();
		this.pageConfig.isDetailPage = true;

		this.formGroup = formBuilder.group({
			// IDBranch: [this.env.selectedBranch],
			IDBrand: ['', Validators.required],
			IDProgram: ['', Validators.required],
			IDRewardCategory: ['', Validators.required],
			Id: new FormControl({ value: '', disabled: true }),
			Code: [''],
			Name: ['', Validators.required],
			Remark: [''],
			Sort: [''],
			IsDisabled: new FormControl({ value: '', disabled: true }),
			IsDeleted: new FormControl({ value: '', disabled: true }),
			CreatedBy: new FormControl({ value: '', disabled: true }),
			CreatedDate: new FormControl({ value: '', disabled: true }),
			ModifiedBy: new FormControl({ value: '', disabled: true }),
			ModifiedDate: new FormControl({ value: '', disabled: true }),
			IsShow: [false],
			IsHotReward: [false],
			PublishDate: [],
			Type: ['Voucher', Validators.required],
			Status: new FormControl({ value: 'Draft', disabled: true }),
			Logo: [null],
			Banner: [null],
			Content: [''],
		});
	}

	preLoadData(event?: any): void {
		Promise.all([this.brandProvider.read(), this.programProvider.read(), this.rewardCategoryProvider.read(), this.env.getStatus('Reward')]).then((values: any) => {
			this.brandList = values[0].data;
			this.programList = values[1].data;
			this.rewardCategoryList = values[2].data;
			this.statusList = values[3];
			super.preLoadData();
		});
	}

	loadedData(event?: any, ignoredFromGroup?: boolean): void {
		if (!this.item?.Id) {
			this.formGroup.controls.Status.markAsDirty();
		}
		super.loadedData();
	}

	segmentView = 's1';
	segmentChanged(ev: any) {
		this.segmentView = ev.detail.value;
	}

	saveChange() {
		return this.saveChange2();
	}

	@ViewChild('uploadImage') uploadImage: any;
	_isBanner;
	onClickUpload(isBanner: boolean) {
		this._isBanner = isBanner;
		this.uploadImage.nativeElement.value = '';
		this.uploadImage.nativeElement.click();
	}

	onFileSelected = (event) => {
		if (event.target.files.length == 0) {
			return;
		}
		let apiDomain = 'CRM/Reward/UploadImage/';
		let apiPath = {
			method: 'UPLOAD',
			url: function () {
				return ApiSetting.apiDomain(apiDomain) + 'Reward';
			},
		};

		this.commonService.upload(apiPath, event.target.files[0]).then((result: any) => {
			if (result != null) {
				this.env.showMessage('Upload success', 'success');
				const envImage = result; // environment.posImagesServer +
				if (this._isBanner) {
					this.formGroup.controls.Banner.setValue(envImage);
					this.formGroup.controls.Banner.markAsDirty();
				} else {
					this.formGroup.controls.Logo.setValue(envImage);
					this.formGroup.controls.Logo.markAsDirty();
				}
				this.saveChange();
			} else {
				this.env.showMessage('Upload failed', 'success');
			}
		});
	};

	ngAfterViewInit() {
		this.quillElement.changes.subscribe((elements) => {
			if (typeof elements.first !== 'undefined') {
				this.loadQuillEditor();
			}
		});
	}

	loadQuillEditor() {
		if (typeof Quill !== 'undefined') {
			this.initQuill();
		} else {
			this.dynamicScriptLoaderService
				.loadResources(thirdPartyLibs.quill.source)
				.then(() => {
					this.initQuill();
				})
				.catch((error) => console.error('Error loading script', error));
		}
	}

	initQuill() {
		if (typeof Quill !== 'undefined') {
			const existingToolbar = document.querySelector('.ql-toolbar');
			if (existingToolbar) {
				existingToolbar.parentNode.removeChild(existingToolbar);
			}
			this.editor = new Quill('#editor', {
				modules: {
					toolbar: {
						container: [
							['bold', 'italic', 'underline', 'strike'], // toggled buttons
							['blockquote', 'code-block'],

							[{ header: 1 }, { header: 2 }], // custom button values
							[{ list: 'ordered' }, { list: 'bullet' }],
							[{ script: 'sub' }, { script: 'super' }], // superscript/subscript
							[{ indent: '-1' }, { indent: '+1' }], // outdent/indent
							[{ direction: 'rtl' }], // text direction

							[{ size: ['small', false, 'large', 'huge'] }], // custom dropdown
							[{ header: [1, 2, 3, 4, 5, 6, false] }],

							[{ color: [] }, { background: [] }], // dropdown with defaults from theme
							[{ font: [] }],
							[{ align: [] }],
							['image', 'code-block'],

							['clean'], // remove formatting button
							['fullscreen'],
							['showhtml'],
						],
						handlers: {
							image: this.imageHandler.bind(this),
							// fullscreen: () => this.toggleFullscreen(),
							showhtml: () => this.showHtml(),
						},
					},
				},
				theme: 'snow',
				placeholder: 'Typing ...',
			});

			// Set default background color to white for the editor area
			const editorContainer = document.querySelector('#editor .ql-editor') as HTMLElement;
			if (editorContainer) {
				editorContainer.style.backgroundColor = '#ffffff';
				editorContainer.style.height = '100%';
				editorContainer.style.width = '100%';
				editorContainer.style.minHeight = 'calc(-400px + 100vh)';
			}
			const editorParent = document.querySelector('#editor') as HTMLElement;
			if (editorParent) {
				editorParent.style.height = '100%';
				editorParent.style.width = '100%';
			}
			//choose image
			//this.editor.getModule("toolbar").addHandler("image", this.imageHandler.bind(this));

			this.editor.on('text-change', (delta, oldDelta, source) => {
				if (typeof this.editor.root.innerHTML !== 'undefined' && this.formGroup.controls.Content.value !== this.editor.root.innerHTML) {
					this.formGroup.controls.Content.setValue(this.editor.root.innerHTML, { emitEvent: false });
					this.formGroup.controls.Content.markAsDirty();
				}
				if (this.editor.root.innerHTML == '<p><br></p>') {
					this.formGroup.controls.Content.setValue(null, { emitEvent: false });
				}
			});

			// icon fullscreen
			const toolbarCustom = this.editor.getModule('toolbar');
			const fullscreenButton = toolbarCustom.container.querySelector('button.ql-fullscreen');
			if (fullscreenButton) {
				const fullscreenIcon = document.createElement('ion-icon');
				fullscreenIcon.setAttribute('name', 'resize');
				fullscreenIcon.setAttribute('color', 'dark');
				fullscreenButton.innerHTML = '';
				fullscreenButton.appendChild(fullscreenIcon);
			}

			// icon show HTML
			const showHtmlButton = toolbarCustom.container.querySelector('button.ql-showhtml');
			if (showHtmlButton) {
				const showHtmlIcon = document.createElement('ion-icon');
				showHtmlIcon.setAttribute('name', 'logo-html5');
				showHtmlIcon.setAttribute('color', 'dark');
				showHtmlButton.innerHTML = '';
				showHtmlButton.appendChild(showHtmlIcon);
			}
			const toolbar = document.querySelector('.ql-toolbar');
			toolbar.addEventListener('mousedown', (event) => {
				event.preventDefault();
			});
		}
	}

	imageHandler() {
		const imageUrl = prompt('Please enter the image URL:');
		if (imageUrl) {
			const range = this.editor.getSelection();
			this.editor.insertEmbed(range.index, 'image', imageUrl);
		}
	}

	showHtml() {
		const editorContent = this.editor.root;
		const isHtmlMode = /&lt;|&gt;|&amp;|&quot;|&#39;/.test(editorContent.innerHTML);
		if (isHtmlMode) {
			const htmlContent = editorContent.textContent || '';
			this.editor.root.innerHTML = htmlContent;
		} else {
			const richTextContent = this.editor.root.innerHTML;
			this.editor.root.textContent = richTextContent;
		}

		this.formGroup.controls.Content.setValue(this.editor.root.innerHTML);
		if (this.editor.root.innerHTML == '<p><br></p>') {
			this.formGroup.controls.Content.setValue(this.editor.root.innerHTML);
		}
	}

	preView() {
		this.isEdit = false;
		this.contentBeforeChange = this.item.Content;
		this.item.Content = this.item.Content ?? this.editor?.root?.innerHTML ?? '';
	}
	edit() {
		this.isEdit = true;
		this.item.Content = this.item.Content ?? this.editor?.root?.innerHTML ?? '';
		this.contentBeforeChange = this.item.Content;
	}

	saveContent() {
		this.saveChange();
	}
}
