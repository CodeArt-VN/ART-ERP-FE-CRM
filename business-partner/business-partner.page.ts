import { Component, Renderer2 } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { BRA_BranchProvider, CRM_ContactProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { lib } from 'src/app/services/static/global-functions';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { FormBuilder, FormControl } from '@angular/forms';

@Component({
    selector: 'app-business-partner',
    templateUrl: 'business-partner.page.html',
    styleUrls: ['business-partner.page.scss']
})
export class BusinessPartnerPage extends PageBase {
    branchList = [];
    statusList = [];
    filesDuplicate=[];
    findByValue;
    isShowMergePopup = false;
    formMerge:any
    mergeModel={
        Code :'',
        Name:'',
        WorkPhone:'',
        TaxCode:'',
        Id:0,
        Address:{
            AddressLine1:'',
            AddressLine2:'',
            Contact:'',
            Country:'',
            District:'',
            Id:'',
            Phone1:'',
            Phone2:'',
            Province:'',
            Ward:''
        },
        BillingAddress:'',
        Email:'',
        CompanyName:'',
        IsPersonal:false,
    } ;

    constructor(
        private renderer: Renderer2,
        public pageProvider: CRM_ContactProvider,
        public branchProvider: BRA_BranchProvider,
        public modalController: ModalController,
		public popoverCtrl: PopoverController,
        public alertCtrl: AlertController,
         public loadingController: LoadingController,
        public env: EnvService,
        public navCtrl: NavController,
        public location: Location,
        public formBuilder: FormBuilder,
    ) {
        super();
    }

    departmentList = [];
    preLoadData() {
      //  this.query.WorkPhone='';
     //   this.query.TaxCode='';
        if (!this.sort.Id) {
            this.sort.Id = 'Id';
            this.sortToggle('Id', true);
        }
        
        if (this.pageConfig.pageName == 'vendor') {
            this.query.IgnoredBranch = true;
            this.query.IsVendor = true;
        }
        if (this.pageConfig.pageName == 'carrier') {
            this.query.IgnoredBranch = true;
            this.query.IsCarrier = true;
        }
        else if (this.pageConfig.pageName == 'distributor') {
            this.query.IgnoredBranch = true;
            this.query.IsDistributor = true;
        }
        else if (this.pageConfig.pageName == 'storer') {
            this.query.IgnoredBranch = true;
            this.query.IsStorer = true;
        }

        else if (this.pageConfig.pageName == 'outlet') {
            this.query.IsOutlets = true;
            this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;
        }
        else if (this.pageConfig.pageName == 'customer') {
            this.query.IsCustomer = true;
            this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;
        }
        else if (this.pageConfig.pageName == 'business-partner' || this.pageConfig.pageName == 'contact-mobile'){
            this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;
        }

        Promise.all([
            this.branchProvider.read(),
            this.env.getStatus('BusinessPartner')
        ]).then((values:any) => {
            this.branchList = values[0]['data'];
            this.statusList = values[1];

            this.buildFlatTree(this.branchList, this.branchList, true).then((resp: any) => {
                this.branchList = resp;

                this.branchList.forEach(i => {
                    let prefix = '';
                    for (let j = 1; j < i.level; j++) {
                        prefix += '- '
                    }
                    i.NamePadding = prefix + i.Name;
                    if (i.Type == 'TitlePosition') {
                        i.Flag = true;
                    }
                    else {
                        this.departmentList.push(i);
                    }
                });

                this.departmentList.forEach(i => {
                    i.IDs = [];
                    this.getChildrenDepartmentID(i.IDs, i.Id);
                });

                this.departmentList.forEach(i => {
                    i.Query = JSON.stringify(i.IDs);
                })

                //console.log(this.departmentList)

            });
            super.preLoadData(null);
        });
    }

    getChildrenDepartmentID(ids, id) {
        ids.push(id);
        let children = this.departmentList.filter(i => i.IDParent == id);
        children.forEach(i => {
            this.getChildrenDepartmentID(ids, i.Id);
        })
    }

    loadedData(event) {
        this.items.forEach(i => {
            i.Department = lib.getAttrib(i.IDDepartment, this.branchList);
            i.JobTitle = lib.getAttrib(i.IDJobTitle, this.branchList);
            i.StatusText = lib.getAttrib(i.Status, this.statusList, 'Name', '--', 'Code');
            i.StatusColor = lib.getAttrib(i.Status, this.statusList, 'Color', 'dark', 'Code');
        });

        super.loadedData(event);
    }

    submitBusinessPartner() {
        this.alertCtrl.create({
            header: 'Gửi duyệt',
            //subHeader: '---',
            message: 'Sau khi gửi duyệt, bạn không thể chỉnh sửa đối tượng được nữa. Bạn chắc muốn gửi duyệt tất cả đối tượng chưa duyệt?',
            buttons: [
                {
                    text: 'Không',
                    role: 'cancel',
                    handler: () => {
                        //console.log('Không xóa');
                    }
                },
                {
                    text: 'Gửi duyệt',
                    cssClass: 'danger-btn',
                    handler: () => {

                        let publishEventCode = this.pageConfig.pageName;
                        let apiPath = {
                            method: "POST",
                            url: function () { return ApiSetting.apiDomain("CRM/Contact/SubmitBusinessPartnerForApproval/") }
                        };

                        if (this.submitAttempt == false) {
                            this.submitAttempt = true;
                            let postDTO = { Ids: this.selectedItems.map(e => e.Id) };
                            this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), postDTO).toPromise()
                                .then((savedItem: any) => {
                                    if (publishEventCode) {
                                        this.env.publishEvent({ Code: publishEventCode });
                                    }
                                    this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.save-complete','success');
                                    this.submitAttempt = false;

                                }).catch(err => {
                                    this.submitAttempt = false;
                                    //console.log(err);
                                });
                        }

                    }
                }
            ]
        }).then(alert => {
            alert.present();
        })

    }

    approveBusinessPartner() {

        
        let itemsCanNotProcess = this.selectedItems.filter(i => !(i.Status == "Submitted"));
        if (itemsCanNotProcess.length == this.selectedItems.length) {
            this.env.showTranslateMessage('erp.app.pages.crm.business-partner.message.approve-business-partner-error','warning');
        }
        else {
            itemsCanNotProcess.forEach(i => {
                i.checked = false;
            });
            this.selectedItems = this.selectedItems.filter(i => (i.Status == "Submitted"));

            this.alertCtrl.create({
                header: 'Duyệt ' + this.selectedItems.length + ' đối tượng',
                //subHeader: '---',
                message: 'Bạn chắc muốn duyệt ' + this.selectedItems.length + ' đối tượng đang chọn?',
                buttons: [
                    {
                        text: 'Không',
                        role: 'cancel',
                        handler: () => {
                            //console.log('Không xóa');
                        }
                    },
                    {
                        text: 'Duyệt',
                        cssClass: 'danger-btn',
                        handler: () => {

                            let publishEventCode = this.pageConfig.pageName;
                            let apiPath = {
                                method: "POST",
                                url: function () { return ApiSetting.apiDomain("CRM/Contact/ApproveBusinessPartners/") }
                            };
                    
                            if (this.submitAttempt == false) {
                                this.submitAttempt = true;
                    
                                let postDTO = { Ids: [] };
                                postDTO.Ids = this.selectedItems.map(e => e.Id);
                    
                                this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), postDTO).toPromise()
                                    .then((savedItem: any) => {
                                        if (publishEventCode) {
                                            this.env.publishEvent({ Code: publishEventCode });
                                        }
                                        this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.save-complete','success');
                                        this.submitAttempt = false;
                    
                                    }).catch(err => {
                                        this.submitAttempt = false;
                                        //console.log(err);
                                });
                            }
                        }
                    }
                ]
            }).then(alert => {
                alert.present();
            })
        }
    }

    disapproveBusinessPartner() {
        let itemsCanNotProcess = this.selectedItems.filter(i => !(i.Status == 'Submitted' || i.Status == 'Approved'));
        if (itemsCanNotProcess.length == this.selectedItems.length) {
            this.env.showTranslateMessage('erp.app.pages.crm.business-partner.message.disapprove-business-partner-error','warning');
        }
        else {
            itemsCanNotProcess.forEach(i => {
                i.checked = false;
            });
            this.selectedItems = this.selectedItems.filter(i => (i.Status == 'Submitted' || i.Status == 'Approved'));

            this.alertCtrl.create({
                header: 'Từ chối ' + this.selectedItems.length + ' đối tượng',
                //subHeader: '---',
                message: 'Bạn chắc muốn từ chối ' + this.selectedItems.length + ' đối tượng đang chọn?',
                buttons: [
                    {
                        text: 'Không',
                        role: 'cancel',
                        handler: () => {
                            //console.log('Không xóa');
                        }
                    },
                    {
                        text: 'Từ chối',
                        cssClass: 'danger-btn',
                        handler: () => {

                            let publishEventCode = this.pageConfig.pageName;
                            let apiPath = {
                                method: "POST",
                                url: function () { return ApiSetting.apiDomain("CRM/Contact/DisapproveBusinessPartners/") }
                            };
                    
                            if (this.submitAttempt == false) {
                                this.submitAttempt = true;
                    
                                let postDTO = { Ids: [] };
                                postDTO.Ids = this.selectedItems.map(e => e.Id);
                    
                                this.pageProvider.commonService.connect(apiPath.method, apiPath.url(), postDTO).toPromise()
                                    .then((savedItem: any) => {
                                        if (publishEventCode) {
                                            this.env.publishEvent({ Code: publishEventCode });
                                        }
                                        this.env.showTranslateMessage('erp.app.pages.sale.sale-order.message.save-complete','success');
                                        this.submitAttempt = false;
                    
                                    }).catch(err => {
                                        this.submitAttempt = false;
                                        //console.log(err);
                                });
                            }
                        }
                    }
                ]
            }).then(alert => {
                alert.present();
            })
        }
    }

    handleChange(e){
        if (e.target.value=='WorkPhone'){
            this.query.WorkPhone='WorkPhone';
           this.findByValue = 'WorkPhone';
           this.query.TaxCode =undefined;
        }
        else{
            this.query.TaxCode = 'TaxCode'
            this.findByValue = 'TaxCode'
            this.query.WorkPhone=undefined;
          }
        console.log(e);
    }
    findBy(){
        let q = {"FindBy": this.findByValue};
        this.query.IgnoredBranch = true;
        let apiPath = { method: "GET", url: function () { return ApiSetting.apiDomain("CRM/Contact/FindDuplicates") } };
        this.pageProvider.commonService.connect(apiPath.method, apiPath.url(),q).toPromise().then((data: any) => {
        this.filesDuplicate = data;
        })
    }
    showMergePopup(e){
        this.isShowMergePopup= true;
        this.changeSelected(this.selectedItems[0])
    }
   
    changeSelected(selectedModel){
        //   this.mergeModel.Code =selectedModel.Code;
        //   this.mergeModel.Name= selectedModel.Name;
        //   this.mergeModel.WorkPhone= selectedModel.WorkPhone;
        //   this.mergeModel.TaxCode= selectedModel.TaxCode;
        //   this.mergeModel.BillingAddress= selectedModel.BillingAddress;
        //   this.mergeModel.CompanyName= selectedModel.CompanyName;
        //   this.mergeModel.Email= selectedModel.Email;
        //   this.mergeModel.Id= selectedModel.Id;
        //   this.mergeModel.IsPersonal= selectedModel.IsPersonal;
          
        //   this.mergeModel.Address.AddressLine1 = selectedModel.Addresses[0]?.AddressLine1;
        //   this.mergeModel.Address.AddressLine2 = selectedModel.Addresses[0]?.AddressLine2;
        //   this.mergeModel.Address.Contact = selectedModel.Addresses[0]?.Contact;
        //   this.mergeModel.Address.Country = selectedModel.Addresses[0]?.Country;
        //   this.mergeModel.Address.Phone1 = selectedModel.Addresses[0]?.Phone1;
        //   this.mergeModel.Address.Phone2 = selectedModel.Addresses[0]?.Phone2;
        //   this.mergeModel.Address.Province = selectedModel.Addresses[0]?.Province;
        //   this.mergeModel.Address.Ward = selectedModel.Addresses[0]?.Ward;
        this.mergeModel={...selectedModel};
        this.formGroup =this.formBuilder.group({
            Id: new FormControl({ value:  this.mergeModel.Id, disabled: true }),
            Code: [this.mergeModel.Code],
            BillingAddress: [this.mergeModel.BillingAddress] ,
            CompanyName: [this.mergeModel.CompanyName] ,
            Email: [this.mergeModel.Email] ,
            IsPersonal: [this.mergeModel.IsPersonal] ,
            TaxCode: [this.mergeModel.TaxCode] ,
            WorkPhone: [this.mergeModel.WorkPhone] ,
            MergedItems:[[]],
            IsDisabled: new FormControl({ value: '', disabled: true }),
            IsDeleted: new FormControl({ value: '', disabled: true }),
            CreatedBy: new FormControl({ value: '', disabled: true }),
            CreatedDate: new FormControl({ value: '', disabled: true }),
            ModifiedBy: new FormControl({ value: '', disabled: true }),
            ModifiedDate: new FormControl({ value: '', disabled: true }),
        })
    }
    mergeContact(){
        // so sánh với selected hiện tại 
        //  let obj:any={};
        //  obj.Id =  this.mergeModel.Id;
        this.formGroup.get('MergedItems').setValue(this.selectedItems.map(({ Id }) => Id).filter(x=>x!=this.mergeModel.Id));
      
        // let selectedMergeModel = this.selectedItems.find(x=>x.Id == obj.Id);
        // obj.Addresses = [{ }];
        // if(this.mergeModel.Code != selectedMergeModel.Code ){
        //     obj.Code = this.mergeModel.Code
        // } 
        // if(this.mergeModel.Name != selectedMergeModel.Name ){
        //     obj.Name = this.mergeModel.Name
        // }
        // if(this.mergeModel.WorkPhone != selectedMergeModel.WorkPhone ){
        //     obj.WorkPhone = this.mergeModel.WorkPhone
        // } 
        // if(this.mergeModel.TaxCode != selectedMergeModel.TaxCode ){
        // obj.TaxCode = this.mergeModel.TaxCode
        // } 
        // if(this.mergeModel.BillingAddress != selectedMergeModel.BillingAddress ){
        //     obj.BillingAddress = this.mergeModel.BillingAddress
        // }  
        // if(this.mergeModel.Email != selectedMergeModel.Email ){
        //     obj.Email = this.mergeModel.Email
        // }  
        // if(this.mergeModel.IsPersonal != selectedMergeModel.IsPersonal ){
        //     obj.IsPersonal = this.mergeModel.IsPersonal
        // }  
        // if(this.mergeModel.IsPersonal != selectedMergeModel.IsPersonal ){
        //     obj.IsPersonal = this.mergeModel.IsPersonal
        // }  
        // if(this.mergeModel.Address.AddressLine1 != selectedMergeModel.Addresses[0]?.AddressLine1 ){
        //     obj.Addresses [0].AddressLine1 = this.mergeModel.Address.AddressLine1
        // }  
        // if(this.mergeModel.Address.AddressLine2 != selectedMergeModel.Addresses[0]?.AddressLine2 ){
        //     obj.Addresses [0].AddressLine2 = this.mergeModel.Address.AddressLine2
        // }  
        // if(this.mergeModel.Address.Contact != selectedMergeModel.Addresses[0]?.Contact ){
        //     obj.Addresses [0].Contact = this.mergeModel.Address.Contact
        // }  
        // if(this.mergeModel.Address.Country != selectedMergeModel.Addresses[0]?.Country ){
        //     obj.Addresses [0].Country = this.mergeModel.Address.Country
        // }  
        // if(this.mergeModel.Address.Phone1 != selectedMergeModel.Addresses[0]?.Phone1 ){
        //     obj.Addresses [0].Phone1 = this.mergeModel.Address.Phone1
        // }  
        // if(this.mergeModel.Address.Phone2 != selectedMergeModel.Addresses[0]?.Phone2 ){
        //     obj.Addresses [0].Phone2 = this.mergeModel.Address.Phone2
        // }  
        // if(this.mergeModel.Address.Province != selectedMergeModel.Addresses[0]?.Province ){
        //     obj.Addresses [0].Province = this.mergeModel.Address.Province
        // }  
        // if(this.mergeModel.Address.Ward != selectedMergeModel.Addresses[0]?.Ward ){
        //     obj.Addresses [0].Ward = this.mergeModel.Address.Ward
        // }  
        let apiPath = { method: "POST", url: function () { return ApiSetting.apiDomain("CRM/Contact/Merge") } };
        this.pageProvider.commonService.connect(apiPath.method, apiPath.url(),this.formGroup.getRawValue()).toPromise().then((data: any) => {
            console.log(data)
        })
        console.log()
    }
   
}
