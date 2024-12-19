import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { BRA_BranchProvider, CRM_ContactProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { lib } from 'src/app/services/static/global-functions';
import { ApiSetting } from 'src/app/services/static/api-setting';

@Component({
    selector: 'app-outlet',
    templateUrl: 'outlet.page.html',
    styleUrls: ['outlet.page.scss'],
    standalone: false
})
export class OutletPage extends PageBase {
  branchList = [];
  statusList = [];
  constructor(
    public pageProvider: CRM_ContactProvider,
    public branchProvider: BRA_BranchProvider,
    public modalController: ModalController,
    public popoverCtrl: PopoverController,
    public alertCtrl: AlertController,
    public loadingController: LoadingController,
    public env: EnvService,
    public navCtrl: NavController,
  ) {
    super();
  }

  departmentList = [];
  preLoadData() {
    this.query.Status = '';
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
    } else if (this.pageConfig.pageName == 'distributor') {
      this.query.IgnoredBranch = true;
      this.query.IsDistributor = true;
    } else if (this.pageConfig.pageName == 'storer') {
      this.query.IgnoredBranch = true;
      this.query.IsStorer = true;
    } else if (this.pageConfig.pageName == 'outlet') {
      this.query.IsOutlets = true;
      this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;
    } else if (this.pageConfig.pageName == 'customer') {
      this.query.IsCustomer = true;
      this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;
    } else if (this.pageConfig.pageName == 'outlet' || this.pageConfig.pageName == 'contact-mobile') {
      this.query.IDOwner = this.pageConfig.canViewAllData ? 'all' : this.env.user.StaffID;
    }

    Promise.all([this.branchProvider.read(), this.env.getStatus('BusinessPartner')]).then((values: any) => {
      this.branchList = values[0]['data'];
      this.statusList = values[1];

      this.buildFlatTree(this.branchList, this.branchList, true).then((resp: any) => {
        this.branchList = resp;

        this.branchList.forEach((i) => {
          let prefix = '';
          for (let j = 1; j < i.level; j++) {
            prefix += '- ';
          }
          i.NamePadding = prefix + i.Name;
          if (i.Type == 'TitlePosition') {
            i.Flag = true;
          } else {
            this.departmentList.push(i);
          }
        });

        this.departmentList.forEach((i) => {
          i.IDs = [];
          this.getChildrenDepartmentID(i.IDs, i.Id);
        });

        this.departmentList.forEach((i) => {
          i.Query = JSON.stringify(i.IDs);
        });

        //console.log(this.departmentList)
      });
      super.preLoadData(null);
    });
  }

  getChildrenDepartmentID(ids, id) {
    ids.push(id);
    let children = this.departmentList.filter((i) => i.IDParent == id);
    children.forEach((i) => {
      this.getChildrenDepartmentID(ids, i.Id);
    });
  }

  loadedData(event) {
    this.items.forEach((i) => {
      i.Department = lib.getAttrib(i.IDDepartment, this.branchList);
      i.JobTitle = lib.getAttrib(i.IDJobTitle, this.branchList);
      i.StatusText = lib.getAttrib(i.Status, this.statusList, 'Name', '--', 'Code');
      i.StatusColor = lib.getAttrib(i.Status, this.statusList, 'Color', 'dark', 'Code');
    });

    super.loadedData(event);
  }

  submitBusinessPartner() {
    this.alertCtrl
      .create({
        header: 'Gửi duyệt',
        //subHeader: '---',
        message:
          'Sau khi gửi duyệt, bạn không thể chỉnh sửa đối tượng được nữa. Bạn có chắc muốn gửi duyệt tất cả đối tượng chưa duyệt?',
        buttons: [
          {
            text: 'Không',
            role: 'cancel',
            handler: () => {
              //console.log('Không xóa');
            },
          },
          {
            text: 'Gửi duyệt',
            cssClass: 'danger-btn',
            handler: () => {
              let publishEventCode = this.pageConfig.pageName;
              let apiPath = {
                method: 'POST',
                url: function () {
                  return ApiSetting.apiDomain('CRM/Contact/SubmitBusinessPartnerForApproval/');
                },
              };

              if (this.submitAttempt == false) {
                this.submitAttempt = true;
                let postDTO = {
                  Ids: this.selectedItems.map((e) => e.Id),
                };
                this.pageProvider.commonService
                  .connect(apiPath.method, apiPath.url(), postDTO)
                  .toPromise()
                  .then((savedItem: any) => {
                    if (publishEventCode) {
                      this.env.publishEvent({
                        Code: publishEventCode,
                      });
                    }
                    this.env.showMessage('Saving completed!', 'success');
                    this.submitAttempt = false;
                  })
                  .catch((err) => {
                    this.submitAttempt = false;
                    //console.log(err);
                  });
              }
            },
          },
        ],
      })
      .then((alert) => {
        alert.present();
      });
  }

  approveBusinessPartner() {
    let itemsCanNotProcess = this.selectedItems.filter((i) => !(i.Status == 'Submitted'));
    if (itemsCanNotProcess.length == this.selectedItems.length) {
      this.env.showMessage(
        'Selected Business Partners Cannot Be Approved. Submitted Business Partners Only!',
        'warning',
      );
    } else {
      itemsCanNotProcess.forEach((i) => {
        i.checked = false;
      });
      this.selectedItems = this.selectedItems.filter((i) => i.Status == 'Submitted');

      this.alertCtrl
        .create({
          header: 'Duyệt ' + this.selectedItems.length + ' đối tượng',
          //subHeader: '---',
          message: 'Bạn có chắc muốn duyệt ' + this.selectedItems.length + ' đối tượng đang chọn?',
          buttons: [
            {
              text: 'Không',
              role: 'cancel',
              handler: () => {
                //console.log('Không xóa');
              },
            },
            {
              text: 'Duyệt',
              cssClass: 'danger-btn',
              handler: () => {
                let publishEventCode = this.pageConfig.pageName;
                let apiPath = {
                  method: 'POST',
                  url: function () {
                    return ApiSetting.apiDomain('CRM/Contact/ApproveBusinessPartners/');
                  },
                };

                if (this.submitAttempt == false) {
                  this.submitAttempt = true;

                  let postDTO = { Ids: [] };
                  postDTO.Ids = this.selectedItems.map((e) => e.Id);

                  this.pageProvider.commonService
                    .connect(apiPath.method, apiPath.url(), postDTO)
                    .toPromise()
                    .then((savedItem: any) => {
                      if (publishEventCode) {
                        this.env.publishEvent({
                          Code: publishEventCode,
                        });
                      }
                      this.env.showMessage('Saving completed!', 'success');
                      this.submitAttempt = false;
                    })
                    .catch((err) => {
                      this.submitAttempt = false;
                      //console.log(err);
                    });
                }
              },
            },
          ],
        })
        .then((alert) => {
          alert.present();
        });
    }
  }

  disapproveBusinessPartner() {
    let itemsCanNotProcess = this.selectedItems.filter((i) => !(i.Status == 'Submitted' || i.Status == 'Approved'));
    if (itemsCanNotProcess.length == this.selectedItems.length) {
      this.env.showMessage(
        'Selected Business Partners Cannot Be Disapproved. Submitted Business Partners Only!',
        'warning',
      );
    } else {
      itemsCanNotProcess.forEach((i) => {
        i.checked = false;
      });
      this.selectedItems = this.selectedItems.filter((i) => i.Status == 'Submitted' || i.Status == 'Approved');

      this.alertCtrl
        .create({
          header: 'Từ chối ' + this.selectedItems.length + ' đối tượng',
          //subHeader: '---',
          message: 'Bạn có chắc muốn từ chối ' + this.selectedItems.length + ' đối tượng đang chọn?',
          buttons: [
            {
              text: 'Không',
              role: 'cancel',
              handler: () => {
                //console.log('Không xóa');
              },
            },
            {
              text: 'Từ chối',
              cssClass: 'danger-btn',
              handler: () => {
                let publishEventCode = this.pageConfig.pageName;
                let apiPath = {
                  method: 'POST',
                  url: function () {
                    return ApiSetting.apiDomain('CRM/Contact/DisapproveBusinessPartners/');
                  },
                };

                if (this.submitAttempt == false) {
                  this.submitAttempt = true;

                  let postDTO = { Ids: [] };
                  postDTO.Ids = this.selectedItems.map((e) => e.Id);

                  this.pageProvider.commonService
                    .connect(apiPath.method, apiPath.url(), postDTO)
                    .toPromise()
                    .then((savedItem: any) => {
                      if (publishEventCode) {
                        this.env.publishEvent({
                          Code: publishEventCode,
                        });
                      }
                      this.env.showMessage('Saving completed!', 'success');
                      this.submitAttempt = false;
                    })
                    .catch((err) => {
                      this.submitAttempt = false;
                      //console.log(err);
                    });
                }
              },
            },
          ],
        })
        .then((alert) => {
          alert.present();
        });
    }
  }
}
