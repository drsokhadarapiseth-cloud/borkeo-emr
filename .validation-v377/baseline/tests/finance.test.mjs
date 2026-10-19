import {requestConcession,reviewConcession} from '../server/payment-policy.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema, getUserAccess, setUserAccess, validContexts } from '../server/access.mjs';
import { addCharge, addExpense, addPayment, cashflowMonth, monthlyServiceRevenue, ensureFinanceSchema, financePatientSearch, listPatientInvoices, patientBill, serviceCatalog, setFinanceProfile, setServiceCatalogItem } from '../server/finance.mjs';

// Existing saved discounts remain valid after upgrading; new ones need approval.
function existingDiscount(database,patientKey,values,userId){
 const inv=patientBill(database,patientKey).invoice;
 database.sqlite.prepare('UPDATE finance_invoices SET discount_percent=?,discount_amount_minor=? WHERE id=?').run(values.discountPercent||0,values.discountAmount||0,inv.id);
 return setFinanceProfile(database,patientKey,values,userId);
}
function setup() {
  const database = openDatabase(':memory:');
  ensureAccessSchema(database);
  ensureFinanceSchema(database);
  const now = Date.now();
  const userId = crypto.randomUUID();
  database.createUser({ id:userId, username:'financeadmin', displayName:'Finance Admin', passwordHash:'test', role:'ADMIN', createdAt:now });
  const patientKey = 'patient-finance-test';
  database.upsertPatient({
    id:crypto.randomUUID(), patientKey,
    summary:{caseNumber:'C-100',healthId:'',firstName:'Dara',lastName:'Sok',fullName:'Sok Dara',sex:'M',age:'40',dateOfBirth:'',phone:'',equityCard:'',paymentType:'',departmentCode:'medicine',departmentNameKh:'',departmentNameEn:'Medicine',serviceMode:'ipd',entryDate:'2026-09-15',dischargeDate:''},
    data:{},userId,savedAt:now,
  });
  return { database, userId, patientKey };
}

test('finance roles are selectable without a ward context', () => {
  const database = openDatabase(':memory:'); ensureAccessSchema(database);
  const id=crypto.randomUUID(), now=Date.now();
  database.createUser({id,username:'acct',displayName:'Accountant',passwordHash:'x',role:'REGISTRATION',createdAt:now});
  setUserAccess(database,id,['ACCOUNTANT','CLERK','DIRECTOR'],[],now);
  const access=getUserAccess(database,id); const contexts=validContexts(access);
  assert.deepEqual(contexts.map(x=>x.role),['ACCOUNTANT','CLERK','DIRECTOR']);
  assert.ok(contexts.every(x=>x.wardCode===''));
  database.close();
});

test('existing patient discount automatically recalculates the bill', () => {
  const {database,userId,patientKey}=setup();
  addCharge(database,patientKey,{description:'Bed service',quantity:2,unitAmount:100000,currency:'KHR'},userId);
  existingDiscount(database,patientKey,{paymentType:'DISCOUNT',discountPercent:25},userId);
  addPayment(database,patientKey,{source:'CASH',amount:50000,currency:'KHR'},userId);
  const bill=patientBill(database,patientKey);
  assert.equal(bill.summary.KHR.gross,200000);
  assert.equal(bill.summary.KHR.discount,50000);
  assert.equal(bill.summary.KHR.patientDue,150000);
  assert.equal(bill.summary.KHR.paid,50000);
  assert.equal(bill.summary.KHR.balance,100000);
  database.close();
});

test('new services after a settled invoice are charged on a separate invoice',()=>{
  const {database,userId,patientKey}=setup();
  addCharge(database,patientKey,{description:'First service',quantity:1,unitAmount:20000,currency:'KHR'},userId);
  const first=patientBill(database,patientKey);
  addPayment(database,patientKey,{source:'CASH',amount:20000,currency:'KHR',invoiceId:first.invoice.id},userId);
  const settled=patientBill(database,patientKey,first.invoice.id);
  assert.equal(settled.summary.KHR.balance,0);
  addCharge(database,patientKey,{description:'Additional service',quantity:1,unitAmount:15000,currency:'KHR'},userId);
  const second=patientBill(database,patientKey);
  assert.notEqual(second.invoice.id,first.invoice.id);
  assert.equal(second.summary.KHR.gross,15000);
  assert.equal(second.summary.KHR.paid,0);
  assert.equal(second.summary.KHR.balance,15000);
  assert.equal(patientBill(database,patientKey,first.invoice.id).summary.KHR.gross,20000);
  assert.equal(patientBill(database,patientKey,first.invoice.id).summary.KHR.paid,20000);
  assert.equal(listPatientInvoices(database,patientKey).length,2);
  const register=financePatientSearch(database,'C-100',{view:'register'})[0];
  assert.equal(register.paymentStatus.code,'NOT_PAID');
  assert.equal(register.paymentDate,null,'a new unpaid invoice must not inherit an old invoice payment date');
  database.close();
});

test('cashier queue includes only an outstanding invoice explicitly sent by the ward',()=>{
  const {database,userId,patientKey}=setup();
  addCharge(database,patientKey,{description:'OPD consultation',quantity:1,unitAmount:20000,currency:'KHR'},userId);
  const invoice=patientBill(database,patientKey).invoice;
  database.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?')
    .run(JSON.stringify({'system:opdConsultedAt':Date.now(),'system:workflowStage':'IN_CONSULTATION'}),patientKey);
  assert.equal(financePatientSearch(database,'C-100',{view:'queue'}).length,0,'being in consultation alone is not a Cashier handoff');
  database.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?')
    .run(JSON.stringify({'system:cashierQueueRequest':{invoiceId:invoice.id,sentAt:Date.now(),source:'WARD'}}),patientKey);
  assert.equal(financePatientSearch(database,'C-100',{view:'queue'}).length,1,'the explicit handoff adds the current unpaid invoice to Cashier');
  database.close();
});

test('v14.1 preserves existing direct adjustments and third-party coverage', async () => {
  const {database,userId,patientKey}=setup();
  const finance = await import('../server/finance.mjs');
  addCharge(database,patientKey,{description:'OPD and paraclinic',quantity:1,unitAmount:100000,currency:'KHR'},userId);

  let profile=existingDiscount(database,patientKey,{paymentType:'DIRECT',paymentSubtype:'DISCOUNT',discountPercent:20},userId);
  assert.equal(profile.paymentSubtype,'DISCOUNT');
  let bill=patientBill(database,patientKey);
  assert.equal(bill.summary.KHR.discount,20000);
  assert.equal(bill.summary.KHR.patientDue,80000);

  existingDiscount(database,patientKey,{paymentType:'DIRECT',paymentSubtype:'PARTIAL_WAIVER',discountPercent:35},userId);
  bill=patientBill(database,patientKey);
  assert.equal(bill.summary.KHR.waived,35000);
  assert.equal(bill.summary.KHR.patientDue,65000);

  const approvedWaiver=requestConcession(database,{patientKey,invoiceId:patientBill(database,patientKey).invoice.id,reason:'Cannot afford care'},{role:'ADMIN',userId});reviewConcession(database,approvedWaiver.id,{approved:true},{role:'ADMIN',userId});
  setFinanceProfile(database,patientKey,{paymentType:'DIRECT',paymentSubtype:'FULL_WAIVER',approvalId:approvedWaiver.id},userId);
  assert.equal(patientBill(database,patientKey).summary.KHR.patientDue,0);
  assert.equal(finance.paymentStatusForPatient(database,patientKey).code,'FULL_WAIVER');

  for (const paymentType of ['NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL','HEF_POOR','HEF_VULNERABLE']) {
    setFinanceProfile(database,patientKey,{paymentType},userId);
    bill=patientBill(database,patientKey);
    assert.equal(bill.summary.KHR.patientDue,0);
    assert.equal(bill.summary.KHR.payerDue,100000);
  }
  database.close();
});

test('v14.3 preserves existing fixed discounts only to direct cash payments', () => {
  const {database,userId,patientKey}=setup();
  addCharge(database,patientKey,{description:'OPD services',quantity:1,unitAmount:100000,currency:'KHR'},userId);

  let profile=existingDiscount(database,patientKey,{paymentType:'DIRECT',paymentSubtype:'DISCOUNT',discountAmount:25000,discountCurrency:'KHR'},userId);
  let bill=patientBill(database,patientKey);
  assert.equal(profile.discountAmount,25000);
  assert.equal(bill.summary.KHR.discount,25000);
  assert.equal(bill.summary.KHR.patientDue,75000);

  profile=setFinanceProfile(database,patientKey,{paymentType:'NSSF_WORKER',paymentSubtype:'DISCOUNT',discountAmount:25000,discountCurrency:'KHR'},userId);
  bill=patientBill(database,patientKey);
  assert.equal(profile.paymentSubtype,'');
  assert.equal(profile.discountAmount,0);
  assert.equal(bill.summary.KHR.discount,0);
  assert.equal(bill.summary.KHR.patientDue,0);
  assert.equal(bill.summary.KHR.payerDue,100000);
  database.close();
});

test('cashflow calendar aggregates daily income and expenses', () => {
  const {database,userId,patientKey}=setup();
  const when=new Date(2026,8,15,10,30).getTime();
  addPayment(database,patientKey,{source:'CASH',amount:120000,currency:'KHR',receivedAt:when},userId,when);
  addExpense(database,{category:'Supplies',description:'Gloves',amount:20000,currency:'KHR',spentAt:when},userId,when);
  addPayment(database,patientKey,{source:'CASH',amount:10,currency:'USD',receivedAt:when},userId,when);
  const dashboard=cashflowMonth(database,'2026-09');
  assert.equal(dashboard.totals.income.KHR,120000);
  assert.equal(dashboard.totals.expense.KHR,20000);
  assert.equal(dashboard.totals.net.KHR,100000);
  assert.equal(dashboard.totals.income.USD,10);
  assert.equal(dashboard.days[0].date,'2026-09-15');
  database.close();
});

test('payment status supports not-yet-paid and the two HEF card types', async () => {
  const {database,userId,patientKey}=setup();
  const finance = await import('../server/finance.mjs');
  assert.equal(finance.paymentStatusForPatient(database,patientKey).code,'NOT_PAID');
  setFinanceProfile(database,patientKey,{paymentType:'HEF',hefType:'VULNERABLE'},userId);
  database.sqlite.prepare('UPDATE patient_finance_profiles SET coverage_required=0 WHERE patient_key=?').run(patientKey);
  const vulnerable=finance.paymentStatusForPatient(database,patientKey);
  assert.equal(vulnerable.code,'HEF_VULNERABLE');
  assert.equal(vulnerable.labelKh,'បណ្ណងាយរងហានីភ័យ');
  setFinanceProfile(database,patientKey,{paymentType:'HEF',hefType:'EQUITY'},userId);
  database.sqlite.prepare('UPDATE patient_finance_profiles SET coverage_required=0 WHERE patient_key=?').run(patientKey);
  assert.equal(finance.paymentStatusForPatient(database,patientKey).code,'HEF_EQUITY');
  database.close();
});

test('ambulance referral receipts are tracked separately from normal patient-care income', async () => {
  const {database,userId,patientKey}=setup();
  const finance = await import('../server/finance.mjs');
  const when=new Date(2026,8,15,16,0).getTime();
  addPayment(database,patientKey,{source:'CASH',purpose:'PATIENT_CARE',amount:50000,currency:'KHR',receivedAt:when},userId,when);
  addPayment(database,patientKey,{source:'CASH',purpose:'AMBULANCE_REFERRAL',amount:80000,currency:'KHR',receivedAt:when},userId,when);
  const start=new Date(2026,8,15,0,0).getTime(), end=new Date(2026,8,16,0,0).getTime();
  assert.equal(finance.ambulanceReferralIncome(database,start,end).KHR,80000);
  database.close();
});

test('daily hospital report summarizes admissions, ward census, transfers, payment status and ambulance income', async () => {
  const {database,userId,patientKey}=setup();
  const { ensureDailyReportSchema, recordMovement, recordBedAssignment, dailyHospitalReport } = await import('../server/daily-report.mjs');
  ensureDailyReportSchema(database);
  // The seeded admission for the setup patient is on 2026-09-15. Refine it to medicine with a bed assignment.
  const base=new Date(2026,8,15,8,0).getTime();
  recordBedAssignment(database,{patientKey,toWardCode:'medicine',toDepartmentCode:'medicine',eventAt:base,createdBy:userId,details:{}});
  setFinanceProfile(database,patientKey,{paymentType:'NSSF_WORKER'},userId,base); // Existing legacy coverage remains readable.
  addPayment(database,patientKey,{source:'CASH',purpose:'AMBULANCE_REFERRAL',amount:40000,currency:'KHR',receivedAt:base},userId,base);
  recordMovement(database,{patientKey,eventType:'INTERNAL_TRANSFER',fromWardCode:'medicine',toWardCode:'surgery',fromDepartmentCode:'medicine',toDepartmentCode:'surgery',eventAt:base+3600000,createdBy:userId});
  recordBedAssignment(database,{patientKey,toWardCode:'surgery',toDepartmentCode:'surgery',eventAt:base+7200000,createdBy:userId,details:{transferAssignment:true}});
  recordMovement(database,{patientKey,eventType:'EXTERNAL_TRANSFER',fromWardCode:'surgery',fromDepartmentCode:'surgery',eventAt:base+10800000,createdBy:userId,details:{referralDestinationType:'PROVINCIAL_HOSPITAL'}});
  const report=dailyHospitalReport(database,'2026-09-15');
  assert.equal(report.totalAdmissions,1);
  assert.equal(report.internalTransfers,1);
  assert.equal(report.externalProvincialTransfers,1);
  assert.equal(report.paymentStatus.nssf,1);
  assert.equal(report.ambulanceReferralIncome.KHR,40000);
  assert.ok(report.wards.some(row=>row.code==='medicine' && row.newAdmissions===1));
  database.close();
});


test('hospital service catalog provides cashier choices and configurable default prices', () => {
  const {database,userId,patientKey}=setup();
  const initial=serviceCatalog(database);
  assert.ok(initial.some(item=>item.code==='OPD_CONSULT'));
  const updated=setServiceCatalogItem(database,{code:'OPD_CONSULT',categoryCode:'CONSULTATION',nameKh:'ពិគ្រោះក្រៅ',nameEn:'OPD consultation',defaultAmount:15000,currency:'KHR',active:true});
  assert.equal(updated.defaultAmount,15000);
  const charge=addCharge(database,patientKey,{serviceCode:'OPD_CONSULT',quantity:2,currency:'KHR'},userId);
  assert.equal(charge.amount,30000);
  assert.equal(charge.serviceCode,'OPD_CONSULT');
  database.close();
});

test('cashier payments receive a unique receipt number attached to the patient bill', () => {
  const {database,userId,patientKey}=setup();
  const when=new Date(2026,8,15,12,0).getTime();
  const first=addPayment(database,patientKey,{source:'CASH',amount:10000,currency:'KHR',receivedAt:when},userId,when);
  const second=addPayment(database,patientKey,{source:'CASH',amount:20000,currency:'KHR',receivedAt:when+1000},userId,when+1000);
  assert.match(first.receiptNo,/^RCPT-20260915-\d{4}$/);
  assert.notEqual(first.receiptNo,second.receiptNo);
  const bill=patientBill(database,patientKey);
  assert.equal(bill.payments.length,2);
  assert.ok(bill.payments.every(item=>item.receiptNo));
  database.close();
});


test('monthly service revenue groups actual receipts by department and service including ambulance', () => {
  const {database,userId,patientKey}=setup();
  const when=new Date(2026,8,20,10,0).getTime();
  addPayment(database,patientKey,{source:'CASH',serviceCode:'OPD_CONSULT',amount:30000,currency:'KHR',receivedAt:when},userId,when);
  addPayment(database,patientKey,{source:'CASH',serviceCode:'AMBULANCE_REFERRAL',purpose:'AMBULANCE_REFERRAL',amount:80000,currency:'KHR',receivedAt:when+1000},userId,when+1000);
  addPayment(database,patientKey,{source:'CASH',amount:5,currency:'USD',receivedAt:when+2000},userId,when+2000);
  const report=monthlyServiceRevenue(database,'2026-09');
  assert.equal(report.totals.KHR,110000);
  assert.equal(report.totals.USD,5);
  assert.equal(report.ambulance.KHR,80000);
  assert.equal(report.categories.find(x=>x.code==='CONSULTATION').totals.KHR,30000);
  assert.equal(report.services.find(x=>x.serviceCode==='AMBULANCE_REFERRAL').totals.KHR,80000);
  assert.equal(report.categories.find(x=>x.code==='GENERAL').totals.USD,5);
  database.close();
});


test('cash profile is not marked paid until recorded receipts settle the full patient balance', async () => {
  const {database,userId,patientKey}=setup();
  const finance = await import('../server/finance.mjs');
  setFinanceProfile(database,patientKey,{paymentType:'CASH'},userId);
  addCharge(database,patientKey,{description:'Consultation',quantity:1,unitAmount:100000,currency:'KHR'},userId);
  assert.equal(finance.paymentStatusForPatient(database,patientKey).code,'NOT_PAID');
  addPayment(database,patientKey,{source:'CASH',amount:40000,currency:'KHR'},userId);
  assert.equal(finance.paymentStatusForPatient(database,patientKey).code,'PARTIAL');
  addPayment(database,patientKey,{source:'CASH',amount:60000,currency:'KHR'},userId);
  assert.equal(finance.paymentStatusForPatient(database,patientKey).code,'PAID');
  database.close();
});



test('payment records preserve the cashier name for the printed receipt', () => {
  const {database,userId,patientKey}=setup();
  const payment=addPayment(database,patientKey,{source:'CASH',amount:25000,currency:'KHR'},userId);
  assert.equal(payment.receivedByName,'Finance Admin');
  database.sqlite.prepare('UPDATE users SET display_name=? WHERE id=?').run('Renamed Later',userId);
  const bill=patientBill(database,patientKey);
  assert.equal(bill.payments[0].receivedByName,'Finance Admin');
  database.close();
});

test('cashier cannot record a payment with a future received timestamp', () => {
  const {database,userId,patientKey}=setup();
  assert.throws(
    () => addPayment(database,patientKey,{source:'CASH',amount:1000,currency:'KHR',receivedAt:Date.now()+60_000},userId),
    /future/i
  );
  database.close();
});
