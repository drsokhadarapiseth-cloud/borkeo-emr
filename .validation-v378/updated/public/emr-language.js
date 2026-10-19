'use strict';

(function emrLanguageSupport() {
  // Each workspace keeps its own choice; visiting Lab never changes another workspace.
  const view = new URLSearchParams(window.location.search).get('view') || '';
  const STORAGE_KEY = `borkeo-emr-language:${window.location.pathname.replace(/\/$/, '') || '/'}:${view}`;
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const emrPage = path === '/emr';
  const englishOnly = false;
  const englishDisabled = true;
  if (englishDisabled && typeof window !== 'undefined') {
    try {
      localStorage.setItem('borkeo-emr-language', 'kh');
      localStorage.setItem('borkeo-lang', 'kh');
      sessionStorage.setItem(STORAGE_KEY, 'kh');
    } catch {}
  }
  const cashNotice = 'បានបញ្ជូនទៅបញ្ជរបង់ប្រាក់';
  const labFilterPairs = path === '/lab' ? [['បញ្ជីរសំណាកទាំងអស់','Specimen List'],['សំណាកបន្ទាន់','Urgent'],['សំណាកបានទទួល','Received'],['សំណាកមិនទទួល','Rejected'],['បញ្ជីរសំណាកបានពិនិត្យរួច','Complete Test List'],['បញ្ជីរសម្ភារៈ','Material List'],['បញ្ជីសម្ភារៈ','Material List']] : [];
  const manualPairs = [
    ["កែប្រែ", "Edit"],
    ["ការស្នើសុំ", "Requests & Approvals"],
    ["ការស្នើរសុំ", "Requests & Approvals"],
    ["លិខិតអនុញ្ញាតសម្រាកពេទ្យ", "Patient Admission Form"],
    ["លិខិតចេញពីមន្ទីរពេទ្យ", "Patient Discharge Form"],
    ["បណ្ណស្នើសុំឱសថ", "Inpatient Medicine Request"],
    ["បណ្ណស្នើរសុំឱសថ", "Inpatient Medicine Request"],
    ["ស្នើសុំលើកលែងសេវា", "Fee Concession Request"],
    ["ស្នើលើកលែងសេវា", "Fee Concession Request"],
    ["ស្នើរសុំលើកលែងសេវា", "Fee Concession Request"],
    ["រង់ចាំ", "Pending"],
    ["អនុម័ត", "Approved"],
    ["បដិសេធ", "Rejected"],
    ["បានអនុវត្ត", "Applied"],
    ["កំពុងរៀបចំ", "Preparing"],
    ["មើល", "View"],
    ["មើល និងចុះហត្ថលេខា", "View and Sign"],
    ["មិនមានសំណើ", "No requests"],
    ["មតិកែតម្រូវ", "Correction Feedback"],
    ["មតិកែតម្រូវ:", "Feedback:"],
    ["បោះបង់", "Cancel"],
    ["វិក្កយបត្រ", "Invoice"],
    ["របៀបបញ្ចុះ", "Discount Mode"],
    ["ភាគរយ (100% = ឥតគិតថ្លៃ)", "Percentage (100% = free)"],
    ["ចំនួនទឹកប្រាក់", "Fixed Amount"],
    ["ភាគរយបញ្ចុះតម្លៃ (100 = ឥតគិតថ្លៃ)", "Discount % (100 = free)"],
    ["សេវាដែលស្នើ", "Requested Services"],
    ["មូលហេតុ", "Reason"],
    ["មូលហេតុ:", "Reason:"],
    ["ផ្ញើសំណើ", "Submit Request"],
    ["ទ្រីយ៉ា", "Triage"],
    ["ការចូលសម្រាក", "Patient Admission"],
    ["កំណត់ត្រាវេជ្ជសាស្ត្រ", "Medical Record"],
    ["ការថែទាំ", "Nursing Care"],
    ["លិខិតចេញ", "Discharge Letter"],
    ["មើលទិន្នន័យ", "Read-only"],
    ["ថយក្រោយ", "Previous"],
    ["បន្ទាប់", "Next"],
    ["តម្លៃដើម", "Original Price"],
    ["តម្លៃលើកលែង", "Concession Amount"],
    ["អនុម័ត និងចុះហត្ថលេខា", "Approve & Sign"],
    ["កែលិខិតចេញ និងផ្ញើឡើងវិញ", "Correct Discharge Letter & Resubmit"],
    ["កែសំណើសេវា", "Correct Fee Request"],
    ["កែតម្រូវទម្រង់", "Correct Form"],
    ["ផ្ញើស្នើឡើងវិញ", "Resubmit"],
    ["អនុវត្តការលើកលែង", "Apply Concession"],
    ["បិទ", "Close"],
    ["ប្រវត្តិការអនុម័ត", "Review History"],
    ["កែលិខិតចេញ", "Correct Discharge Letter"],
    ["អ្នកជំងឺនៅតែចេញពីមន្ទីរពេទ្យ និងគ្រែនៅតែទំនេរ។", "The patient remains discharged and the bed stays free."],
    ["រោគវិនិច្ឆ័យពេលចេញ", "Discharge Diagnosis"],
    ["លទ្ធផល", "Outcome"],
    ["ថ្ងៃណាត់ជួប", "Follow-up Date"],
    ["កែ និងផ្ញើឡើងវិញ", "Correct & Resubmit"],
    ["មិនមានសេវា", "No services"],
    ["ការបញ្ជូនពី OPD", "OPD Referral"],
    ["ឱសថដំបូង", "Initial Medicines"],
    ["វេជ្ជបញ្ជាប្រចាំថ្ងៃ", "Daily Prescriptions"],
    ["តាមដានប្រចាំថ្ងៃ", "Daily Follow-up"],
    ["មិនទាន់មានទិន្នន័យ", "No data yet"],
    ["សូមបញ្ចូលមូលហេតុ", "A reason is required."],
    ["ជ្រើសរើសសេវា", "Select services."],
    ["សម្ពាធឈាមលើ", "Systolic BP"],
    ["សម្ពាធឈាមក្រោម", "Diastolic BP"],
    ["ពេលចេញ", "Discharge Time"],
    ["បញ្ជីរសំណាកទាំងអស់", "Specimen List"],
    ["បញ្ជីសំណាក", "Specimen List"],
    ["បញ្ជីរសម្ភារៈ", "Material List"],
    ["បញ្ជីសម្ភារៈ", "Material List"],
    ["បញ្ជីសម្ភារៈមន្ទីរពិសោធន៍", "Laboratory Material List"],
    ["បញ្ជីឱសថ", "Medicine List"],
    ["មុខទំនិញសរុប", "Total Items"],
    ["ស្តុកសរុប", "Total Stock"],
    ["ស្តុកតិច ឬអស់", "Low & Out of Stock"],
    ["ស្តុកតិច/អស់", "Low & Out of Stock"],
    ["បន្ថែមមុខស្តុកថ្មី", "Add Stock Item"],
    ["បង្កើតទំនិញថ្មី និងកំណត់ស្តុកដំបូង", "Create new item and initial stock"],
    ["ឈ្មោះទំនិញ", "Item Name"],
    ["ឈ្មោះទំនិញ *", "Item Name *"],
    ["ឯកតា", "Unit"],
    ["ឯកតា *", "Unit *"],
    ["ស្តុកដំបូង", "Opening Stock"],
    ["ស្តុកដំបូង *", "Opening Stock *"],
    ["កូដតេស្តភ្ជាប់", "Linked Test Code"],
    ["មិនភ្ជាប់", "Not linked"],
    ["ប្រើក្នុងមួយតេស្ត", "Used Per Test"],
    ["ប្រើក្នុងមួយតេស្ត *", "Used Per Test *"],
    ["បន្ថែមមុខទំនិញ", "Add Item"],
    ["ទទួល និងកត់ត្រាការប្រើ", "Stock Movement"],
    ["ទទួលបន្ថែម (+) ឬកត់ត្រាការប្រើប្រាស់ (-)", "Receive stock (+) or record usage (-)"],
    ["ជ្រើសរើសមុខស្តុក", "Select Stock Item"],
    ["ជ្រើសរើសមុខស្តុក *", "Select Stock Item *"],
    ["-- ជ្រើសរើសមុខស្តុក --", "-- Select Stock Item --"],
    ["ចំនួន", "Quantity"],
    ["ចំនួន *", "Quantity *"],
    ["លេខយោងការប្រើ", "Usage Reference"],
    ["＋ ទទួលស្តុក", "＋ Receive Stock"],
    ["－ កត់ត្រាការប្រើ", "－ Record Usage"],
    ["ទទួលស្តុក", "Receive Stock"],
    ["កត់ត្រាការប្រើ", "Record Usage"],
    ["បញ្ជីទំនិញក្នុងស្តុក", "Current Inventory"],
    ["ទាំងអស់", "All"],
    ["ស្តុកតិច (≤10)", "Low Stock (≤10)"],
    ["អស់ពីស្តុក (0)", "Out of Stock (0)"],
    ["ស្តុកនៅសល់", "Available Stock"],
    ["កូដតេស្ត", "Test Code"],
    ["សកម្មភាព", "Action"],
    ["ជ្រើសរើស", "Select"],
    ["ប្រវត្តិប្រតិបត្តិការស្តុក", "Movement History"],
    ["កាលបរិច្ឆេទ", "Date & Time"],
    ["ចំនួនប្រែប្រួល", "Change (Delta)"],
    ["ប្រភព ឬលេខយោង", "Reference"],
    ["មិនមានទិន្នន័យស្តុកបង្ហាញ", "No matching stock items"],
    ["មិនទាន់មានប្រវត្តិប្រតិបត្តិការ", "No movement history"],
    ["បានរក្សាទុកដោយជោគជ័យ", "Saved successfully"],
    ["វេជ្ជបណ្ឌិតស្នើពិនិត្យ", "Requesting doctor"],
    ["មន្ទីរពិសោធន៍ទទួលអ្នកជំងឺ", "Laboratory receives patient"],
    ["មន្ទីរពិសោធន៍ប្រមូលសំណាក", "Laboratory collects specimen"],
    ["បានបញ្ជូនលទ្ធផលទៅវេជ្ជបណ្ឌិត OPD", "Results sent to doctor OPD"],
    ["ស្នើដោយ", "Ordered by"],
    ["គ្រែ", "Bed"],
    ["ពិនិត្យសុវត្ថិភាព", "Safety Review"],
    ["មានផ្ទៃពោះ ឬអាចមានផ្ទៃពោះ", "Pregnant or possibly pregnant"],
    ["ប្រវត្តិអាលែកស៊ីសារធាតុ contrast", "History of contrast allergy"],
    ["ហានិភ័យតម្រងនោម៖ ពិនិត្យមុខងារតម្រងនោម", "Renal risk; check kidney function"],
    ["មានឧបករណ៍ Pacemaker ឬ ICD", "Pacemaker or ICD present"],
    ["មានលោហៈបង្កប់ ឬវត្ថុបរទេស", "Metal implant or foreign body present"],
    ["ការពិនិត្យ", "Examination"],
    ["ទិសថត", "Projection"],
    ["សារធាតុ contrast", "Contrast"],
    ["មូលហេតុពិនិត្យ", "Clinical Indication"],
    ["ប្រវត្តិពាក់ព័ន្ធ", "Relevant History"],
    ["សំណួរជាក់លាក់", "Specific Question"],
    ["ប្រភេទគិតថ្លៃ", "Charge Mode"],
    ["ស្ថានភាពមានផ្ទៃពោះ", "Pregnancy Status"],
    ["អាលែកស៊ីសារធាតុ contrast", "Allergy to contrast"],
    ["ព័ត៌មានអាលែកស៊ី", "Allergy Details"],
    ["ហានិភ័យតម្រងនោម", "Renal Risk"],
    ["Creatinine ចុងក្រោយ", "Latest Creatinine"],
    ["eGFR ចុងក្រោយ", "Latest eGFR"],
    ["ឧបករណ៍ Pacemaker/ICD", "Pacemaker/ICD"],
    ["លោហៈបង្កប់ ឬវត្ថុបរទេស", "Metal Implant or Foreign Body"],
    ["ព័ត៌មានលោហៈបង្កប់", "Metal Implant Details"],
    ["ការភ័យកន្លែងចង្អៀត", "Claustrophobia"],
    ["ពិចារណាថ្នាំបំបាត់អារម្មណ៍", "Consider Sedation"],
    ["រដូវចុងក្រោយ", "Last Menstrual Period"],
    ["អាយុគភ៌", "Gestational Age"],
    ["ការរៀបចំ ឬការណែនាំពិសេស", "Preparation or Special Instructions"],
    ["ពេលបានកំណត់", "Scheduled Time"],
    ["ដំណើរការមន្ទីរពិសោធន៍ផ្ទាល់ពី OPD៖", "OPD direct laboratory workflow:"],
    ["អ្នកជំងឺមកមន្ទីរពិសោធន៍ផ្ទាល់។ អ្នកបច្ចេកទេសប្រមូលសំណាក ពិនិត្យ និងបញ្ចូលលទ្ធផលនៅទីនេះ។", "Patient comes directly to the laboratory. The laboratory technician collects the specimen here, performs the test, and enters the result."],

    ["បញ្ជីឱសថ", "Medicine List"], ["បញ្ជីសម្ភារៈមន្ទីរពិសោធន៍", "Laboratory Material List"],
    ["ស្ថានភាពទាំងអស់", "All Statuses"],
    ["បានកំណត់ពេល", "Scheduled"],
    ["បានពិនិត្យ", "Performed"],
    ["បានរាយការណ៍", "Reported"],
    ["កំពុងរៀបចំរបាយការណ៍", "Report in Progress"],
    ["បានបញ្ជូនលទ្ធផល", "Result Sent"],
    ["ធម្មតា", "Routine"],
    ["ស្វែងរកអ្នកជំងឺ លេខករណី ឬតេស្ត", "Search patients, case numbers, or tests"],
    ["ស្វែងរកអ្នកជំងឺ ឬការពិនិត្យ", "Search patients or examinations"],
    ["គ្រប់គ្រងបញ្ជីតេស្ត", "Manage Test Catalog"],
    ["បញ្ជីសំណើពិនិត្យមន្ទីរពិសោធន៍", "Laboratory Orders"],
    ["ជ្រើសរើសសំណើដើម្បីបញ្ចូលលទ្ធផល", "Select an order to enter results"],
    ["បញ្ចូលលទ្ធផល ដំណើរការ និងឯកសារភ្ជាប់", "Enter results, workflow, and attachments"],
    ["ជ្រើសរើសសំណើមន្ទីរពិសោធន៍", "Select a Laboratory Order"],
    ["មិនមានសំណើមន្ទីរពិសោធន៍។", "No laboratory orders."],
    ["បញ្ជីសំណើពិនិត្យរូបភាពវេជ្ជសាស្ត្រ", "Imaging Orders"],
    ["ជ្រើសរើសសំណើដើម្បីបំពេញការពិនិត្យ", "Select an order to complete the examination"],
    ["របាយការណ៍ និងព័ត៌មានលម្អិត", "Report and Details"],
    ["សំណើពិនិត្យ សុវត្ថិភាព របាយការណ៍ និងឯកសារភ្ជាប់", "Exam request, safety, report, and attachments"],
    ["ជ្រើសរើសសំណើពិនិត្យរូបភាព", "Select an Imaging Request"],
    ["ជ្រើសរើសសំណើពិនិត្យរូបភាព។", "Select an imaging order."],
    ["មិនមានសំណើពិនិត្យរូបភាព។", "No imaging orders."],
    ["វេជ្ជបណ្ឌិត / OPD បានស្នើមន្ទីរពិសោធន៍", "Ordered by doctor / OPD to Laboratory"],
    ["ផ្នែកបានទទួល", "Received by ward"],
    ["បានប្រមូលសំណាក", "Specimen collected"],
    ["បានបញ្ជូនទៅមន្ទីរពិសោធន៍", "Sent to Laboratory"],
    ["មន្ទីរពិសោធន៍បានទទួល", "Received by Laboratory"],
    ["កំពុងពិនិត្យសំណាក", "Testing in progress"],
    ["បានបញ្ជូនលទ្ធផលទៅផ្នែក", "Results sent to ward"],
    ["ផ្នែកបានមើល", "Viewed by ward"],
    ["សំណាកមិនទទួល", "Specimen rejected"],
    ["បានបោះបង់", "Cancelled"],
    ["លទ្ធផលបន្ទាន់", "Critical Result"],
    ["បន្ទាន់", "Critical"],
    ["មិនគិតថ្លៃ", "Free of charge"],
    ["បានបង់ប្រាក់នៅបេឡា", "Paid at Cashier"],
    ["តេស្តបានស្នើតាមក្រុម", "Ordered Tests by Group"],
    ["តេស្ត", "Test"],
    ["ឯកតា", "Unit"],
    ["ចន្លោះតម្លៃយោង", "Reference Interval"],
    ["សញ្ញា", "Flag"],
    ["លទ្ធផលគុណភាព", "Qualitative result"],
    ["មិនមានលទ្ធផលតេស្ត។", "No test results."],
    ["ទទួលសំណាក", "Receive Specimen"],
    ["មិនទទួលសំណាក", "Reject Specimen"],
    ["រក្សាទុកព្រាង", "Save Draft"],
    ["ចាប់ផ្ដើមពិនិត្យ និងរក្សាទុកព្រាង", "Start Testing and Save Draft"],
    ["ផ្ទៀងផ្ទាត់លទ្ធផល និងបញ្ជូនទៅវេជ្ជបណ្ឌិត OPD", "Verify Result and Send to Doctor OPD"],
    ["ផ្ទៀងផ្ទាត់ និងបញ្ជូនទៅផ្នែក", "Verify and Send to Ward"],
    ["កំណត់ពេល", "Schedule"],
    ["សម្គាល់ថាបានពិនិត្យ", "Mark Performed"],
    ["ផ្ទៀងផ្ទាត់ និងបញ្ជូនរបាយការណ៍", "Verify and Release Report"],
    ["លទ្ធផលពិនិត្យ", "Findings"],
    ["សេចក្ដីសន្និដ្ឋាន", "Impression"],
    ["អនុសាសន៍", "Recommendation"],
    ["រូបភាព និងរបាយការណ៍", "Images and Reports"],
    ["ឯកសារភ្ជាប់", "Attachments"],
    ["មិនមានឯកសារភ្ជាប់។", "No attachments."],
    ["ភ្ជាប់ឯកសារ", "Attach Files"],
    ["គ្រប់គ្រងបញ្ជីតេស្តមន្ទីរពិសោធន៍", "Manage Laboratory Test Catalog"],
    ["កំណត់តេស្ត ចន្លោះតម្លៃយោង និងឯកតាដែលមន្ទីរពេទ្យបានផ្ទៀងផ្ទាត់។", "Configure tests, reference intervals and units validated by the hospital."],
    ["ស្វែងរកតេស្ត កូដ ឬក្រុម", "Search tests, codes or categories"],
    ["តេស្តថ្មី", "New Test"],
    ["កូដតេស្ត", "Test Code"],
    ["ឈ្មោះតេស្ត", "Test Name"],
    ["ក្រុម", "Category"],
    ["កូដ LOINC", "LOINC Code"],
    ["ឯកតាគោល", "Base Unit"],
    ["តម្លៃយោងទាប", "Reference Low"],
    ["តម្លៃយោងខ្ពស់", "Reference High"],
    ["តម្លៃប្រកាសអាសន្នទាប", "Critical Low"],
    ["តម្លៃប្រកាសអាសន្នខ្ពស់", "Critical High"],
    ["តម្លៃបន្ទាន់ទាប", "Critical Low"],
    ["តម្លៃបន្ទាន់ខ្ពស់", "Critical High"],
    ["ឯកតាអនុញ្ញាត និងការបម្លែងទៅឯកតាគោល", "Allowed Units and Conversion to Base Unit"],
    ["(មួយបន្ទាត់៖ ឯកតា | មេគុណ | តម្លៃបន្ថែម)", "(One line: unit | factor | offset)"],
    ["កំណត់សម្គាល់យោង", "Reference Note"],
    ["សកម្ម និងអាចស្នើពិនិត្យបាន", "Active and available to order"],
    ["រក្សាទុកតេស្ត", "Save Test"],
    ["រកមិនឃើញតេស្ត។", "No tests found."],
    ["បន្ថែមថ្លៃមន្ទីរពិសោធន៍", "Add an extra Laboratory fee"],
    ["បន្ថែមថ្លៃរូបភាពវេជ្ជសាស្ត្រ", "Add an extra Imaging fee"],
    ["បន្ថែមថ្លៃ", "Add fee"],
    ["ជ្រើសរើសថ្លៃមន្ទីរពិសោធន៍សកម្ម…", "Choose an active lab fee…"],
    ["ជ្រើសរើសថ្លៃរូបភាពវេជ្ជសាស្ត្រសកម្ម…", "Choose an active imaging fee…"],
    ["បន្ថែមថ្លៃបានជ្រើសទៅវិក្កយបត្រ IPD និងជូនដំណឹងគិលានុបដ្ឋាកផ្នែក។", "This adds the selected fee to the active IPD invoice and alerts the ward nurse."],
    ["ត្រូវពិនិត្យសុវត្ថិភាព៖", "Safety Review Required:"],
    ["សំណាកមិនទទួល៖", "Specimen rejected:"],
    ["ផ្នែកបានមើល៖", "Seen by ward:"],
    ["លទ្ធផលមន្ទីរពិសោធន៍បន្ទាន់។", "Critical laboratory results."],
    ["រង់ចាំវេជ្ជបណ្ឌិតទទួលស្គាល់។", "Awaiting doctor acknowledgement."],
    ["ចន្លោះតម្លៃយោងអាចកែតម្រូវបាន។ មន្ទីរពិសោធន៍ត្រូវផ្ទៀងផ្ទាត់តាមឧបករណ៍ វិធីសាស្ត្រ និងគោលការណ៍មន្ទីរពេទ្យមុនប្រើប្រាស់។", "Reference intervals may be adjusted. The laboratory must validate them against its equipment, methods and hospital policy before use."],
    ["មានលទ្ធផលមិនទាន់រក្សាទុក។ បោះបង់ការកែប្រែទាំងនេះ?", "There are unsaved results. Discard these changes?"],
    ["ការផ្ទុកឡើងវិញនឹងបោះបង់លទ្ធផលមិនទាន់រក្សាទុក។ បន្ត?", "Refreshing now will discard unsaved results. Continue?"],
    ["ការផ្ទុកស្វ័យប្រវត្តិបានផ្អាកពេលកែសម្រួលលទ្ធផល។ សូមរក្សាទុកព្រាង ឬបញ្ជូនរបាយការណ៍ជាមុន។", "Automatic refresh is paused while results are being edited. Save a draft or release the report first."],

    ['ការជូនដំណឹងបេឡា', 'Cashier Alerts'],
    ['សំណើបង់ប្រាក់ពីផ្នែក', 'Payment Request from Department'],
    ['បើកវិក្កយបត្រ', 'Open Invoice'],
    ['សំណើកែវិក្កយបត្រ', 'Invoice Correction Request'],
    ['រង់ចាំការអនុម័ត', 'Awaiting Approval'],
    ['បានអនុម័ត', 'Approved'],
    ['មិនអនុម័ត', 'Rejected'],
    ['បានកែរួច', 'Correction Applied'],
    ['ត្រូវស្នើឡើងវិញ', 'New Request Required'],
    ['ព័ត៌មានលម្អិតវិក្កយបត្រ', 'Invoice Details'],
    ['អនុម័តការកែ', 'Approve Correction'],
    ['បដិសេធការកែ', 'Reject Correction'],
    ['មិនមានការជូនដំណឹងបេឡាទេ។', 'No Cashier alerts.'],
    ['បញ្ជីវិក្កយបត្ររបស់អ្នកជំងឺ', 'Patient Invoice History'],
    ['មើលវិក្កយបត្រ', 'View Invoices'],
    ['ស្នើកែវិក្កយបត្រ', 'Request Invoice Correction'],
    ['កែវិក្កយបត្រដែលបានអនុម័ត', 'Edit Approved Invoice'],
    ['មូលហេតុនៃការកែ', 'Correction Reason'],
    ['ផ្ញើសំណើកែ', 'Send Correction Request'],
    ['រក្សាទុកការកែវិក្កយបត្រ', 'Save Invoice Correction'],
    ['ថ្ងៃបង់ប្រាក់ចុងក្រោយ:', 'Latest Payment Date:'],
    ['លើសបង់', 'Overpayment'],

    ['ជ្រើសរើសបញ្ជរ', 'Choose Counter'], ['ជ្រើសរើស Counter របស់អ្នក', 'Choose Your Counter'],
    ['បោះពុម្ពបង្កាន់ដៃសរុប', 'Print Combined Receipt'],
    ['វិក្កយបត្រថ្មី', 'New invoice'],
    ['បញ្ចូលតែវិក្កយបត្រដែលមានថ្ងៃបញ្ចូលដូចគ្នា', 'Include only invoices with the same entry date'],
    ['ថ្ងៃបញ្ចូលវិក្កយបត្រ', 'Invoice Entry Date'],
    ['ភាសាអត្ថបទធម្មតា:', 'Normal text language:'],
    ['បំពេញអត្ថបទធម្មតាតាមភាសាដែលបានជ្រើស។ សូមពិនិត្យ និងកែតម្រូវតាមលទ្ធផលដែលបានពិនិត្យពិត។', 'Fill normal text in the selected language. Review and edit it to match the actual examination findings.'],
    ['ប្រព័ន្ធកំណត់ត្រាវេជ្ជសាស្ត្រអេឡិចត្រូនិក', 'Electronic Medical Record System'],
    ['ចូលគណនី', 'Sign In'], ['ចូលប្រើប្រាស់ប្រព័ន្ធ', 'Sign In to the System'],
    ['ឈ្មោះអ្នកប្រើប្រាស់', 'Username'], ['ពាក្យសម្ងាត់', 'Password'],
    ['បង្ហាញពាក្យសម្ងាត់', 'Show Password'], ['សាកល្បង · Localhost', 'Demo · Localhost'],
    ['ព័ត៌មានប្រព័ន្ធ', 'System Information'], ['គណនីសាកល្បងចូលបានដោយគ្មានពាក្យសម្ងាត់។ ប្រើតែទិន្នន័យសាកល្បងប៉ុណ្ណោះ។', 'Demo accounts sign in without passwords. Use demo data only.'],
    ['មន្ទីរពេទ្យបង្អែក បរកែវ', 'Borkeo Referral Hospital'],
    ['ឈ្មោះ និងស្លាកសញ្ញាស្ថាប័ន', 'Organization Name and Logo'],
    ['បញ្ជូនទៅផ្នែកទ្រីយ៉ា','Send to Triage'],
    ['ទំព័រដើម', 'Home'], ['ចុះឈ្មោះ', 'Registration'], ['ព័ត៌មានចុះឈ្មោះ', 'Registration Information'],
    ['បញ្ជីអ្នកជំងឺណាត់ជួប', 'Patient Appointment List'], ['ថ្ងៃណាត់ជួប', 'Appointment date'],
    ['ទម្រង់ចុះឈ្មោះអ្នកជំងឺ', 'Patient Registration Form'],
    ['បញ្ជីអ្នកជំងឺ', 'Patient List'], ['អ្នកជំងឺ', 'Patient'], ['ឈ្មោះអ្នកជំងឺ', 'Patient Name'],
    ['ព័ត៌មានអ្នកជំងឺ', 'Patient Information'], ['ភេទ', 'Sex'], ['អាយុ', 'Age'],
    ['ប្រុស', 'Male'], ['ស្រី', 'Female'], ['លេខករណី', 'Case Number'], ['លេខប័ណ្ណសុខភាព', 'Health ID'],
    ['លេខបណ្ណសុខភាព', 'Health ID'], ['លេខទូរស័ព្ទ', 'Phone Number'], ['អាសយដ្ឋាន', 'Address'],
    ['កាលបរិច្ឆេទចូល', 'Entry Date'], ['កាលបរិច្ឆេទចេញ', 'Discharge Date'], ['ពេលវេលា', 'Time'],
    ['ម៉ោង', 'Time'], ['កាលបរិច្ឆេទ', 'Date'], ['ថ្ងៃ ខែ ឆ្នាំ / ពេលវេលា', 'Date and Time'],
    ['សារពីផ្នែកទៅអ្នកគ្រប់គ្រង និងនាយក', 'Department messages to Admin and Director'],
    ['សាររួមសម្រាប់អ្នកគ្រប់គ្រង និងនាយក', 'Shared Admin and Director inbox'],
    ['ប្រវត្តិការបញ្ចប់', 'Completed history'], ['សាររង់ចាំ', 'Pending messages'], ['បញ្ចប់ការងារ', 'Complete task'],
    ['ផ្នែក', 'Department'], ['ផ្នែកទ្រីយ៉ា', 'Triage'], ['បញ្ជីរង់ចាំ OPD', 'OPD Waiting List'],
    ['ពិនិត្យលេខរៀង', 'Queue Display'], ['បង្ហាញលេខរៀង', 'Queue Display'], ['បើកផ្ទាំងលេខរៀង', 'Queue Display'],
    ['បញ្ជូនអ្នកជំងឺទៅ IPD', 'Transfer Patient to IPD'], ['ចែកឱសថ', 'Dispense Medication'],
    ['មន្ទីរពិសោធន៍', 'Laboratory'], ['ផ្នែកមន្ទីរពិសោធន៍', 'Laboratory'],
    ['ផ្នែករូបភាពវេជ្ជសាស្ត្រ', 'Medical Imaging'], ['រូបភាពវេជ្ជសាស្ត្រ', 'Medical Imaging'],
    ['ថ្នាំ', 'Medication'], ['ឱសថ', 'Medication'], ['វេជ្ជបញ្ជា', 'Prescription'],
    ['កំណត់ត្រាវេជ្ជសាស្ត្រ', 'Medical Record'], ['ដំណើរការថែទាំ', 'Nursing Process'],
    ['បញ្ជីរង់ចាំ', 'Waiting List'], ['សេវា', 'Service'], ['ប្រភេទសេវា', 'Service Type'],
    ['គ្រប់គ្រងគណនី', 'Manage Accounts'], ['តួនាទី', 'Role'], ['គណនេយ្យករ', 'Accountant'],
    ['អ្នកគ្រប់គ្រងប្រព័ន្ធ', 'System Administrator'], ['នាយកមន្ទីរពេទ្យ', 'Hospital Director'],
    ['វេជ្ជបណ្ឌិត', 'Doctor'], ['គិលានុបដ្ឋាក', 'Nurse'], ['ឆ្មប', 'Midwife'],
    ['បេឡា', 'Cashier'], ['បង់ប្រាក់', 'Pay'], ['ការទូទាត់', 'Payment'],
    ['បានបង់ប្រាក់', 'Paid'], ['បានទូទាត់', 'Paid'], ['មិនទាន់បង់ប្រាក់', 'Not Yet Paid'],
    ['មិនទាន់បង់', 'Unpaid'], ['រង់ចាំបង់ប្រាក់', 'Awaiting Payment'],
    ['ចំនួនទឹកប្រាក់', 'Amount'], ['ចំនួនទឹកប្រាក់បញ្ចុះ', 'Discount Amount'], ['បញ្ចុះតម្លៃ', 'Discount'],
    ['តម្លៃ', 'Price'], ['តម្លៃរាយ', 'Unit Price'], ['សរុប', 'Total'], ['ចំនួន', 'Quantity'],
    ['រូបិយប័ណ្ណ', 'Currency'], ['ប្រាក់រៀល', 'KHR'], ['ប្រាក់ដុល្លារ', 'USD'],
    ['វិក្កយបត្រ', 'Invoice'], ['វិក្កយបត្របង់ប្រាក់', 'Payment Invoice'],
    ['ប្រវត្តិការទូទាត់', 'Payment History'], ['អ្នកបង់ប្រាក់', 'Payer'],
    ['អ្នកទទួលប្រាក់', 'Cashier'], ['ចំនួនត្រូវបង់', 'Amount Due'], ['ប្រាក់បានបង់', 'Amount Paid'],
    ['កំណត់សម្គាល់', 'Note'], ['ចំណាំ', 'Notes'], ['សេវា', 'Service'], ['សេវាកម្ម', 'Services'],
    ['ផ្នែកជំងឺទូទៅ', 'Medicine Ward'], ['ផ្នែកជំងឺកុមារ', 'Pediatric Ward'],
    ['ផ្នែករោគស្ត្រី និងសម្ភព', 'Gynecology and Maternity'], ['ផ្នែកសង្គ្រោះបន្ទាន់', 'Emergency Ward'],
    ['ផ្នែកវះកាត់', 'Surgery Ward'], ['ផ្នែកសម្ភព', 'Maternity Ward'],
    ['ផែនទីផ្នែក និងការចូលសម្រាកពេទ្យ', 'Department and Admission Map'],
    ['បញ្ជីឱសថប្រចាំថ្ងៃ', 'Daily Medication List'], ['ចំណាយ', 'Expenses'],
    ['លំហូរសាច់ប្រាក់', 'Cash Flow'], ['ការជូនដំណឹង', 'Notifications'],
    ['របាយការណ៍', 'Reports'], ['ព័ត៌មានលម្អិត', 'Details'], ['មិនទាន់មានទិន្នន័យ', 'No data yet'],
    ['សេវាអមវេជ្ជសាស្ត្រ', 'Paraclinic Services'], ['ពិនិត្យអមគ្លីនិក', 'Paraclinic Tests'],
    ['តេស្តមន្ទីរពិសោធន៍', 'Laboratory Tests'], ['រូបភាព', 'Imaging'], ['សំណាក', 'Specimen'],
    ['លទ្ធផល', 'Result'], ['លទ្ធផល និងព័ត៌មានលម្អិត', 'Results and Details'],
    ['សំណើមន្ទីរពិសោធន៍', 'Laboratory Orders'], ['សំណើរូបភាពវេជ្ជសាស្ត្រ', 'Imaging Orders'],
    ['ស្វែងរកអ្នកជំងឺ', 'Search Patients'], ['ស្វែងរក', 'Search'], ['ជ្រើសរើស', 'Select'],
    ['ជ្រើសរើសសំណើមន្ទីរពិសោធន៍', 'Select a Laboratory Order'],
    ['ជ្រើសរើសផ្នែក', 'Select a Department'], ['ជ្រើសរើសផ្នែកទទួល', 'Select Receiving Department'],
    ['ទាំងអស់', 'All'], ['ផ្នែកទាំងអស់', 'All Departments'], ['គ្មាន', 'None'], ['ផ្សេងៗ', 'Other'],
    ['មាន', 'Yes'], ['មិនមាន', 'No'], ['សកម្មភាព', 'Actions'], ['ស្ថានភាព', 'Status'],
    ['សកម្ម', 'Active'], ['អសកម្ម', 'Inactive'], ['សកម្មភាព', 'Actions'],
    ['រក្សាទុក', 'Save'], ['រក្សាទុកព្រាង', 'Save Draft'], ['កំពុងរក្សាទុក…', 'Saving…'],
    ['បានរក្សាទុក', 'Saved'], ['បោះពុម្ព', 'Print'], ['បោះពុម្ពទម្រង់', 'Print Form'],
    ['បោះពុម្ពវិក្កយបត្រ', 'Print Invoice'], ['បោះពុម្ពប្រវត្តិ', 'Print History'],
    ['បោះពុម្ពវេជ្ជបញ្ជា', 'Print Prescription'], ['ធ្វើបច្ចុប្បន្នភាព', 'Refresh'],
    ['ទាញឡើងវិញ', 'Refresh'], ['បន្ថែម', 'Add'], ['កែប្រែ', 'Edit'], ['កែទិន្នន័យ', 'Edit Data'],
    ['លុប', 'Delete'], ['បិទ', 'Close'], ['បោះបង់', 'Cancel'], ['ត្រឡប់', 'Back'],
    ['បញ្ជូន', 'Send'], ['បញ្ជាក់', 'Confirm'], ['ទទួល', 'Receive'], ['បានទទួល', 'Received'],
    ['បន្ទាន់', 'Urgent'], ['សូមជ្រើសរើស...', 'Please Select…'], ['សូមជ្រើសរើស', 'Please Select'],
    ['រង់ចាំ', 'Waiting'], ['កំពុងដំណើរការ', 'In Progress'], ['បានបញ្ចប់', 'Completed'],
    ['បដិសេធ', 'Rejected'], ['តេស្ត', 'Test'], ['ឯកសារភ្ជាប់', 'Attachments'],
    ['មិនមានឯកសារភ្ជាប់ទេ។', 'No attachments.'], ['មិនមានលទ្ធផលតេស្តទេ។', 'No test results.'],
    ['លេខរៀង', 'Queue Number'], ['ចំនួនថ្ងៃ', 'Number of Days'], ['ចំនួនបង្កាន់ដៃ', 'Receipt Count'],
    ['បន្ទប់លេខ', 'Room Number'], ['គ្រែលេខ', 'Bed Number'], ['ខ្មែរ', 'Khmer'],
    ['ភាសាខ្មែរ', 'Khmer'], ['បង្ហាញ', 'Show'], ['លាក់', 'Hide'], ['ព្រឹក', 'Morning'],
    ['ថ្ងៃ', 'Day'], ['ល្ងាច', 'Evening'], ['យប់', 'Night'],
    ['តម្លៃយោងអាចកែតម្រូវបាន។', 'Reference values may be adjusted.'],
    ['រង់ចាំបង់ប្រាក់នៅបេឡា', 'Waiting for Cashier Payment'],
    ['បានបញ្ជូនទៅបញ្ជរបង់ប្រាក់', cashNotice],
    ['បានបញ្ជូនទៅមន្ទីរពិសោធន៍', 'Sent to Laboratory'],
    ['លទ្ធផលបានបញ្ជូនមកផ្នែក', 'Results Sent to Department'],
    ['សំណាកចូល', 'Specimen Sent to Laboratory'], ['បានណាត់', 'Scheduled'],
    ['បានធ្វើ', 'Performed'], ['កំពុងរាយការណ៍', 'Report in Progress'],
    ['បានបញ្ជូនលទ្ធផល', 'Result Sent'], ['មិនអាចបើកទិន្នន័យអ្នកជំងឺបានទេ។', 'Unable to load patient data.'],
    ['វេជ្ជបណ្ឌិតបានបញ្ជា / OPD ទៅមន្ទីរពិសោធន៍', 'Ordered by doctor / OPD to Laboratory'],
    ['ផ្នែកបានទទួល', 'Received by ward'], ['បានយកសំណាក', 'Specimen collected'],
    ['មន្ទីរពិសោធន៍បានទទួល', 'Received by Laboratory'], ['កំពុងធ្វើតេស្ត', 'Testing in progress'],
    ['ផ្នែកបានឃើញ', 'Viewed by ward'], ['បដិសេធសំណាក', 'Specimen rejected'],
    ['ធម្មតា', 'Routine'], ['ឈាមវិទ្យា', 'Hematology'], ['ការកកឈាម', 'Coagulation'],
    ['ជីវគីមីគ្លីនិក', 'Clinical Chemistry'], ['មុខងារតម្រងនោម', 'Renal Function'],
    ['អេឡិចត្រូលីត', 'Electrolytes'], ['មុខងារថ្លើម', 'Liver Function'],
    ['ខ្លាញ់ក្នុងឈាម', 'Lipid Profile'], ['សញ្ញាសម្គាល់បេះដូង', 'Cardiac Markers'],
    ['អ័រម៉ូន', 'Hormones'], ['អ័រម៉ូន និងក្រពេញអង់ដូគ្រីន', 'Endocrinology / Hormones'],
    ['សញ្ញាសម្គាល់ដុំសាច់', 'Tumor Markers'], ['ភាពស៊ាំ និងសេរ៉ូឡូស៊ី', 'Immunology / Serology'],
    ['សេរ៉ូឡូស៊ី និងភាពស៊ាំ', 'Serology / Immunology'], ['តេស្តរហ័ស', 'Rapid Tests'],
    ['មីក្រូជីវវិទ្យា', 'Microbiology'], ['ប៉ារ៉ាស៊ីតវិទ្យា', 'Parasitology'],
    ['ពិនិត្យទឹកនោម', 'Urinalysis'], ['ពិនិត្យលាមក', 'Stool Examination'],
    ['ម៉ូលេគុល និង PCR', 'Molecular / PCR'], ['ធនាគារឈាម និងការបញ្ចូលឈាម', 'Blood Bank / Transfusion'],
    ['តេស្តផ្សេងៗ និងពិសេស', 'Other / Special Tests'], ['សេវាអមគ្លីនិក', 'Paraclinic Services'],
    ['បញ្ចូលលទ្ធផល', 'Enter Results'], ['លទ្ធផល និងព័ត៌មានលម្អិត', 'Results and Details'],
    ['បញ្ចូលលទ្ធផល ដំណើរការ និងឯកសារភ្ជាប់', 'Enter results, workflow, and attachments'],
    ['សំណើមន្ទីរពិសោធន៍', 'Laboratory Orders'], ['ជ្រើសរើសសំណើដើម្បីបញ្ចូលលទ្ធផល', 'Select an order to enter results'],
    ['តម្រង និងសកម្មភាពមន្ទីរពិសោធន៍', 'Laboratory filters and actions'],
    ['ស្វែងរកអ្នកជំងឺ លេខករណី ឬតេស្ត', 'Search patients, case numbers, or tests'],
    ['គ្រប់គ្រងបញ្ជីតេស្ត', 'Manage Test Catalog'], ['ទទួលសំណាក', 'Receive Specimen'],
    ['ចាប់ផ្តើមតេស្ត និងរក្សាទុកព្រាង', 'Start Testing and Save Draft'],
    ['បញ្ជាក់លទ្ធផល និងបញ្ជូនទៅវេជ្ជបណ្ឌិត OPD', 'Verify Result and Send to OPD Doctor'],
    ['បញ្ជាក់ និងបញ្ជូនទៅផ្នែក', 'Verify and Send to Ward'], ['បដិសេធសំណាក', 'Reject Specimen'],
    ['សំណាកត្រូវបានបដិសេធ:', 'Specimen rejected:'], ['លទ្ធផលបានបញ្ជូនមកផ្នែក', 'Results sent to ward'],
    ['តេស្តដែលបានបញ្ជាតាមក្រុម', 'Ordered Tests by Group'], ['ឯកសារភ្ជាប់', 'Attachments'],
    ['បញ្ជាក់លទ្ធផល', 'Verify Results'], ['លទ្ធផលនៅទទេ។ តើត្រូវបញ្ជូនលទ្ធផលឬ?', 'Some results are blank. Send them anyway?'],
    ['លទ្ធផលនេះមានតម្លៃគ្រោះថ្នាក់។ តើត្រូវបញ្ជាក់ និងបញ្ជូនឥឡូវនេះឬ?', 'This result is critical. Verify and send it now?'],
    ['បញ្ជាដោយ', 'Ordered by'], ['បានទទួលសំណាក', 'Specimen received'],
    ['បានបញ្ជូនទៅមន្ទីរពិសោធន៍', 'Sent to Laboratory'], ['យកសំណាក', 'Collect Specimen'],
    ['ប្រមូលសំណាក', 'Collect Specimen'], ['បញ្ជូនសំណាកទៅមន្ទីរពិសោធន៍', 'Send Specimen to Laboratory'],
    ['បញ្ជូនទៅរូបភាពវេជ្ជសាស្ត្រ', 'Send to Medical Imaging'], ['សំណើមិនបានជោគជ័យ', 'The request failed'],
    ['រង់ចាំ', 'Waiting'], ['អ៊ុលត្រាសោន', 'Ultrasound'], ['កាំរស្មីអ៊ិច', 'X-ray'],
    ['បាទ/ចាស', 'Yes'], ['មិនដឹង', 'Unknown'], ['មិនពាក់ព័ន្ធ', 'Not applicable'],
    ['បានបង់នៅបេឡា', 'Paid at Cashier'], ['ឥតគិតថ្លៃ', 'Free of charge'],
    ['មិនប្រើសារធាតុបង្កើនកម្រិតរូបភាព', 'Without contrast'],
    ['ប្រើសារធាតុបង្កើនកម្រិតរូបភាព', 'With contrast'],
    ['ឱ្យផ្នែករូបភាពវេជ្ជសាស្ត្រសម្រេច', 'Radiology to decide'],
    ['មានផ្ទៃពោះ ឬអាចមានផ្ទៃពោះ', 'Pregnant or possibly pregnant'],
    ['មានប្រវត្តិអាលែហ្ស៊ីសារធាតុបង្កើនកម្រិតរូបភាព', 'History of contrast allergy'],
    ['ហានិភ័យតម្រងនោម ត្រូវពិនិត្យមុខងារតម្រងនោម', 'Renal risk; check kidney function'],
    ['មានឧបករណ៍បេះដូង Pacemaker/ICD', 'Pacemaker/ICD present'],
    ['មានលោហៈក្នុងខ្លួន ឬវត្ថុបរទេស', 'Metal implant or foreign body present'],
    ['ខ្លាចកន្លែងចង្អៀត', 'Claustrophobia'], ['ប្រមូលសំណាក', 'Collect Specimen'],
    ['បញ្ជូនទៅរូបភាពវេជ្ជសាស្ត្រ', 'Send to Medical Imaging'],
    ['ទទួលសំណាក', 'Receive Specimen'], ['ស្នើសុំរូបភាពវេជ្ជសាស្ត្រ', 'Imaging Request'],
    ['សំណើរូបភាពវេជ្ជសាស្ត្រ', 'Imaging Orders'], ['ឈ្មោះអ្នកជំងឺ', 'Patient Name'],
    ['មិនអាចរក្សាទុកទិន្នន័យបានទេ៖ ', 'Unable to save data: '],
    ['សូមបញ្ចូលលេខករណី ឬលេខប័ណ្ណសុខភាព។', 'Enter a case number or Health ID.'],
    ['សូមបញ្ចូលឈ្មោះអ្នកជំងឺ។', 'Enter the patient name.'],
    ['សូមជ្រើសរើសផ្នែកដែលត្រូវបញ្ជូនអ្នកជំងឺ។', 'Select the receiving department.'],
    ['បញ្ជូនទៅបញ្ជរបង់ប្រាក់', 'Send to Cashier'], ['បញ្ជូនទៅគិលានុបដ្ឋាក', 'Send to Nurse'],
    ['បានបញ្ជូនទៅបញ្ជរបង់ប្រាក់', cashNotice],
    ['ចំណាយមន្ទីរពេទ្យ', 'Hospital Expenses'], ['របាយការណ៍ប្រចាំថ្ងៃ និងលំហូរសាច់ប្រាក់', 'Daily Report and Cash Flow'],
    ['បង្កើតគណនីថ្មី', 'Create Account'], ['ឈ្មោះបុគ្គលិក', 'Staff Name'], ['ឈ្មោះអ្នកប្រើ', 'Username'],
    ['ពាក្យសម្ងាត់បណ្តោះអាសន្ន', 'Temporary Password'], ['សិទ្ធិចូលប្រើផ្នែក', 'Department Access'],
    ['គណនីសកម្ម', 'Active Account'], ['សម្អាត', 'Clear'], ['គណនីបុគ្គលិក', 'Staff Accounts'],
    ['គណនីមួយអាចមានតួនាទី និងសិទ្ធិចូលប្រើច្រើនផ្នែក។', 'One account can have multiple roles and department access.'],
    ['ហត្ថលេខាអេឡិចត្រូនិក', 'Electronic Signature'], ['បុគ្គលិក', 'Staff'], ['គណនី', 'Accounts'],
    ['ហត្ថលេខា', 'Signature'], ['កំណត់ហេតុសកម្មភាព', 'Activity Log'],
    ['បង្ហាញសកម្មភាពថ្មីៗតាមអ្នកប្រើ តួនាទី និងផ្នែក។', 'Recent activity by user, role, and department.'],
    ['បេឡា និងការទូទាត់អ្នកជំងឺ', 'Cashier and Patient Payments'], ['បេឡា និងការទូទាត់', 'Cashier and Payments'],
    ['ទទួលប្រាក់បានលឿន និងច្បាស់លាស់', 'Process payments clearly and quickly'],
    ['បញ្ជីស្ថានភាពទូទាត់', 'Payment Status List'], ['បញ្ជីតម្លៃសេវា', 'Service Price List'],
    ['បានបញ្ជូនពីផ្នែក', 'Sent from Department'], ['បង្ហាញតែវិក្កយបត្រដែលផ្នែកបានបញ្ជូនមកបេឡា', 'Show only invoices sent to Cashier by a department'],
    ['ស្វែងរកក្នុងជួរបង់ប្រាក់', 'Search the Payment Queue'], ['បញ្ជីអ្នកជំងឺបច្ចុប្បន្ន', 'Current Patient List'],
    ['វិក្កយបត្រអ្នកជំងឺ', 'Patient Invoice'], ['អត្រាប្តូរប្រាក់', 'Exchange Rate'],
    ['កំពុងទាញអត្រាប្តូរប្រាក់…', 'Loading the exchange rate…'], ['ស្នើអត្រាថ្មី', 'Request New Rate'],
    ['បន្ថែមសេវា', 'Add Service'], ['ជ្រើសសេវាដែលអ្នកជំងឺបានប្រើ', 'Select the service provided to the patient'],
    ['តម្លៃឯកតា', 'Unit Price'], ['+ បន្ថែមក្នុងវិក្កយបត្រ', '+ Add to Invoice'],
    ['ទទួលការទូទាត់', 'Receive Payment'], ['ទូទាត់សមតុល្យដែលនៅសល់', 'Pay Remaining Balance'],
    ['របៀបទូទាត់', 'Payment Method'], ['ជម្រើសសាច់ប្រាក់', 'Cash Options'],
    ['រូបិយប័ណ្ណបញ្ចុះ', 'Discount Currency'], ['លេខយោងអ្នកបង់', 'Payer Reference'],
    ['បញ្ចុះតម្លៃ / លើកលែងថ្លៃសេវា', 'Discount / Fee Waiver'], ['ការកែតម្រូវ', 'Adjustments'],
    ['បង់តាមតម្លៃធម្មតា', 'Charge the Standard Amount'], ['បញ្ចុះជាចំនួនទឹកប្រាក់', 'Discount by Amount'],
    ['បញ្ចុះជាភាគរយ', 'Discount by Percentage'], ['លើកលែងមួយផ្នែក', 'Partial Fee Waiver'],
    ['លើកលែងទាំងស្រុង (ឥតគិតថ្លៃ)', 'Full Fee Waiver (Free)'], ['ភាគរយ', 'Percent'],
    ['ចុចប៊ូតុងបៃតងខាងក្រោម ដើម្បីរក្សាទុកការកែតម្រូវ និងទទួលប្រាក់ក្នុងពេលតែមួយ។', 'Select the green button below to save adjustments and receive payment together.'],
    ['កាលបរិច្ឆេទ និងម៉ោងបង់ប្រាក់', 'Payment Date and Time'], ['ទូទាត់សមតុល្យ', 'Pay Balance'],
    ['ព័ត៌មានបន្ថែម', 'Additional Information'], ['ផ្នែកសេវាទទួលប្រាក់', 'Receiving Service Department'],
    ['សេវាដែលបានបង់', 'Paid Services'], ['គោលបំណង', 'Purpose'], ['លេខយោង', 'Reference Number'],
    ['ភ្ជាប់បង្កាន់ដៃ ឬភស្តុតាង', 'Attach Receipt or Proof'], ['កំណត់សម្គាល់របៀបទូទាត់', 'Payment Method Notes'],
    ['សេវាក្នុងវិក្កយបត្រ', 'Invoice Services'], ['ពិនិត្យថ្លៃសេវានីមួយៗ មុនទទួលប្រាក់', 'Review each service fee before receiving payment'],
    ['លុបសេវាមិនទាន់បង់', 'Remove Unpaid Services'], ['ប្រវត្តិការទូទាត់ទាំងអស់', 'All Payment History'],
    ['បង្ហាញបង្កាន់ដៃពីគ្រប់វិក្កយបត្ររបស់អ្នកជំងឺ រួមទាំងកំណត់ត្រាដែលបានកែតម្រូវ', 'Show receipts from all patient invoices, including adjusted records'],
    ['លេខវិក្កយបត្រ', 'Invoice Number'], ['បង្កាន់ដៃ', 'Receipt'], ['ប្រភព / បេឡាករ', 'Source / Cashier'],
    ['ស្ថានភាព / សកម្មភាព', 'Status / Actions'], ['ជ្រើសរើសប្រវត្តិសម្រាប់បោះពុម្ព', 'Choose History to Print'],
    ['អាចបោះពុម្ពការទូទាត់តាមថ្ងៃ ឬតាមរយៈពេល', 'Print payments by day or date range'],
    ['ជម្រើសបោះពុម្ព', 'Print Options'], ['បញ្ចូលវិក្កយបត្រច្រើនក្នុងថ្ងៃបង់ប្រាក់តែមួយ', 'Combine invoices paid on the same day'],
    ['បញ្ចូលវិក្កយបត្រក្នុងរយៈពេលដែលបានជ្រើសរើស', 'Combine invoices in the selected period'],
    ['ថ្ងៃបង់ប្រាក់', 'Payment Date'], ['ចាប់ពីថ្ងៃ', 'From Date'], ['ដល់ថ្ងៃ', 'To Date'],
    ['បញ្ជីអ្នកជំងឺ និងស្ថានភាពទូទាត់', 'Patient List and Payment Status'],
    ['ស្វែងរកតាមលេខអ្នកជំងឺ ឬលេខប័ណ្ណសុខភាព។ បញ្ជីនេះបង្ហាញកំណត់ត្រាបង់រួច និងមិនទាន់បង់។', 'Search by patient number or Health ID. This list includes paid and unpaid records.'],
    ['ស្វែងរកលេខអ្នកជំងឺ', 'Search Patient Number'], ['លេខអ្នកជំងឺ', 'Patient Number'],
    ['ថ្ងៃចូល', 'Entry Date'], ['ថ្ងៃចេញ', 'Discharge Date'], ['ស្ថានភាពបង់ប្រាក់', 'Payment Status'],
    ['កំពុងផ្ទុកបញ្ជី…', 'Loading list…'], ['គ្រប់គ្រងបញ្ជីតម្លៃសេវា', 'Manage Service Price List'],
    ['Admin និង Director អាចកែតម្លៃសេវា ឬបន្ថែមសេវា និងថ្លៃថ្មីៗ', 'Admins and Directors can edit service prices or add new services and fees'],
    ['+ បន្ថែមសេវាថ្មី', '+ Add New Service'], ['លេខកូដ', 'Code'], ['ឈ្មោះសេវា', 'Service Name'],
    ['លំដាប់', 'Order'], ['រក្សាទុកសេវា', 'Save Service'], ['សម្អាតទម្រង់', 'Clear Form'],
    ['កត់ត្រាចំណាយថ្មី', 'Record New Expense'], ['បញ្ចូលតែចំណាយរបស់មន្ទីរពេទ្យ មិនមែនការទូទាត់របស់អ្នកជំងឺទេ។', 'Record hospital expenses here, not patient payments.'],
    ['ប្រភេទចំណាយ', 'Expense Category'], ['សម្ភារៈវេជ្ជសាស្ត្រ', 'Medical Supplies'], ['ទឹក ភ្លើង និងអ៊ីនធឺណិត', 'Utilities and Internet'],
    ['ជួសជុល និងថែទាំ', 'Repairs and Maintenance'], ['ប្រេងឥន្ធនៈ', 'Fuel'], ['ដឹកជញ្ជូន', 'Transport'],
    ['អាហារ', 'Food'], ['សម្ភារៈការិយាល័យ', 'Office Supplies'], ['ប្រាក់ឧបត្ថម្ភបុគ្គលិក', 'Staff Allowances'],
    ['បរិយាយ', 'Description'], ['លេខបង្កាន់ដៃ', 'Receipt Number'], ['រក្សាទុកចំណាយ', 'Save Expense'],
    ['ប្រវត្តិចំណាយ', 'Expense History'], ['ចំណាយថ្មីបំផុតត្រូវបង្ហាញនៅលើគេ។', 'The newest expenses appear first.'],
    ['ប្រភេទ', 'Category'], ['កត់ត្រាដោយ', 'Recorded By'], ['របាយការណ៍មន្ទីរពេទ្យប្រចាំថ្ងៃ', 'Daily Hospital Report'],
    ['ចំនួនអ្នកជំងឺ ការផ្ទេរ ស្ថានភាពបង់ប្រាក់ និងចំណូលរថយន្តសង្គ្រោះ', 'Patients, transfers, payment status, and ambulance revenue'],
    ['ថ្ងៃនេះ', 'Today'], ['អ្នកជំងឺតាមផ្នែក', 'Patients by Department'], ['អ្នកជំងឺសល់', 'Remaining Patients'],
    ['ចូលថ្មី', 'New Admissions'], ['កំពុងសម្រាក', 'Currently Admitted'], ['ប្រតិទិនចំណូល និងចំណាយ', 'Revenue and Expense Calendar'],
    ['ខែនេះ', 'This Month'], ['របាយការណ៍ចំណូលប្រចាំខែតាមផ្នែក និងសេវា', 'Monthly Revenue by Department and Service'],
    ['បង្ហាញប្រាក់ដែលបានទទួលពិតប្រាកដតាមសេវា។ ប្រាក់ចាស់ដែលមិនបានកំណត់សេវានឹងបង្ហាញជាប្រភេទមិនបានកំណត់។', 'Shows actual receipts by service. Older payments without a service category appear as Unspecified.'],
    ['បោះពុម្ពរបាយការណ៍ខែ', 'Print Monthly Report'], ['ចំណូលតាមផ្នែកសេវា', 'Revenue by Service Department'],
    ['ចំណូលតាមសេវា', 'Revenue by Service'], ['អាទិត្យ', 'Sunday'], ['ចន្ទ', 'Monday'], ['អង្គារ', 'Tuesday'],
    ['ពុធ', 'Wednesday'], ['ព្រហ', 'Thursday'], ['សុក្រ', 'Friday'], ['សៅរ៍', 'Saturday'],
    ['ចំណូល និងចំណាយប្រចាំថ្ងៃ', 'Daily Revenue and Expenses'], ['ចំណូល', 'Revenue'],
    ['ជ្រើសរើសតួនាទី និងផ្នែកការងារ', 'Choose Role and Work Department'],
    ['ជ្រើសរើសតួនាទីដែលអ្នកកំពុងបំពេញ និងផ្នែកដែលអ្នកកំពុងធ្វើការ។ ប្រព័ន្ធនឹងបង្ហាញតែអ្នកជំងឺ និងទម្រង់ដែលអ្នកមានសិទ្ធិ។', 'Choose your current role and department. The system shows only patients and forms you are authorized to access.'],
    ['ចូលប្រើ EMR', 'Open EMR'], ['ចាកចេញ', 'Sign Out'], ['ផែនទីគ្រែមន្ទីរពេទ្យ', 'Hospital Bed Map'],
    ['អ្នកជំងឺ IPD ដែលបានចុះឈ្មោះនឹងបង្ហាញក្នុងបញ្ជីរង់ចាំ។', 'Registered IPD patients appear in the waiting list.'],
    ['រក្សាទុកផែនទី', 'Save Map'], ['អ្នកជំងឺរង់ចាំចូលសម្រាក', 'Patients Waiting for Admission'],
    ['ជ្រើសរើសសំណើដើម្បីបំពេញការពិនិត្យ', 'Select an order to complete the examination'],
    ['របាយការណ៍ និងព័ត៌មានលម្អិត', 'Report and Details'], ['សំណើពិនិត្យ សុវត្ថិភាព របាយការណ៍ និងឯកសារភ្ជាប់', 'Exam request, safety, report, and attachments'],
    ['ជ្រើសរើសសំណើរូបភាពវេជ្ជសាស្ត្រ', 'Select an Imaging Request'], ['គ្រប់ស្ថានភាព', 'All Statuses'],
    ['បានរាយការណ៍', 'Reported'], ['បញ្ជូនអ្នកជំងឺទៅ IPD', 'Transfer Patient to IPD'],
    ['ជ្រើសរើសអ្នកជំងឺពី OPD និងបញ្ជូនទៅផ្នែកសម្រាក', 'Select an OPD patient and transfer to an inpatient ward'],
    ['ទាញទិន្នន័យ', 'Refresh Data'], ['បញ្ជូនអ្នកជំងឺទៅសម្រាក IPD', 'Transfer Patient to IPD'],
    ['ជ្រើសរើសផ្នែកសម្រាក', 'Select Inpatient Ward'], ['បញ្ជូនទៅ IPD', 'Transfer to IPD'],
    ['ពេលបញ្ជូន', 'Time Sent'], ['លេខករណី / លេខបណ្ណសុខភាព', 'Case Number / Health ID'],
    ['បើកកំណត់ត្រា', 'Open Record'], ['អ្នកជំងឺមកយឺត / បានរំលង', 'Late or Skipped Patients'],
    ['ពេលរំលង', 'Time Skipped'], ['អ្នកជំងឺបានបំពេញទ្រីយ៉ារួច', 'Patients with Triage Completed'],
    ['អ្នកជំងឺរង់ចាំទ្រីយ៉ា', 'Patients Waiting for Triage'],
    ['អ្នកជំងឺដែលបានចុះឈ្មោះហើយ និងមិនទាន់បំពេញទ្រីយ៉ា — មកមុននៅខាងលើ', 'Registered patients awaiting triage; earlier arrivals appear first'],
    ['ពេលចុះឈ្មោះ', 'Registration Time'], ['បញ្ជីសម្រាប់មើលទិន្នន័យទ្រីយ៉ាដែលបានបំពេញរួច — មិនមានប៊ូតុងបំពេញម្ដងទៀត', 'Completed triage records are view-only and cannot be submitted again'],
    ['អ្នកជំងឺ IPD បានចេញពីពេទ្យ', 'Discharged IPD Patients'], ['កំពុងទាញបញ្ជី…', 'Loading list…'],
    ['អ្នកជំងឺ OPD និងអ្នកជំងឺ IPD ដែលបានចេញពីពេទ្យ', 'OPD patients and discharged IPD patients'],
    ['លេខរៀង OPD', 'OPD Queue'], ['IPD · បានចេញពីពេទ្យ', 'IPD · Discharged'],
    ['អ្នកជំងឺ / លេខករណី', 'Patient / Case Number'], ['វេជ្ជបញ្ជា OPD', 'OPD Prescription'],
    ['បានផ្ដល់ថ្នាំរួចរាល់', 'Medication Dispensed'], ['ផ្ទេរថ្នាំ PMRS2 → បញ្ជីថ្នាំ EMR', 'Transfer PMRS2 Medication to the EMR List'],
    ['ពិនិត្យអ្នកជំងឺ និងថ្នាំ មុនចុចរក្សាទុក', 'Review the patient and medicines before saving'],
    ['១. ព័ត៌មានពី PMRS2', '1. PMRS2 Information'], ['កំពុងរង់ចាំថ្នាំពីទំព័រ PMRS2...', 'Waiting for medication from PMRS2…'],
    ['២. ជ្រើសអ្នកជំងឺ HEF ក្នុង EMR', '2. Select the HEF Patient in EMR'],
    ['លេខបណ្ណសុខភាពក្នុង PMRS2 ត្រូវតែត្រូវនឹង EMR។ ត្រូវមានសិទ្ធិវេជ្ជបណ្ឌិត ឬអ្នកគ្រប់គ្រង។', 'The PMRS2 Health ID must match the EMR. Doctor or Admin access is required.'],
    ['កំណត់ត្រាអ្នកជំងឺ', 'Patient Record'], ['រង់ចាំទិន្នន័យពី PMRS2...', 'Waiting for PMRS2 data…'],
    ['៣. ពិនិត្យកាលបរិច្ឆេទ និងថ្នាំ', '3. Review Date and Medication'], ['ថ្ងៃ និងម៉ោងក្នុង PMRS2', 'PMRS2 Date and Time'],
    ['ផ្ទេរទៅក្នុង EMR', 'Transfer into EMR'], ['ការតាមដានប្រចាំថ្ងៃ IPD', 'IPD Daily Follow-up'],
    ['ថ្នាំថ្ងៃចូលសម្រាក IPD', 'IPD Admission Medication'], ['យក', 'Take'], ['ផ្លូវប្រើ EMR', 'EMR Route'],
    ['ដើមក្នុង PMRS2', 'Original in PMRS2'], ['ខ្ញុំបានពិនិត្យលេខអ្នកជំងឺ ថ្ងៃម៉ោង ផ្លូវប្រើ និងចំនួនថ្នាំ', 'I reviewed the patient ID, date and time, route, and medicine quantity'],
    ['រក្សាទុកថ្នាំក្នុង EMR', 'Save Medication to EMR'], ['បញ្ជីឱសថប្រចាំថ្ងៃរង់ចាំហត្ថលេខាប្រធានមន្ទីរពេទ្យ', 'Daily Medication List Awaiting Hospital Director Signature'],
    ['បង្ហាញបញ្ជីដែលបានចុះហត្ថលេខាដោយប្រធានផ្នែករួចរាល់។', 'Shows lists already signed by the department head.'],
    ['ពិនិត្យលេខរៀង · ឱសថស្ថាន', 'Queue Display · Pharmacy'], ['ផ្ទាំងលេខរៀង · ឱសថស្ថាន', 'Queue Display · Pharmacy'], ['កន្លែង:', 'Counter:'],
    ['សូមរង់ចាំតាមលេខរៀងរបស់លោកអ្នក', 'Please wait for your queue number'],
    ['🔔 បើកសំឡេងហៅ', '🔔 Enable Call Sound'], ['កំពុងហៅលេខ', 'Calling Number'], ['កំពុងរង់ចាំការហៅ…', 'Waiting to be called…'],
    ['ទំព័រនេះអាចកែប្រែបានដោយ Admin ប៉ុណ្ណោះ។', 'Only an Admin can edit this page.'],
    ['ឈ្មោះស្ថាប័នជាភាសាខ្មែរ', 'Organization Name in Khmer'], ['រូបសញ្ញា (PNG, JPEG ឬ WebP; រហូតដល់ 2 MB)', 'Logo (PNG, JPEG, or WebP; up to 2 MB)'],
    ['លុបរូបសញ្ញាដែលបានដាក់ (ប្រើរូបសញ្ញាលំនាំដើម)', 'Remove Uploaded Logo (Use Default Logo)'],
    ['រក្សាទុកការកំណត់', 'Save Settings'], ['មើល ស្វែងរក និងបើកកំណត់ត្រាអ្នកជំងឺ', 'View, search, and open patient records'],
    ['មើលបញ្ជីរង់ចាំ ផ្នែក បន្ទប់ និងគ្រែទំនេរ', 'View waiting lists, departments, rooms, and available beds'],
    ['ចុះឈ្មោះអ្នកជំងឺ វាយតម្លៃ និងបំពេញទម្រង់ព្យាបាល', 'Register patients, assess them, and complete treatment forms'],
    ['អ្នកជំងឺថ្មីពីតម្រៀប លេខរៀង និងស្ថានភាពពិគ្រោះ', 'New triage patients, queue numbers, and consultation status'],
    ['បង្ហាញលេខ Queue ឈ្មោះអ្នកជំងឺ និង Counter លើ TV/HDMI', 'Display queue number, patient name, and counter on TV/HDMI'],
    ['បញ្ជី OPD និងអ្នកជំងឺ IPD ចេញពីពេទ្យ · ពិនិត្យលេខរៀង', 'OPD and discharged IPD medication queues · Queue display'],
    ['ទទួលសំណើ បញ្ចូលលទ្ធផល និងបញ្ចេញលទ្ធផលទៅកំណត់ត្រាអ្នកជំងឺ', 'Receive requests, enter results, and send results to patient records'],
    ['អ៊ុលត្រាសោន កាំរស្មីអ៊ិច CT និង MRI', 'Ultrasound, X-ray, CT, and MRI'],
    ['ការទូទាត់អ្នកជំងឺ', 'Patient Payments'],
    ['មិនទាន់បង់ប្រាក់ សាច់ប្រាក់ ប.ស.ស បណ្ណមូលនិធិសមធម៌ លើកលែង បញ្ចុះថ្លៃសេវា និងបង្កាន់ដៃ', 'Unpaid, cash, NSSF, equity fund, waivers, discounts, and receipts'],
    ['ការចូលសម្រាក ចំនួនអ្នកជំងឺតាមផ្នែក ស្ថានភាពបង់ប្រាក់ ការផ្ទេរ ចំណូលរថយន្តសង្គ្រោះ ចំណូល និងចំណាយ', 'Admissions, patients by ward, payment status, transfers, ambulance revenue, income, and expenses'],
    ['បង្កើតគណនីសាកល្បង កំណត់តួនាទី ផ្នែក និងស្ថានភាពគណនី', 'Create demo accounts and set roles, departments, and account status'],
    ['កំណត់ឈ្មោះមន្ទីរពេទ្យ ឬមណ្ឌលសុខភាព និងដាក់ស្លាកសញ្ញា', 'Set a hospital or health center name and logo'],
    ['សូមរង់ចាំការទទួល…', 'Waiting to be received…'], ['កំពុងរង់ចាំ…', 'Waiting…'],
    ['បានបញ្ជូនមកផ្នែក', 'Sent to Department'], ['ការធ្វើបច្ចុប្បន្នភាពស្វ័យប្រវត្តិត្រូវបានផ្អាក ខណៈកំពុងបំពេញលទ្ធផល។ សូមរក្សាទុកព្រាង ឬបញ្ចេញរបាយការណ៍មុន។', 'Automatic refresh is paused while results are being edited. Save a draft or release the report first.'],
    ['មានទិន្នន័យលទ្ធផលដែលមិនទាន់រក្សាទុក។ តើចង់បោះបង់ការកែប្រែនេះឬ?', 'Unsaved result data. Discard these changes?'],
    ['មានលទ្ធផលមន្ទីរពិសោធន៍ដែលមិនទាន់រក្សាទុក។ តើចង់បើកសំណើផ្សេង ហើយបោះបង់ការកែប្រែទាំងនេះឬ?', 'Unsaved laboratory results. Open another order and discard these changes?'],
    ['ជ្រើសរើសតួនាទី និងផ្នែក — Borkeo EMR', 'Choose Role and Department — Borkeo EMR'],
    ['ផែនទីផ្នែក — Borkeo EMR', 'Department Map — Borkeo EMR'], ['+ បន្ថែមផ្នែក', '+ Add Department'],
    ['ស្ថានភាពទូទាត់', 'Payment Status'], ['ទំព័រដើម — Borkeo EMR', 'Home — Borkeo EMR'],
    ['បញ្ជីអ្នកជំងឺ OPD និងជ្រើសរើសផ្នែកសម្រាក', 'OPD patient list and inpatient ward selection'],
    ['បណ្ណស្នើសុំឱសថប្រចាំថ្ងៃ', 'Daily Medication Request Form'],
    ['មើលថ្នាំតាមអ្នកជំងឺ គ្រែ និងផ្នែក ព្រមទាំងបោះពុម្ពបណ្ណស្នើសុំ', 'View medications by patient, bed, and ward, and print request forms'],
    ['បញ្ជូនអ្នកជំងឺទៅ IPD · Borkeo EMR', 'Transfer Patient to IPD · Borkeo EMR'],
    ['បញ្ជីរង់ចាំ OPD · Borkeo EMR', 'OPD Waiting List · Borkeo EMR'], ['ថ្ងៃខែឆ្នាំ', 'Date'],
    ['បញ្ជីអ្នកជំងឺ — Borkeo EMR', 'Patient List — Borkeo EMR'],
    ['កាលបរិច្ឆេទចូលអាចកែបាន។ កាលបរិច្ឆេទចេញបង្ហាញតែបន្ទាប់ពីគ្រូពេទ្យរក្សាទុកទម្រង់បញ្ចេញអ្នកជំងឺ។', 'Entry dates are editable. Discharge dates appear after a doctor saves the discharge form.'],
    ['សរុប 0', 'Total 0'], ['កំណត់ឡើងវិញ', 'Reset'], ['ល.រ', 'No.'], ['ឈ្មោះ', 'Name'],
    ['បញ្ជីចែកឱសថ · Borkeo EMR', 'Medication Queue · Borkeo EMR'],
    ['បញ្ចូលថ្នាំពី PMRS2 · មន្ទីរពេទ្យបង្អែកបរកែវ', 'Import Medication from PMRS2 · Borkeo Referral Hospital'],
    ['កំពុងរង់ចាំថ្នាំ...', 'Waiting for medication…'], ['កំពុងរង់ចាំថ្នាំពីទំព័រ PMRS2...', 'Waiting for medication from the PMRS2 page…'],
    ['ផ្នែកទ្រីយ៉ា — បញ្ជីរង់ចាំអ្នកជំងឺ — Borkeo EMR', 'Triage — Patient Waiting List — Borkeo EMR'],
    ['ផ្នែកទ្រីយ៉ា — បញ្ជីរង់ចាំអ្នកជំងឺ', 'Triage — Patient Waiting List'],
    ['លេខបណ្ណសុខភាព / លេខករណី', 'Health ID / Case Number'],
    ['លេខរៀងនៅតែរក្សាទុក ហើយអាចហៅមកបំពេញទ្រីយ៉ាបានពេលអ្នកជំងឺមកដល់', 'The queue number is kept, and the patient can be called for triage when they arrive.'],

    ["ចុះហត្ថលេខា", "Sign"],
    ["ផ្នែកទាំងឡាយ", "Departments"],
    ["អនុម័ត", "Approve"],
    ["អនុម័តលើកលែងថ្លៃ", "Approve free fee"],
    ["បដិសេធ", "Decline"],
    ["បន្តទៅពិនិត្យវាយតម្លៃ ➔", "Continue to Assessment ➔"],
    ["បោះពុម្ពទម្រង់សិទ្ធិអតិថិជន", "Print Patient Rights Form"],
    ["បោះពុម្ពកិច្ចសន្យា", "Print Agreement"],
    ["បន្ថែម +", "Add +"],
    ["បោះពុម្ពទម្រង់ OPD", "Print OPD Form"],
    ["បោះពុម្ពទម្រង់ IPD", "Print IPD Form"],
    ["បោះពុម្ពទម្រង់ ANC", "Print ANC Form"],
    ["បោះពុម្ពទម្រង់សម្រាល", "Print Delivery Form"],
    ["បោះពុម្ពទម្រង់ Delivery", "Print Delivery Form"],
    ["បំពេញធម្មតាទាំងអស់", "Mark All Normal"],
    ["បន្តពូជ/ទឹកនោម ធម្មតា", "Genital / Urinary Normal"],
    ["ចុងអវៈយវៈ ធម្មតា", "Extremities Normal"],
    ["ឆ្អឹង/សាច់ដុំ ធម្មតា", "Musculoskeletal Normal"],
    ["ផ្សេងទៀត ធម្មតា", "Other Normal"],
    ["កំណត់ពិធីសារ", "Set Protocol"],
    ["រក្សាទុកការតាមដាន", "Save Follow-up"],
    ["+ បន្ថែមពេលវេលា", "+ Add Time"],
    ["មើលវេជ្ជបញ្ជា", "View Prescription"],
    ["បោះពុម្ពបង្កាន់ដៃ", "Print Receipt"],
    ["រំលង", "Skip"],
    ["+ បន្ថែមការណាត់", "+ Add Appointment"],
    ["ហៅ", "Call"],
    ["ហៅ / Call", "Call"],
    ["កំណត់ពាក្យសម្ងាត់ថ្មី", "Reset Password"],
    ["កែហត្ថលេខា", "Edit Signature"],
    ["បង្កើតហត្ថលេខា", "Create Signature"],
    ["បង្កើតពីឈ្មោះ", "Create from Name"],
    ["រក្សាទុកហត្ថលេខា", "Save Signature"],
    ["ផ្ញើសារ", "Send Message"],
    ["បិទសារ", "Close Message"],
    ["+ ផ្ញើសារ", "+ Send Message"],
    ["ប្តូរពាក្យសម្ងាត់", "Change Password"],
    ["ចាប់ផ្តើមការងារ", "Start Work"],
    ["+ បន្ថែមថ្នាំ", "+ Add Medication"],
    ["បញ្ជូនទៅសម្រាក IPD", "Transfer to IPD"],
    ["បញ្ជូនទៅមន្ទីរពេទ្យខេត្ត", "Transfer to Provincial Hospital"],
    ["រក្សាទុក និងបញ្ជូន", "Save and Send"],
    ["+ បន្ថែមថ្លៃសេវា", "+ Add fee"],
    ["បញ្ជូនវិក្កយបត្រទៅបេឡា", "Send invoice to Cashier"],
    ["បន្ថែមថ្លៃបញ្ជូន", "Add transfer fee"],
    ["ដកថ្លៃសេវា", "Remove fee"],
    ["ទទួលសំណើ", "Receive order"],
    ["បញ្ជូនសំណាកទៅមន្ទីរពិសោធន៍", "Send specimen to lab"],
    ["យកសំណាកថ្មី", "Collect replacement specimen"],
    ["អ្នកជំងឺយល់ព្រមបង់ប្រាក់", "Patient agrees to pay"],
    ["ស្នើសុំលើកលែងថ្លៃ", "Request free charge"],
    ["បញ្ជូនសំណើទៅផ្នែក", "Send Order to Department"],
    ["+ មន្ទីរពិសោធន៍", "+ Laboratory"],
    ["+ អ៊ុលត្រាសោន", "+ Ultrasound"],
    ["+ កាំរស្មីអ៊ិច", "+ X-ray"],
    ["+ ស៊ីធី", "+ CT"],
    ["+ អឹមអារ៉ាយ", "+ MRI"],
    ["☆ បន្ទាន់", "☆ Urgent"],
    ["បញ្ជាក់ការយកសំណាក", "Confirm Specimen Collection"],
    ["ទទួលសំណើវេជ្ជបណ្ឌិត", "Receive Doctor Order"],
    ["យកសំណាកម្តងទៀត", "Recollect Specimen"],
    ["ផ្នែកបញ្ជាក់ថាបានឃើញ", "Ward Mark as Seen"],
    ["បញ្ជាក់ទទួលលទ្ធផលបន្ទាន់", "Acknowledge Critical Result"],
    ["បញ្ជាក់ថាបានឃើញ", "Confirm Seen"],
    ["បានឃើញដោយ", "Seen by"],
    ["នៅ", "at"],
    ["បញ្ជូនសំណាកទៅមន្ទីរពិសោធន៍", "Send specimen to Laboratory"],
    ["បញ្ជូនសំណើទៅរូបភាពវេជ្ជសាស្ត្រ", "Send request to Imaging"],
    ["ពិនិត្យលេខហៅអ្នកជំងឺ", "Patient Calling Display"],
    ["ស្វែងរកអ្នកជំងឺ", "Search patients"],
    ["ការគ្រប់គ្រងជួរឈរ", "Manage columns"],
    ["កំណត់ឡើងវិញ", "Reset filters"],
    ["រក្សាទុក និងផ្ញើវេជ្ជបញ្ជាទៅឱសថស្ថាន", "Save and Send Prescription to Pharmacy"],
    ["ពិនិត្យទិន្នន័យ PMRS2", "Review PMRS2 Data"],
    ["ត្រឡប់ក្រោយ", "Back"],
    ["រក្សាទុក និងបន្ត", "Save and Continue"],
    ["ដំណើរការថែទាំឆ្មប", "Midwifery Care Process"],
    ["សម្រាលកូន", "Delivery"],
    ["កំណត់ត្រាថ្មី", "New Record"],
    ["រក្សាទុក និងបញ្ចេញអ្នកជំងឺ", "Save and Discharge Patient"],
    ["មើល", "View"],
    ["ផ្នែក", "Ward"],
    ["ចូល", "Entry"],
    ["រង់ចាំអនុម័តចូលសម្រាក IPD", "Awaiting IPD Admission Approval"],
    ["មិនមានការចូលសម្រាក IPD រង់ចាំការអនុម័តទេ។", "No IPD admissions are awaiting your approval."],
    ["ស៊ីធី", "CT"], ["អឹមអារ៉ាយ", "MRI"],
    ["កំណែសាកល្បង", "Demo Version"],
  ];
  const khToEn = new Map();
  const enToKh = new Map();
  for (const [kh, en] of [...labFilterPairs, ...manualPairs, ...(window.BORKEO_EMR_LANGUAGE_PAIRS || [])]) {
    if (!kh || !en || /[<>]/.test(kh) || /[<>]/.test(en)) continue;
    if (!khToEn.has(kh)) khToEn.set(kh, en);
    if (!enToKh.has(en)) enToKh.set(en, kh);
  }

  const controlKh = new Map();
  const plainLabel = value => {
    const holder = document.createElement('span'); holder.innerHTML = value;
    return holder.textContent.replace(/\s+/g, ' ').trim();
  };
  const khLabel = value => value.replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, '').trim();
  function addControlPair(kh, en) {
    kh = plainLabel(kh || ''); en = plainLabel(en || '');
    if (!kh || !en) return;
    const canonical = khLabel(enToKh.get(en) || kh);
    controlKh.set(kh,canonical);
    if (!controlKh.has(en)) controlKh.set(en,canonical);
    // The canonical Khmer variant must also switch back to English.
    if (!khToEn.has(kh)) khToEn.set(kh,en);
    if (!khToEn.has(canonical)) khToEn.set(canonical,en);
  }
  for (const pair of [...labFilterPairs, ...manualPairs, ...(window.BORKEO_EMR_LANGUAGE_PAIRS || [])]) addControlPair(...pair);
  if (window.dictionary?.khmer && window.dictionary?.english) {
    for (const [key,kh] of Object.entries(window.dictionary.khmer)) addControlPair(kh,window.dictionary.english[key]);
  }

  let language = 'kh';
  try { language = englishDisabled ? 'kh' : (sessionStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'kh'); } catch { language = 'kh'; }
  const textState = new WeakMap();
  const attributeState = new WeakMap();
  let switcher;
  const controlSelector = 'button,a[href],[role="button"],summary,input[type="button"],input[type="submit"]';

  function exactTranslation(source, target) {
    const trimmed = String(source || '').replace(/\s+/g, ' ').trim();
    if (!trimmed || trimmed === cashNotice) return null;
    const map = target === 'en' ? khToEn : enToKh;
    const numbered = trimmed.match(/^(\d+\.\s+)(.+)$/);
    if(numbered && map.has(numbered[2])) return numbered[1]+map.get(numbered[2]);
    const count = trimmed.match(/^(\d+) (Test|តេស្ត)$/);
    if(count) return count[1]+' '+(target==='en'?'Test':'តេស្ត');
    const translated = map.get(trimmed);
    return translated == null ? null : translated;
  }

  function excluded(element, allowParaclinic = false, attribute = false) {
    const controls = attribute ? 'select:not([data-ui-language]),option:not([data-ui-language])' : 'textarea,input,select:not([data-ui-language]),option:not([data-ui-language])';
    if (element?.closest(`script,style,${controls},[contenteditable="true"],.lab-print-pages,.imaging-print-report,[data-language-exclude],.patient-primary,.patient-name,.patient-secondary,[data-patient-value],.clinical-user-data`)) return true;
    return !allowParaclinic && Boolean(element?.closest('.paraclinic-panel,.paraclinic-modal'));
  }

  function translateTextNode(node, targetLanguage = language, allowParaclinic = false) {
    if (!node?.parentElement || excluded(node.parentElement, allowParaclinic)) return;
    if (!englishOnly && node.parentElement.closest(controlSelector)) return translateControlNode(node);
    const current = node.data;
    const prior = textState.get(node);
    const source = prior?.rendered === current ? prior.source : current;
    const leading = source.match(/^\s*/)?.[0] || '';
    const trailing = source.match(/\s*$/)?.[0] || '';
    const core = source.slice(leading.length, source.length - trailing.length || source.length);
    const mapped = exactTranslation(core, targetLanguage);
    const rendered = mapped == null ? source : `${leading}${mapped}${trailing}`;
    textState.set(node, { source, rendered });
    if (current !== rendered) node.data = rendered;
  }

  function translateAttribute(element, name, targetLanguage = language, allowParaclinic = false) {
    if (excluded(element, allowParaclinic, true)) return;
    const current = element.getAttribute(name);
    if (!current) return;
    let state = attributeState.get(element);
    if (!state) { state = Object.create(null); attributeState.set(element, state); }
    const prior = state[name];
    const source = prior?.rendered === current ? prior.source : current;
    const mapped = exactTranslation(source, targetLanguage);
    const rendered = mapped == null ? source : mapped;
    state[name] = { source, rendered };
    if (current !== rendered) element.setAttribute(name, rendered);
  }

  function translateTree(root = document.body, targetLanguage = language, allowParaclinic = false) {
    if (!root || (emrPage && !allowParaclinic)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (emrPage && allowParaclinic && node.parentElement?.closest(controlSelector)) translateControlNode(node);
      else translateTextNode(node, targetLanguage, allowParaclinic);
    });
    const elements = [];
    if (root.nodeType === Node.ELEMENT_NODE) elements.push(root);
    root.querySelectorAll?.('*').forEach(element => elements.push(element));
    elements.forEach(element => {
      ['placeholder', 'title', 'aria-label', 'alt'].forEach(name => translateAttribute(element, name,
        emrPage && allowParaclinic && element.closest(controlSelector) ? language : targetLanguage, allowParaclinic));
    });
    if (root === document.body && document.title && !allowParaclinic) {
      const translatedTitle = exactTranslation(document.title, targetLanguage);
      if (translatedTitle) document.title = translatedTitle;
    }
  }

  function translateParaclinicPanels() {
    if (!emrPage) return;
    document.querySelectorAll('.paraclinic-panel,.paraclinic-modal').forEach(panel => translateTree(panel, 'en', true));
  }

  function controlTranslation(source) {
    const trimmed = String(source || '').replace(/\s+/g, ' ').trim();
    let mapped = language === 'kh' ? controlKh.get(trimmed) || enToKh.get(trimmed) : khToEn.get(trimmed);
    if (mapped != null) return mapped;
    // Keep existing icons and sequence numbers around their translated labels.
    const decorated = trimmed.match(/^([+＋✓☆🔔↻✎☷▦№⇢▣✚◉៛▥⚙\d.\s]*)(.*?)([+➔›\s]*)$/u);
    if (decorated && decorated[2] && decorated[2] !== trimmed) {
      mapped = language === 'kh' ? controlKh.get(decorated[2]) || enToKh.get(decorated[2]) : khToEn.get(decorated[2]);
      if (mapped != null) return decorated[1] + mapped + decorated[3];
    }
    const imaging = trimmed.match(/^(?:Send patient to|បញ្ជូនអ្នកជំងឺទៅ) (Ultrasound|X-ray|CT|MRI|អ៊ុលត្រាសោន|កាំរស្មីអ៊ិច|ស៊ីធី|អឹមអារ៉ាយ)$/);
    if (imaging) return (language === 'kh' ? 'បញ្ជូនអ្នកជំងឺទៅ ' : 'Send patient to ') +
      (language === 'kh' ? controlKh.get(imaging[1]) || enToKh.get(imaging[1]) || imaging[1] : khToEn.get(imaging[1]) || imaging[1]);
    return null;
  }

  function translateControlNode(node) {
    if (!node?.parentElement?.closest(controlSelector) || excluded(node.parentElement,true)) return;
    const current=node.data, prior=textState.get(node);
    const source=prior?.rendered===current ? prior.source : current;
    const mapped=controlTranslation(source);
    const renderedSource=mapped == null ? source.trim() : mapped;
    const rendered=(source.match(/^\s*/)?.[0] || '') + renderedSource + (source.match(/\s*$/)?.[0] || '');
    textState.set(node,{source,rendered});
    if (current !== rendered) node.data=rendered;
  }

  function translateControls(root=document.body) {
    if (!root || englishOnly) return;
    const controls=[];
    if (root.matches?.(controlSelector)) controls.push(root);
    root.querySelectorAll?.(controlSelector).forEach(control=>controls.push(control));
    for (const control of controls) {
      const walker=control.ownerDocument.createTreeWalker(control,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()) translateControlNode(walker.currentNode);
      ['title','aria-label'].forEach(name=>translateAttribute(control,name,language,true));
      if (control.matches('input[type="button"],input[type="submit"]')) {
        const mapped=controlTranslation(control.value); if(mapped != null) control.value=mapped;
      }
    }
  }

  // Run incremental translation outside the MutationObserver microtask. Keep one
  // pending entry per changed node and yield between small batches so input and
  // paint cannot be starved by a large clinical form update.
  function observeTranslations(root, translateNode, options) {
    const pending = new Set();
    let timer = null;
    const enqueue = records => {
      for (const record of records) {
        if (record.type === 'childList') {
          for (const node of record.addedNodes) pending.add(node);
        } else pending.add(record.target);
      }
      if (pending.size && timer === null) timer = setTimeout(flush, 0);
    };
    const observer = new MutationObserver(enqueue);
    function flush() {
      timer = null;
      // Capture mutations queued since the last callback before disconnecting.
      enqueue(observer.takeRecords());
      if (timer !== null) { clearTimeout(timer); timer = null; }
      observer.disconnect();
      const started = performance.now();
      const covered = new Set();
      try {
        for (const node of pending) {
          pending.delete(node);
          if (node.isConnected && (node === root || root.contains(node))) {
            // If an ancestor is also pending, it will cover this subtree once.
            let parent = node.parentNode;
            while (parent && !pending.has(parent) && !covered.has(parent)) parent = parent.parentNode;
            if (!parent) { translateNode(node); covered.add(node); }
          }
          if (performance.now() - started >= 8) break;
        }
      } finally {
        observer.observe(root, options);
        if (pending.size && timer === null) timer = setTimeout(flush, 0);
      }
    }
    observer.observe(root, options);
    return observer;
  }

  function translateChangedNode(node, frameOnly = false) {
    if (!node || (node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.ELEMENT_NODE)) return;
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element || excluded(element, true)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      if (frameOnly) translateControlNode(node);
      else if (!emrPage) translateTextNode(node);
      else if (element.closest('.paraclinic-panel,.paraclinic-modal')) translateTextNode(node, 'en', true);
      if (!frameOnly && !englishOnly) translateControlNode(node);
      return;
    }
    if (!frameOnly) {
      if (!emrPage) translateTree(node);
      else if (element.closest('.paraclinic-panel,.paraclinic-modal')) translateTree(node, 'en', true);
      else node.querySelectorAll('.paraclinic-panel,.paraclinic-modal').forEach(panel => translateTree(panel, 'en', true));
    }
    translateControls(node);
  }

  const frameObservers=new WeakMap();
  function translateFrame(frame) {
    if (!frame.matches('.opd-specialty-frame,#partograph_frame')) return;
    try {
      const doc=frame.contentDocument; if(!doc?.body) return;
      const previous = frameObservers.get(doc);
      previous?.disconnect();
      try { translateControls(doc.body); }
      finally {
        if (previous) previous.observe(doc.body, {subtree:true,childList:true,characterData:true});
        else frameObservers.set(doc, observeTranslations(doc.body,
          node => translateChangedNode(node, true), {subtree:true,childList:true,characterData:true}));
      }
    } catch {}
  }
  function translateInterfaceControls() {
    translateControls();
    document.querySelectorAll('iframe').forEach(translateFrame);
  }
  document.addEventListener('load',event=>{
    if (event.target?.tagName==='IFRAME') translateFrame(event.target);
  },true);

  function updateButtons() {
    try {
      document.querySelectorAll('.emr-language-switch, [data-emr-language], #langBtn, .lang-btn').forEach(el => el.remove());
    } catch {}
  }

  function mountSwitcher() {
    try {
      document.querySelectorAll('.emr-language-switch, [data-emr-language], #langBtn, .lang-btn').forEach(el => el.remove());
    } catch {}
  }

  function setLanguage(next) {
    if (englishOnly || (typeof englishDisabled !== 'undefined' && englishDisabled)) return;
    if (language === (next === 'en' ? 'en' : 'kh')) return;
    language = next === 'en' ? 'en' : 'kh';
    try { sessionStorage.setItem(STORAGE_KEY, language); } catch {}
    document.documentElement.lang = language === 'en' ? 'en' : 'km';
    updateButtons();
    window.dispatchEvent(new CustomEvent('borkeo-language-change', { detail: { language } }));
  }

  window.setBorkeoLanguage = setLanguage;
  window.getBorkeoLanguage = () => language;
  let languageObserver = null;
  const languageObservation = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'] };
  window.addEventListener('borkeo-language-change', event => {
    languageObserver?.disconnect();
    try {
    if (emrPage && typeof window.applyEmrLanguage === 'function') {
      window.applyEmrLanguage(event.detail?.language === 'en' ? 'english' : 'khmer');
      translateParaclinicPanels();
    } else translateTree();
    translateInterfaceControls();
    updateButtons();
    } finally { languageObserver?.observe(document.body, languageObservation); }
  });

  const medicalDialogActive = () => englishOnly || Boolean(document.querySelector('.paraclinic-modal') || document.activeElement?.closest('.paraclinic-panel'));
  const rawAlert = window.alert.bind(window);
  window.alert = message => {
    const source = String(message ?? '');
    if (source === cashNotice || medicalDialogActive()) return rawAlert(source);
    return rawAlert(exactTranslation(source, language) || source);
  };
  const rawConfirm = window.confirm.bind(window);
  window.confirm = message => {
    const source = String(message ?? '');
    if (source === cashNotice || medicalDialogActive()) return rawConfirm(source);
    return rawConfirm(exactTranslation(source, language) || source);
  };

  document.documentElement.lang = language === 'en' ? 'en' : 'km';
  if (englishDisabled) {
    if (emrPage && typeof window.applyEmrLanguage === 'function') {
      window.applyEmrLanguage('khmer');
    }
  } else if (englishOnly) {
    document.documentElement.lang = 'en';
    translateTree();
  } else {
    mountSwitcher();
    if (emrPage && typeof window.applyEmrLanguage === 'function') {
      window.applyEmrLanguage(language === 'en' ? 'english' : 'khmer');
      translateParaclinicPanels();
    } else translateTree();
  }
  mountSwitcher();
  if (englishDisabled) {
    document.addEventListener('DOMContentLoaded', mountSwitcher, { once: true });
  }
  if (!englishDisabled) {
    window.addEventListener('emr-session-ready', mountSwitcher);
    document.addEventListener('DOMContentLoaded', mountSwitcher, { once: true });
  }

  if (document.body && !englishDisabled) {
    languageObserver = observeTranslations(document.body, translateChangedNode, languageObservation);
    translateParaclinicPanels();
    translateInterfaceControls();
  }
})();
