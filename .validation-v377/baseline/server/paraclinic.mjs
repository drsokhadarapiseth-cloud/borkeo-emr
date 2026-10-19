import {REFERENCE_DEFAULTS} from './lab-reference-defaults.mjs';
import {clinicalLimits,displayLimits,resultFlag,convertValue,unitRule,rebaseTest,LIMIT_KEYS} from '../public/lab-reference.mjs';
import { IMAGING_SUBTYPE_DETAILS } from './access.mjs';
import crypto from 'node:crypto';

const CATALOG = [
  // Hematology
  ['CBC','Complete Blood Count / FBC','Hematology','','EDTA whole blood','',[],null,null,null,null],
  ['HGB','Hemoglobin','Hematology','718-7','EDTA whole blood','g/dL',[['g/dL',1,0],['g/L',0.1,0]],12.0,15.0,7.0,20.0],
  ['HCT','Hematocrit','Hematology','4544-3','EDTA whole blood','%',[['%',1,0],['L/L',100,0]],36.0,48.0,20.0,60.0],
  ['RBC','Red Blood Cell Count','Hematology','789-8','EDTA whole blood','10^12/L',[['10^12/L',1,0],['10^6/µL',1,0]],3.80,5.80,2.00,7.00],
  ['WBC','White Blood Cell Count','Hematology','6690-2','EDTA whole blood','10^9/L',[['10^9/L',1,0],['10^3/µL',1,0],['/mm^3',0.001,0]],4.0,10.0,2.0,30.0],
  ['PLT','Platelet Count','Hematology','777-3','EDTA whole blood','10^9/L',[['10^9/L',1,0],['10^3/µL',1,0]],150,450,20,1000],
  ['NEUT','Neutrophils','Hematology','','EDTA whole blood','%',[['%',1,0]],40.0,75.0,10.0,null],
  ['LYMPH','Lymphocytes','Hematology','','EDTA whole blood','%',[['%',1,0]],20.0,45.0,null,null],
  ['MONO','Monocytes','Hematology','','EDTA whole blood','%',[['%',1,0]],2.0,10.0,null,null],
  ['EOS','Eosinophils','Hematology','','EDTA whole blood','%',[['%',1,0]],0.0,6.0,null,null],
  ['BASO','Basophils','Hematology','','EDTA whole blood','%',[['%',1,0]],0.0,2.0,null,null],
  ['MCV','Mean Corpuscular Volume','Hematology','','EDTA whole blood','fL',[['fL',1,0]],80.0,100.0,null,null],
  ['MCH','Mean Corpuscular Hemoglobin','Hematology','','EDTA whole blood','pg',[['pg',1,0]],27.0,33.0,null,null],
  ['MCHC','Mean Corpuscular Hemoglobin Concentration','Hematology','','EDTA whole blood','g/dL',[['g/dL',1,0],['g/L',0.1,0]],32.0,36.0,null,null],
  ['RDW','Red Cell Distribution Width','Hematology','','EDTA whole blood','%',[['%',1,0]],11.5,14.5,null,null],
  ['MPV','Mean Platelet Volume','Hematology','','EDTA whole blood','fL',[['fL',1,0]],7.4,10.4,null,null],
  ['ESR','Erythrocyte Sedimentation Rate','Hematology','','EDTA whole blood','mm/h',[['mm/h',1,0]],0.0,20.0,null,null],
  ['RETIC','Reticulocyte Count','Hematology','','EDTA whole blood','%',[['%',1,0]],0.5,2.5,null,null],
  ['BLOOD_FILM','Peripheral Blood Film','Hematology','','EDTA whole blood','',[],null,null,null,null],
  ['G6PD','G6PD Screening','Hematology','','Whole blood','',[],null,null,null,null],
  ['HB_ELECTROPHORESIS','Hemoglobin Electrophoresis','Hematology','','EDTA whole blood','',[],null,null,null,null],
  ['SICKLE_SCREEN','Sickle Cell Screen','Hematology','','Whole blood','',[],null,null,null,null],
  // Coagulation
  ['COAG_PROFILE','Coagulation Profile','Coagulation','','Citrated plasma','',[],null,null,null,null],
  ['PT','Prothrombin Time','Coagulation','','Citrated plasma','s',[['s',1,0]],11.0,14.5,null,30.0],
  ['INR','International Normalized Ratio','Coagulation','','Citrated plasma','ratio',[['ratio',1,0]],0.85,1.15,null,5.0],
  ['APTT','Activated Partial Thromboplastin Time','Coagulation','','Citrated plasma','s',[['s',1,0]],25.0,38.0,null,70.0],
  ['FIB','Fibrinogen','Coagulation','','Citrated plasma','g/L',[['g/L',1,0],['mg/dL',0.01,0]],2.0,4.0,1.0,7.0],
  ['DDIMER','D-dimer','Coagulation','','Citrated plasma','ng/mL FEU',[['ng/mL FEU',1,0],['µg/mL FEU',1000,0],['mg/L FEU',1000,0]],0.0,500.0,null,2000.0],
  // Renal Function & Electrolytes
  ['RENAL_PROFILE','Renal Function / Electrolyte Profile','Renal Function','','Serum/Plasma','',[],null,null,null,null],
  ['ELECTROLYTE_PROFILE','Electrolyte Profile','Electrolytes','','Serum/Plasma','',[],null,null,null,null],
  ['UREA','Urea','Renal Function','','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mg/dL',0.1665,0]],2.5,7.1,null,35.0],
  ['BUN','Blood Urea Nitrogen','Renal Function','3094-0','Serum/Plasma','mg/dL',[['mg/dL',1,0],['mmol/L',2.801,0]],7.0,20.0,null,100.0],
  ['CREAT','Creatinine','Renal Function','2160-0','Serum/Plasma','µmol/L',[['µmol/L',1,0],['mg/dL',88.4,0]],60.0,110.0,null,450.0],
  ['URIC','Uric Acid','Renal Function','','Serum/Plasma','µmol/L',[['µmol/L',1,0],['mg/dL',59.48,0]],180.0,420.0,null,null],
  ['NA','Sodium','Electrolytes','2951-2','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mEq/L',1,0]],135.0,145.0,120.0,160.0],
  ['K','Potassium','Electrolytes','2823-3','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mEq/L',1,0]],3.5,5.1,2.8,6.2],
  ['CL','Chloride','Electrolytes','2075-0','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mEq/L',1,0]],98.0,107.0,80.0,120.0],
  ['HCO3','Bicarbonate / Total CO2','Electrolytes','2028-9','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mEq/L',1,0]],22.0,29.0,10.0,40.0],
  ['CA','Calcium','Electrolytes','','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mg/dL',0.2495,0]],2.15,2.55,1.65,3.25],
  ['MG','Magnesium','Electrolytes','','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mg/dL',0.4114,0]],0.70,1.05,0.40,2.00],
  ['PHOS','Phosphate','Electrolytes','','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mg/dL',0.3229,0]],0.80,1.50,0.30,2.70],
  // Clinical Chemistry
  ['GLU','Glucose','Clinical Chemistry','2345-7','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mg/dL',0.0555,0]],3.9,5.6,2.5,25.0],
  ['HBA1C','HbA1c','Clinical Chemistry','4548-4','EDTA whole blood','%',[['%',1,0],['mmol/mol',0.09148,2.152]],4.0,5.6,null,12.0],
  ['AMYLASE','Amylase','Clinical Chemistry','','Serum/Plasma','U/L',[['U/L',1,0]],28.0,100.0,null,300.0],
  ['LIPASE','Lipase','Clinical Chemistry','','Serum/Plasma','U/L',[['U/L',1,0]],13.0,60.0,null,200.0],
  ['LDH','Lactate Dehydrogenase','Clinical Chemistry','','Serum/Plasma','U/L',[['U/L',1,0]],140.0,280.0,null,null],
  ['CK','Creatine Kinase / CK','Clinical Chemistry','','Serum/Plasma','U/L',[['U/L',1,0]],30.0,200.0,null,1000.0],
  ['LACTATE','Lactate','Clinical Chemistry','','Whole blood/Plasma','mmol/L',[['mmol/L',1,0],['mg/dL',0.111,0]],0.5,2.2,null,4.0],
  ['TP','Total Protein','Clinical Chemistry','','Serum/Plasma','g/L',[['g/L',1,0],['g/dL',10,0]],64.0,83.0,null,null],
  // Liver Function
  ['LIVER_PROFILE','Liver Function Profile','Liver Function','','Serum/Plasma','',[],null,null,null,null],
  ['AST','AST / SGOT','Liver Function','1920-8','Serum/Plasma','U/L',[['U/L',1,0]],10.0,40.0,null,500.0],
  ['ALT','ALT / SGPT','Liver Function','1742-6','Serum/Plasma','U/L',[['U/L',1,0]],7.0,56.0,null,500.0],
  ['ALP','Alkaline Phosphatase','Liver Function','6768-6','Serum/Plasma','U/L',[['U/L',1,0]],44.0,147.0,null,null],
  ['GGT','Gamma-glutamyl Transferase','Liver Function','','Serum/Plasma','U/L',[['U/L',1,0]],9.0,48.0,null,null],
  ['TBIL','Total Bilirubin','Liver Function','1975-2','Serum/Plasma','µmol/L',[['µmol/L',1,0],['mg/dL',17.1,0]],3.4,20.5,null,250.0],
  ['DBIL','Direct Bilirubin','Liver Function','','Serum/Plasma','µmol/L',[['µmol/L',1,0],['mg/dL',17.1,0]],0.0,5.1,null,null],
  ['ALB','Albumin','Liver Function','1751-7','Serum/Plasma','g/L',[['g/L',1,0],['g/dL',10,0]],35.0,50.0,20.0,null],
  // Lipid Profile
  ['LIPID_PROFILE','Lipid Profile Panel','Lipid Profile','','Serum/Plasma','',[],null,null,null,null],
  ['CHOL','Total Cholesterol','Lipid Profile','','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mg/dL',0.02586,0]],3.0,5.2,null,null],
  ['TG','Triglycerides','Lipid Profile','','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mg/dL',0.01129,0]],0.4,1.7,null,11.3],
  ['HDL','HDL Cholesterol','Lipid Profile','','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mg/dL',0.02586,0]],1.0,1.6,null,null],
  ['LDL','LDL Cholesterol','Lipid Profile','','Serum/Plasma','mmol/L',[['mmol/L',1,0],['mg/dL',0.02586,0]],1.8,3.4,null,null],
  // Cardiac Markers
  ['TROP_I','Troponin I','Cardiac Markers','','Serum/Plasma','ng/L',[['ng/L',1,0],['ng/mL',1000,0],['µg/L',1000,0]],0.0,14.0,null,50.0],
  ['TROP_T','Troponin T','Cardiac Markers','','Serum/Plasma','ng/L',[['ng/L',1,0],['ng/mL',1000,0],['µg/L',1000,0]],0.0,14.0,null,50.0],
  ['CKMB','CK-MB','Cardiac Markers','','Serum/Plasma','ng/mL',[['ng/mL',1,0]],0.0,5.0,null,25.0],
  ['BNP','BNP','Cardiac Markers','','EDTA plasma','pg/mL',[['pg/mL',1,0],['ng/L',1,0]],0.0,100.0,null,400.0],
  // Hormones / Endocrinology
  ['THYROID_PROFILE','Thyroid Function Profile','Hormones / Endocrinology','','Serum/Plasma','',[],null,null,null,null],
  ['TSH','TSH','Hormones / Endocrinology','3016-3','Serum/Plasma','mIU/L',[['mIU/L',1,0],['µIU/mL',1,0]],0.4,4.0,0.1,10.0],
  ['FT4','Free T4','Hormones / Endocrinology','3024-7','Serum/Plasma','pmol/L',[['pmol/L',1,0],['ng/dL',12.87,0]],12.0,22.0,null,null],
  ['FT3','Free T3','Hormones / Endocrinology','','Serum/Plasma','pmol/L',[['pmol/L',1,0],['pg/mL',1.536,0]],3.1,6.8,null,null],
  ['BHCG','Beta-hCG','Hormones / Endocrinology','','Serum','IU/L',[['IU/L',1,0],['mIU/mL',1,0]],0.0,5.0,null,null],
  ['FSH','FSH','Hormones / Endocrinology','','Serum','IU/L',[['IU/L',1,0],['mIU/mL',1,0]],1.5,12.5,null,null],
  ['LH','LH','Hormones / Endocrinology','','Serum','IU/L',[['IU/L',1,0],['mIU/mL',1,0]],1.7,8.6,null,null],
  ['PROLACTIN','Prolactin','Hormones / Endocrinology','','Serum','mIU/L',[['mIU/L',1,0],['ng/mL',21.2,0]],100.0,500.0,null,null],
  ['ESTRADIOL','Estradiol','Hormones / Endocrinology','','Serum','pmol/L',[['pmol/L',1,0]],70.0,1000.0,null,null],
  ['PROGEST','Progesterone','Hormones / Endocrinology','','Serum','nmol/L',[['nmol/L',1,0]],1.0,60.0,null,null],
  ['TESTOST','Testosterone','Hormones / Endocrinology','','Serum','nmol/L',[['nmol/L',1,0]],8.0,30.0,null,null],
  ['CORTISOL','Cortisol','Hormones / Endocrinology','','Serum','nmol/L',[['nmol/L',1,0]],140.0,690.0,null,null],
  // Tumor Markers
  ['AFP','Alpha-fetoprotein','Tumor Markers','','Serum','ng/mL',[['ng/mL',1,0]],0.0,10.0,null,null],
  ['CEA','CEA','Tumor Markers','','Serum','ng/mL',[['ng/mL',1,0]],0.0,5.0,null,null],
  ['CA125','CA-125','Tumor Markers','','Serum','U/mL',[['U/mL',1,0]],0.0,35.0,null,null],
  ['CA199','CA 19-9','Tumor Markers','','Serum','U/mL',[['U/mL',1,0]],0.0,37.0,null,null],
  ['CA153','CA 15-3','Tumor Markers','','Serum','U/mL',[['U/mL',1,0]],0.0,30.0,null,null],
  ['PSA','PSA','Tumor Markers','','Serum','ng/mL',[['ng/mL',1,0]],0.0,4.0,null,null],
  // Iron & Nutrition
  ['FERRITIN','Ferritin','Iron / Nutrition','','Serum','ng/mL',[['ng/mL',1,0],['µg/L',1,0]],30.0,400.0,null,null],
  ['IRON','Serum Iron','Iron / Nutrition','','Serum','µmol/L',[['µmol/L',1,0],['µg/dL',0.179,0]],10.0,30.0,null,null],
  ['TIBC','Total Iron Binding Capacity','Iron / Nutrition','','Serum','µmol/L',[['µmol/L',1,0],['µg/dL',0.179,0]],45.0,75.0,null,null],
  ['TRANSFERRIN','Transferrin','Iron / Nutrition','','Serum','g/L',[['g/L',1,0],['mg/dL',0.01,0]],2.0,3.6,null,null],
  ['VITB12','Vitamin B12','Vitamins / Nutrition','','Serum','pmol/L',[['pmol/L',1,0],['pg/mL',0.738,0]],150.0,700.0,null,null],
  ['FOLATE','Folate','Vitamins / Nutrition','','Serum','nmol/L',[['nmol/L',1,0],['ng/mL',2.266,0]],10.0,45.0,null,null],
  ['VITD25','25-OH Vitamin D','Vitamins / Nutrition','','Serum','nmol/L',[['nmol/L',1,0],['ng/mL',2.496,0]],50.0,125.0,null,null],
  // Immunology / Serology
  ['CRP','C-reactive Protein','Immunology / Serology','1988-5','Serum/Plasma','mg/L',[['mg/L',1,0],['mg/dL',10,0]],0.0,5.0,null,100.0],
  ['PCT','Procalcitonin','Immunology / Serology','','Serum/Plasma','ng/mL',[['ng/mL',1,0],['µg/L',1,0]],0.0,0.5,null,2.0],
  ['RF','Rheumatoid Factor','Immunology / Serology','','Serum','IU/mL',[['IU/mL',1,0]],0.0,20.0,null,null],
  ['ASO','ASO Titer','Immunology / Serology','','Serum','IU/mL',[['IU/mL',1,0]],0.0,200.0,null,null],
  ['ANA','Antinuclear Antibody / ANA','Immunology / Serology','','Serum','',[],null,null,null,null],
  ['ANTI_DSDNA','Anti-dsDNA','Immunology / Serology','','Serum','IU/mL',[['IU/mL',1,0]],0.0,30.0,null,null],
  ['C3','Complement C3','Immunology / Serology','','Serum','g/L',[['g/L',1,0],['mg/dL',0.01,0]],0.9,1.8,null,null],
  ['C4','Complement C4','Immunology / Serology','','Serum','g/L',[['g/L',1,0],['mg/dL',0.01,0]],0.1,0.4,null,null],
  ['HIV','HIV Ag/Ab','Immunology / Serology','','Serum/Plasma','',[],null,null,null,null],
  ['HBSAG','HBsAg','Immunology / Serology','','Serum/Plasma','',[],null,null,null,null],
  ['HCV','Anti-HCV','Immunology / Serology','','Serum/Plasma','',[],null,null,null,null],
  ['RPR','RPR / VDRL','Immunology / Serology','','Serum/Plasma','',[],null,null,null,null],
  ['TPHA','TPHA / Treponemal test','Immunology / Serology','','Serum/Plasma','',[],null,null,null,null],
  // RDT / Rapid Tests
  ['MALARIA_RDT','Malaria RDT','RDT / Rapid Tests','','Whole blood','',[],null,null,null,null],
  ['DENGUE_NS1','Dengue NS1 RDT','RDT / Rapid Tests','','Serum/Plasma','',[],null,null,null,null],
  ['DENGUE_IGMIGG','Dengue IgM/IgG RDT','RDT / Rapid Tests','','Serum/Plasma','',[],null,null,null,null],
  ['PREG_RDT','Pregnancy Test / hCG RDT','RDT / Rapid Tests','','Urine/Serum','',[],null,null,null,null],
  ['COVID_RDT','COVID-19 Antigen RDT','RDT / Rapid Tests','','Respiratory specimen','',[],null,null,null,null],
  ['INFLUENZA_RDT','Influenza A/B RDT','RDT / Rapid Tests','','Respiratory specimen','',[],null,null,null,null],
  ['SYPHILIS_RDT','Syphilis Rapid Test','RDT / Rapid Tests','','Whole blood/Serum/Plasma','',[],null,null,null,null],
  ['HBV_RDT','HBsAg Rapid Test','RDT / Rapid Tests','','Whole blood/Serum/Plasma','',[],null,null,null,null],
  ['HCV_RDT','Anti-HCV Rapid Test','RDT / Rapid Tests','','Whole blood/Serum/Plasma','',[],null,null,null,null],
  ['HIV_RDT','HIV Rapid Test','RDT / Rapid Tests','','Whole blood/Serum/Plasma','',[],null,null,null,null],
  ['TYPHOID_RDT','Typhoid Rapid Test','RDT / Rapid Tests','','Whole blood/Serum/Plasma','',[],null,null,null,null],
  ['ROTAVIRUS_RDT','Rotavirus Antigen RDT','RDT / Rapid Tests','','Stool','',[],null,null,null,null],
  ['H_PYLORI_RDT','H. pylori Rapid Test','RDT / Rapid Tests','','Blood/Stool as kit specifies','',[],null,null,null,null],
  // Urinalysis & Stool
  ['UA','Urinalysis','Urinalysis','','Urine','',[],null,null,null,null],
  ['URINE_PROT','Urine Protein','Urinalysis','','Urine','mg/dL',[['mg/dL',1,0],['g/L',100,0]],0.0,14.0,null,null],
  ['URINE_GLU','Urine Glucose','Urinalysis','','Urine','',[],null,null,null,null],
  ['URINE_KET','Urine Ketone','Urinalysis','','Urine','',[],null,null,null,null],
  ['URINE_MICROALB','Urine Microalbumin','Urinalysis','','Urine','mg/L',[['mg/L',1,0],['mg/dL',10,0]],0.0,30.0,null,null],
  ['UPCR','Urine Protein/Creatinine Ratio','Urinalysis','','Urine','mg/mmol',[['mg/mmol',1,0]],0.0,15.0,null,null],
  ['ACR','Urine Albumin/Creatinine Ratio','Urinalysis','','Urine','mg/mmol',[['mg/mmol',1,0]],0.0,3.0,null,null],
  ['STOOL_EXAM','Stool Examination','Stool Examination','','Stool','',[],null,null,null,null],
  ['FOBT','Fecal Occult Blood Test','Stool Examination','','Stool','',[],null,null,null,null],
  ['STOOL_OP','Stool Ova & Parasite','Parasitology','','Stool','',[],null,null,null,null],
  ['MALARIA_SMEAR','Malaria Thick/Thin Smear','Parasitology','','Whole blood','',[],null,null,null,null],
  // Microbiology
  ['BLOOD_CULT','Blood Culture','Microbiology','','Blood','',[],null,null,null,null],
  ['URINE_CULT','Urine Culture & Sensitivity','Microbiology','','Urine','',[],null,null,null,null],
  ['SPUTUM_CULT','Sputum Culture','Microbiology','','Sputum','',[],null,null,null,null],
  ['WOUND_CULT','Wound Culture & Sensitivity','Microbiology','','Wound swab','',[],null,null,null,null],
  ['GRAM','Gram Stain','Microbiology','','Clinical specimen','',[],null,null,null,null],
  ['AFB','AFB Smear','Microbiology','','Sputum','',[],null,null,null,null],
  // Blood Bank / Transfusion
  ['BLOOD_GROUP','ABO / Rh Blood Group','Blood Bank / Transfusion','','EDTA whole blood','',[],null,null,null,null],
  ['CROSSMATCH','Blood Crossmatch','Blood Bank / Transfusion','','EDTA whole blood / donor unit','',[],null,null,null,null],
  ['DIRECT_COOMBS','Direct Antiglobulin Test (DAT)','Blood Bank / Transfusion','','EDTA whole blood','',[],null,null,null,null],
  ['INDIRECT_COOMBS','Indirect Antiglobulin Test (IAT)','Blood Bank / Transfusion','','Serum/Plasma','',[],null,null,null,null],
  // Molecular / special
  ['PCR_OTHER','PCR / Molecular Test','Molecular / PCR','','As specified','',[],null,null,null,null],
  ['OTHER','Other / Special Laboratory Test','Other / Special','','As specified','',[],null,null,null,null],
];

const LAB_PANELS = Object.freeze({
  CBC: ['HGB','HCT','RBC','MCV','MCH','MCHC','RDW','WBC','NEUT','LYMPH','MONO','EOS','BASO','PLT','MPV'],
  COAG_PROFILE: ['PT','INR','APTT','FIB'],
  RENAL_PROFILE: ['UREA','CREAT','NA','K','CL','HCO3'],
  ELECTROLYTE_PROFILE: ['NA','K','CL','HCO3','CA','MG','PHOS'],
  LIVER_PROFILE: ['AST','ALT','ALP','GGT','TBIL','DBIL','ALB','TP'],
  LIPID_PROFILE: ['CHOL','TG','HDL','LDL'],
  THYROID_PROFILE: ['TSH','FT4','FT3'],
});

function parseJson(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function addColumnIfMissing(sqlite, table, column, definition) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(item => item.name === column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function accessionFor(modality, createdAt = Date.now(), id = crypto.randomUUID()) {
  const date = new Date(createdAt).toISOString().slice(0, 10).replaceAll('-', '');
  const prefix = modality === 'LAB' ? 'LAB' : 'IMG';
  return `${prefix}-${date}-${String(id).replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}

function hasCriticalResult(result) {
  return Array.isArray(result?.items) && result.items.some(item => ['CRITICAL_LOW','CRITICAL_HIGH'].includes(String(item?.flag || '')));
}

export function ensureParaclinicSchema(database) {
  const sqlite = database.sqlite;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS lab_catalog (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      loinc_code TEXT NOT NULL DEFAULT '',
      specimen TEXT NOT NULL DEFAULT '',
      base_unit TEXT NOT NULL DEFAULT '',
      units_json TEXT NOT NULL DEFAULT '[]',
      reference_low REAL,
      reference_high REAL,
      critical_low REAL,
      critical_high REAL,
      reference_note TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS lab_catalog_category_idx ON lab_catalog(category, name);
    CREATE TABLE IF NOT EXISTS paraclinic_orders (
      id TEXT PRIMARY KEY,
      patient_key TEXT NOT NULL,
      modality TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'ROUTINE',
      status TEXT NOT NULL DEFAULT 'ORDERED',
      request_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL DEFAULT '{}',
      requested_by TEXT NOT NULL REFERENCES users(id),
      requested_role TEXT NOT NULL DEFAULT '',
      requested_ward TEXT NOT NULL DEFAULT '',
      performed_by TEXT REFERENCES users(id),
      validated_by TEXT REFERENCES users(id),
      reviewed_by TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      released_at INTEGER,
      reviewed_at INTEGER,
      cancelled_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS paraclinic_patient_idx ON paraclinic_orders(patient_key, created_at DESC);
    CREATE TABLE IF NOT EXISTS paraclinic_result_views (
      order_id TEXT NOT NULL REFERENCES paraclinic_orders(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      released_at INTEGER NOT NULL,
      seen_at INTEGER NOT NULL,
      first_acknowledgment INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (order_id, user_id, released_at)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS paraclinic_modality_status_idx ON paraclinic_orders(modality, status, created_at DESC);
    CREATE TABLE IF NOT EXISTS paraclinic_attachments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES paraclinic_orders(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      uploaded_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS paraclinic_attachment_order_idx ON paraclinic_attachments(order_id, uploaded_at);
    CREATE TABLE IF NOT EXISTS paraclinic_extra_fees (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES paraclinic_orders(id),
      patient_key TEXT NOT NULL,
      charge_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      service_code TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      nurse_informed_by TEXT REFERENCES users(id),
      nurse_informed_at INTEGER,
      waiver_status TEXT NOT NULL DEFAULT '' CHECK(waiver_status IN ('','PENDING','APPROVED','REJECTED')),
      waiver_reason TEXT NOT NULL DEFAULT '',
      waiver_requested_by TEXT REFERENCES users(id),
      waiver_requested_at INTEGER,
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at INTEGER,
      review_note TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE INDEX IF NOT EXISTS paraclinic_extra_fees_patient_idx ON paraclinic_extra_fees(patient_key,created_at DESC);
    CREATE INDEX IF NOT EXISTS paraclinic_extra_fees_waiver_idx ON paraclinic_extra_fees(waiver_status,created_at DESC);
    CREATE TABLE IF NOT EXISTS imaging_catalog (
      code TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_kh TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS imaging_catalog_group_idx ON imaging_catalog(group_id, name_en);
  `);
  const insertModality = sqlite.prepare(`
    INSERT OR IGNORE INTO imaging_catalog (code, group_id, name_en, name_kh, active, updated_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `);
  for (const item of (IMAGING_SUBTYPE_DETAILS || [])) {
    insertModality.run(item.code, item.group, item.nameEn, item.nameKh, Date.now());
  }
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'accession_number', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'ward_received_by', 'TEXT');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'ward_received_at', 'INTEGER');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'collected_by', 'TEXT');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'collected_at', 'INTEGER');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'sent_to_lab_by', 'TEXT');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'sent_to_lab_at', 'INTEGER');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'received_by', 'TEXT');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'received_at', 'INTEGER');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'rejected_by', 'TEXT');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'rejected_at', 'INTEGER');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'rejection_reason', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'scheduled_at', 'INTEGER');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'performed_at', 'INTEGER');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'has_critical', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'critical_ack_by', 'TEXT');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'critical_ack_at', 'INTEGER');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'critical_ack_note', "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'ward_seen_by', 'TEXT');
  addColumnIfMissing(sqlite, 'paraclinic_orders', 'ward_seen_at', 'INTEGER');
  // Retain the existing doctor's attribution when upgrading an installation.
  sqlite.exec(`INSERT OR IGNORE INTO paraclinic_result_views
    (order_id,user_id,released_at,seen_at,first_acknowledgment)
    SELECT id,reviewed_by,released_at,reviewed_at,1 FROM paraclinic_orders
    WHERE reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND released_at IS NOT NULL`);
  sqlite.exec('CREATE INDEX IF NOT EXISTS paraclinic_accession_idx ON paraclinic_orders(accession_number);');
  const missingAccessions = sqlite.prepare("SELECT id, modality, created_at FROM paraclinic_orders WHERE accession_number = ''").all();
  const setAccession = sqlite.prepare('UPDATE paraclinic_orders SET accession_number = ? WHERE id = ?');
  missingAccessions.forEach(row => setAccession.run(accessionFor(row.modality, row.created_at, row.id), row.id));
  const referenceMigrationExists = Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='lab_reference_migrations'").get());
  const alreadyMigrated = code => referenceMigrationExists && Boolean(sqlite.prepare('SELECT 1 FROM lab_reference_migrations WHERE code=?').get(code));
  const upsert = sqlite.prepare(`INSERT INTO lab_catalog
    (code,name,category,loinc_code,specimen,base_unit,units_json,reference_low,reference_high,critical_low,critical_high,reference_note,active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(code) DO NOTHING`);
  const now = Date.now();
  CATALOG.forEach(([code,name,category,loinc,specimen,baseUnit,units,low,high,critLow,critHigh]) => {
    if (alreadyMigrated(code) && !sqlite.prepare('SELECT 1 FROM lab_catalog WHERE code=?').get(code)) return;
    const unitObjects = units.map(([unit,factorToBase,offsetToBase]) => ({ unit, factorToBase, offsetToBase }));
    upsert.run(code,name,category,loinc,specimen,baseUnit,JSON.stringify(unitObjects),low,high,critLow,critHigh,
      'International starter interval; verify against the hospital method/analyzer, age, sex and pregnancy requirements.',now);
  });

  // v20.3 keeps intentional blanks and local limits. The old null-fill pass
  // restored unsourced defaults on every restart, so it is retired.


  // Migrate the built-in legacy CBC units/ranges while preserving ranges that
  // an administrator already customized. Saved result values retain their
  // chosen unit and remain convertible through the updated unit definitions.
  const legacyHgb = sqlite.prepare("SELECT base_unit,reference_low,reference_high FROM lab_catalog WHERE code='HGB'").get();
  if (legacyHgb?.base_unit === 'g/L' && !alreadyMigrated('HGB')) {
    const low = legacyHgb.reference_low === 120 ? 12 : (legacyHgb.reference_low == null ? null : legacyHgb.reference_low / 10);
    const high = legacyHgb.reference_high === 170 ? 15 : (legacyHgb.reference_high == null ? null : legacyHgb.reference_high / 10);
    sqlite.prepare("UPDATE lab_catalog SET base_unit='g/dL',units_json=?,reference_low=?,reference_high=?,updated_at=? WHERE code='HGB'")
      .run(JSON.stringify([{unit:'g/dL',factorToBase:1,offsetToBase:0},{unit:'g/L',factorToBase:0.1,offsetToBase:0}]),low,high,now);
  }
  const legacyHct = sqlite.prepare("SELECT base_unit,reference_low,reference_high,units_json FROM lab_catalog WHERE code='HCT'").get();
  if (legacyHct?.base_unit === 'L/L' && !alreadyMigrated('HCT')) {
    const low = legacyHct.reference_low === 0.36 ? 36 : (legacyHct.reference_low == null ? null : legacyHct.reference_low * 100);
    const high = legacyHct.reference_high === 0.50 ? 46 : (legacyHct.reference_high == null ? null : legacyHct.reference_high * 100);
    sqlite.prepare("UPDATE lab_catalog SET base_unit='%',units_json=?,reference_low=?,reference_high=?,updated_at=? WHERE code='HCT'")
      .run(JSON.stringify([{unit:'%',factorToBase:1,offsetToBase:0},{unit:'L/L',factorToBase:100,offsetToBase:0}]),low,high,now);
  }
  const legacyMchc = sqlite.prepare("SELECT base_unit,reference_low,reference_high FROM lab_catalog WHERE code='MCHC'").get();
  if (legacyMchc?.base_unit === 'g/L' && !alreadyMigrated('MCHC')) {
    const low = legacyMchc.reference_low == null ? 31.5 : (legacyMchc.reference_low / 10);
    const high = legacyMchc.reference_high == null ? 34.5 : (legacyMchc.reference_high / 10);
    sqlite.prepare("UPDATE lab_catalog SET base_unit='g/dL',units_json=?,reference_low=?,reference_high=?,updated_at=? WHERE code='MCHC'")
      .run(JSON.stringify([{unit:'g/dL',factorToBase:1,offsetToBase:0},{unit:'g/L',factorToBase:0.1,offsetToBase:0}]),low,high,now);
  }
  ensureReferenceDefaults(database);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS lab_report_snapshots(order_id TEXT NOT NULL,released_at INTEGER NOT NULL,result_json TEXT NOT NULL,validator_name TEXT NOT NULL DEFAULT '',PRIMARY KEY(order_id,released_at)) STRICT;
    INSERT OR IGNORE INTO lab_report_snapshots SELECT o.id,o.released_at,o.result_json,COALESCE(u.display_name,'') FROM paraclinic_orders o LEFT JOIN users u ON u.id=o.validated_by WHERE o.modality='LAB' AND o.released_at IS NOT NULL;`);
}

function ensureReferenceDefaults(database){
 const db=database.sqlite;addColumnIfMissing(db,'lab_catalog','reference_config_json',"TEXT NOT NULL DEFAULT '{}'");
 db.exec('CREATE TABLE IF NOT EXISTS lab_reference_migrations(code TEXT PRIMARY KEY,previous_json TEXT NOT NULL,applied_at INTEGER NOT NULL) STRICT;');
 const before=db.prepare('INSERT INTO lab_reference_migrations VALUES (?,?,?)');
 const update=db.prepare('UPDATE lab_catalog SET reference_low=?,reference_high=?,critical_low=?,critical_high=?,reference_note=?,reference_config_json=? WHERE code=?');
 db.exec('SAVEPOINT reference_defaults_203');try{
 for(const row of db.prepare('SELECT * FROM lab_catalog').all()){
  if(db.prepare('SELECT 1 FROM lab_reference_migrations WHERE code=?').get(row.code))continue;
  const base=CATALOG.find(t=>t[0]===row.code);const starter=base&&row.base_unit===base[5]&&row.reference_low===base[7]&&row.reference_high===base[8]&&row.reference_note.startsWith('International starter interval');
  const criticalStarter=base&&row.base_unit===base[5]&&row.critical_low===base[9]&&row.critical_high===base[10]&&row.reference_note.startsWith('International starter interval');
  const def=REFERENCE_DEFAULTS[row.code]||{};const meta={revision:'20.3',reviewed:false,referenceSource:starter?(def.referenceSource||''):'Local configuration',criticalSource:criticalStarter?(def.criticalSource||''):'Local configuration'};
  let low=row.reference_low,high=row.reference_high,cl=row.critical_low,ch=row.critical_high,note=row.reference_note;
  if(starter&&def.referenceSource){low=def.referenceLow??null;high=def.referenceHigh??null;meta.referenceRules=def.referenceRules||[];meta.referenceHighExclusive=def.referenceHighExclusive===true;meta.referenceLowExclusive=def.referenceLowExclusive===true;note=def.note||'Published starter defaults; local verification required.'}
  if(criticalStarter&&def.criticalSource){cl=def.criticalLow??null;ch=def.criticalHigh??null;meta.criticalRules=def.criticalRules||[];meta.criticalInclusive=def.criticalInclusive===true}
  if(criticalStarter&&!def.criticalSource){cl=null;ch=null}
  if(!meta.referenceSource){note=row.base_unit?'No verified method-specific default: configure locally.':'Qualitative/panel: use the relevant interpretation; numeric limits do not apply.';if(starter){low=null;high=null}}
  before.run(row.code,JSON.stringify(row),Date.now());update.run(low,high,cl,ch,note,JSON.stringify(meta),row.code);
 }
 db.exec('RELEASE reference_defaults_203');}catch(error){db.exec('ROLLBACK TO reference_defaults_203');db.exec('RELEASE reference_defaults_203');throw error}
}
function validatedRules(value,kind){if(!Array.isArray(value)||value.length>100)throw Error('Reference rules must be an array of at most 100 entries.');return value.map(r=>{const out={label:String(r.label||'Local range').slice(0,100)};if(r.sex){if(!['M','F'].includes(r.sex))throw Error('Rule sex must be M or F.');out.sex=r.sex}for(const key of ['minAge','maxAge','minDays','maxDays',...LIMIT_KEYS.filter(k=>k.startsWith(kind))])if(r[key]!=null){const n=Number(r[key]);if(!Number.isFinite(n)||((key.includes('Age')||key.includes('Days'))&&n<0))throw Error('Invalid numeric reference rule.');out[key]=n}for(const part of ['Age','Days'])if(out['min'+part]!=null&&out['max'+part]!=null&&out['min'+part]>=out['max'+part])throw Error('Rule age bounds must increase.');if(out[kind+'Low']!=null&&out[kind+'High']!=null&&out[kind+'Low']>out[kind+'High'])throw Error('Rule lower limit cannot exceed its upper limit.');return out})}

export function labCatalog(database, includeInactive = false) {
  const rows = database.sqlite.prepare(`SELECT * FROM lab_catalog ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY category, name`).all();
  return rows.map(row => {
    const units = parseJson(row.units_json, []);
    const components = LAB_PANELS[row.code] || [];
    const numeric = Boolean(row.base_unit) || units.length > 0 || row.reference_low !== null || row.reference_high !== null || row.critical_low !== null || row.critical_high !== null;
    return {
      code: row.code, name: row.name, category: row.category, loincCode: row.loinc_code,
      specimen: row.specimen, baseUnit: row.base_unit, units,
      referenceLow: row.reference_low, referenceHigh: row.reference_high,
      criticalLow: row.critical_low, criticalHigh: row.critical_high,
      referenceConfig: parseJson(row.reference_config_json, {}), referenceNote: row.reference_note, active: row.active === 1,
      resultType: components.length ? 'PANEL' : (numeric ? 'NUMERIC' : 'TEXT'),
      components,
    };
  });
}

export function findLabTest(database, code) {
  return labCatalog(database, true).find(item => item.code === code) || null;
}

function finiteOrNull(value, fieldName) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${fieldName} must be a number.`);
  return number;
}

function cleanUnitDefinitions(units, baseUnit = '') {
  if (!Array.isArray(units)) return [];
  const seen = new Set();
  const cleaned = [];
  units.slice(0, 30).forEach(item => {
    const unit = String(item?.unit || '').trim().slice(0, 40);
    if (!unit || seen.has(unit)) return;
    const factor = Number(item?.factorToBase ?? 1);
    const offset = Number(item?.offsetToBase ?? 0);
    if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(offset)) {
      throw new Error(`Invalid conversion rule for ${unit}.`);
    }
    if (unit === baseUnit && (factor !== 1 || offset !== 0)) throw new Error('The base unit conversion must be identity (factor 1, offset 0).');
    seen.add(unit);
    cleaned.push({ unit, factorToBase: factor, offsetToBase: offset });
  });
  const base = String(baseUnit || '').trim();
  if (base && !seen.has(base)) cleaned.unshift({ unit: base, factorToBase: 1, offsetToBase: 0 });
  return cleaned;
}

export function createLabTest(database, values) {
  const code = String(values?.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,40}$/.test(code)) throw new Error('Test code must use 2–40 letters, numbers or underscores.');
  if (database.sqlite.prepare('SELECT 1 FROM lab_catalog WHERE code=?').get(code)) throw new Error('That laboratory test code already exists.');
  const name = String(values?.name || '').trim().slice(0, 160);
  const category = String(values?.category || '').trim().slice(0, 120);
  if (!name) throw new Error('Laboratory test name is required.');
  if (!category) throw new Error('Laboratory category is required.');
  const baseUnit = String(values?.baseUnit || '').trim().slice(0, 40);
  const units = cleanUnitDefinitions(values?.units || [], baseUnit);
  validatedRules(values.referenceRules || [],'reference'); validatedRules(values.criticalRules || [],'critical');
  const referenceLow = finiteOrNull(values?.referenceLow, 'Reference low');
  const referenceHigh = finiteOrNull(values?.referenceHigh, 'Reference high');
  const criticalLow = finiteOrNull(values?.criticalLow, 'Critical low');
  const criticalHigh = finiteOrNull(values?.criticalHigh, 'Critical high');
  if (referenceLow !== null && referenceHigh !== null && referenceLow > referenceHigh) throw new Error('Reference low cannot exceed reference high.');
  if (criticalLow !== null && criticalHigh !== null && criticalLow > criticalHigh) throw new Error('Critical low cannot exceed critical high.');
  database.sqlite.prepare(`INSERT INTO lab_catalog
    (code,name,category,loinc_code,specimen,base_unit,units_json,reference_low,reference_high,critical_low,critical_high,reference_note,active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      code, name, category, String(values?.loincCode || '').trim().slice(0, 40),
      String(values?.specimen || '').trim().slice(0, 120), baseUnit, JSON.stringify(units),
      referenceLow, referenceHigh, criticalLow, criticalHigh,
      String(values?.referenceNote || 'International starter interval; verify locally before clinical use.').trim().slice(0, 500),
      values?.active === false ? 0 : 1, Date.now(),
    );
  const config = {revision:'20.3',reviewed:values.locallyReviewed===true,referenceSource:'Local configuration',criticalSource:'Local configuration',referenceRules:validatedRules(values.referenceRules || [],'reference'),criticalRules:validatedRules(values.criticalRules || [],'critical'),criticalInclusive:values.criticalInclusive===true,referenceHighExclusive:values.referenceHighExclusive===true,referenceLowExclusive:values.referenceLowExclusive===true};
  database.sqlite.prepare('UPDATE lab_catalog SET reference_config_json=? WHERE code=?').run(JSON.stringify(config),code);
  database.sqlite.prepare('INSERT OR REPLACE INTO lab_reference_migrations VALUES (?,?,?)').run(code,JSON.stringify({createdLocally:true}),Date.now());
  return findLabTest(database, code);
}

export function updateLabTest(database, code, patch) {
  const current = database.sqlite.prepare('SELECT * FROM lab_catalog WHERE code = ?').get(code);
  if (!current) return null;
  const value = (key, fallback) => patch[key] === undefined ? fallback : patch[key];
  const name = String(value('name', current.name) || '').trim().slice(0,160);
  const category = String(value('category', current.category) || '').trim().slice(0,120);
  if (!name) throw new Error('Laboratory test name is required.');
  if (!category) throw new Error('Laboratory category is required.');
  const requestedBaseUnit = String(value('baseUnit', current.base_unit) || '').trim().slice(0, 40);
  const existing=findLabTest(database,code);const rebased=requestedBaseUnit!==current.base_unit?rebaseTest(existing,requestedBaseUnit):existing;
  const units=cleanUnitDefinitions(Array.isArray(patch.units)?patch.units:rebased.units,requestedBaseUnit);
  const config={...rebased.referenceConfig};
  for (const kind of ['reference','critical']) {
    const keys = LIMIT_KEYS.filter(k => k.startsWith(kind));
    const numericEdited = keys.some(k => patch[k] !== undefined && finiteOrNull(patch[k], k) !== rebased[k]);
    const rules = patch[kind+'Rules'] === undefined ? null : validatedRules(patch[kind+'Rules'], kind);
    const rulesEdited = rules !== null && JSON.stringify(rules) !== JSON.stringify(validatedRules(config[kind+'Rules'] || [], kind));
    if (rulesEdited || numericEdited) {
      config[kind+'Rules'] = rulesEdited ? rules : [];
      config[kind+'Source'] = 'Local configuration'; config.reviewed = false;
      if (kind === 'reference') { config.referenceHighExclusive = false; config.referenceLowExclusive = false; }
    }
  }
  for (const key of ['criticalInclusive','referenceHighExclusive','referenceLowExclusive']) if (patch[key] !== undefined && config[key] !== (patch[key] === true)) { config[key] = patch[key] === true; config.reviewed = false; }
  if ((patch.units !== undefined && JSON.stringify(units) !== JSON.stringify(rebased.units)) || (patch.referenceNote !== undefined && patch.referenceNote !== current.reference_note)) config.reviewed = false;
  if(patch.locallyReviewed!==undefined)config.reviewed=patch.locallyReviewed===true;

  const referenceLow = finiteOrNull(value('referenceLow', rebased.referenceLow), 'Reference low');
  const referenceHigh = finiteOrNull(value('referenceHigh', rebased.referenceHigh), 'Reference high');
  const criticalLow = finiteOrNull(value('criticalLow', rebased.criticalLow), 'Critical low');
  const criticalHigh = finiteOrNull(value('criticalHigh', rebased.criticalHigh), 'Critical high');
  if (referenceLow !== null && referenceHigh !== null && referenceLow > referenceHigh) throw new Error('Reference low cannot exceed reference high.');
  if (criticalLow !== null && criticalHigh !== null && criticalLow > criticalHigh) throw new Error('Critical low cannot exceed critical high.');
  database.sqlite.prepare(`UPDATE lab_catalog SET name=?, category=?, loinc_code=?, specimen=?, base_unit=?, units_json=?,
    reference_low=?, reference_high=?, critical_low=?, critical_high=?, reference_note=?, active=?, updated_at=? WHERE code=?`).run(
      name, category,
      String(value('loincCode',current.loinc_code) || '').slice(0,40), String(value('specimen',current.specimen) || '').slice(0,120),
      requestedBaseUnit, JSON.stringify(units), referenceLow, referenceHigh, criticalLow, criticalHigh,
      String(value('referenceNote',current.reference_note) || '').slice(0,500), value('active',current.active === 1) ? 1 : 0,
      Date.now(), code,
    );
  database.sqlite.prepare('UPDATE lab_catalog SET reference_config_json=? WHERE code=?').run(JSON.stringify(config),code);
  return findLabTest(database, code);
}

export function deleteLabTest(database, code) {
  const current = database.sqlite.prepare('SELECT 1 FROM lab_catalog WHERE code = ?').get(code);
  if (!current) return false;
  database.sqlite.prepare('DELETE FROM lab_catalog WHERE code = ?').run(code);
  return true;
}

export function releasePaidOpdParaclinicOrders(database, patientKey, invoiceId = '') {
  const now = Date.now();
  const pending = database.sqlite.prepare(`SELECT id FROM paraclinic_orders WHERE patient_key=? AND status='PAYMENT_PENDING' ORDER BY created_at`).all(patientKey)
    .filter(row => {
      if (!invoiceId) return true;
      const order=getOrder(database,row.id);
      const billed=database.sqlite.prepare(`SELECT 1 FROM finance_charges WHERE patient_key=? AND source_key LIKE ? AND invoice_id=? AND voided_at IS NULL LIMIT 1`)
        .get(patientKey,`PARACLINIC:${row.id}:%`,invoiceId);
      const preConsultFree=order?.request?.opdPreConsult===true && String(order?.request?.chargeMode||'').toUpperCase()==='FREE' &&
        String(order?.request?.opdPreConsultInvoiceId||'')===String(invoiceId);
      return Boolean(billed||preConsultFree);
    });
  if (!pending.length) return [];
  const update = database.sqlite.prepare(`UPDATE paraclinic_orders SET status='ORDERED', updated_at=?
    WHERE patient_key=? AND id=? AND status='PAYMENT_PENDING'`);
  for (const row of pending) update.run(now, patientKey, row.id);
  return pending.map(row => getOrder(database, row.id)).filter(Boolean);
}

const ACTIVE_DUPLICATE_STATUSES = new Set(['PAYMENT_PENDING','ORDERED','WARD_RECEIVED','COLLECTED','SENT_TO_LAB','RECEIVED','PROCESSING','RESULT_AVAILABLE','WARD_SEEN','SCHEDULED','PERFORMED']);

function normalizedExamKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function createOrder(database, values) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const modality = String(values.modality || '').toUpperCase();
  const incoming = values.request && typeof values.request === 'object' ? values.request : {};
  const existing = database.sqlite.prepare('SELECT modality,status,request_json FROM paraclinic_orders WHERE patient_key=?').all(values.patientKey);
  const active = existing.filter(row => ACTIVE_DUPLICATE_STATUSES.has(row.status));
  if (modality === 'LAB') {
    const incomingItems = Array.isArray(incoming.items) ? incoming.items : [];
    const seen = new Set();
    for (const item of incomingItems) {
      const code = String(item?.code || '').trim().toUpperCase();
      if (!code) continue;
      if (seen.has(code)) throw new Error(`Laboratory test ${code} is selected more than once in this order.`);
      seen.add(code);
    }
    const existingCodes = new Set();
    active.filter(row => row.modality === 'LAB').forEach(row => {
      const req = parseJson(row.request_json, {});
      for (const item of (Array.isArray(req.items) ? req.items : [])) {
        const code = String(item?.code || '').trim().toUpperCase();
        if (code) existingCodes.add(code);
      }
    });
    const duplicate = [...seen].find(code => existingCodes.has(code));
    if (duplicate) throw new Error(`This laboratory test has already been ordered for this visit: ${duplicate}. Delete/cancel the previous request before ordering it again.`);
  } else {
    const incomingExam = normalizedExamKey(incoming.examination || incoming.bodyArea || '');
    if (incomingExam) {
      const duplicate = active.filter(row => row.modality === modality).some(row => {
        const req = parseJson(row.request_json, {});
        return normalizedExamKey(req.examination || req.bodyArea || '') === incomingExam;
      });
      if (duplicate) throw new Error(`This ${modality} examination has already been ordered for this visit. Delete/cancel the previous request before ordering it again.`);
    }
  }
  const accessionNumber = accessionFor(modality, now, id);
  const initialStatus = values.paymentPending === true ? 'PAYMENT_PENDING' : 'ORDERED';
  database.sqlite.prepare(`INSERT INTO paraclinic_orders
    (id,patient_key,modality,priority,status,request_json,result_json,requested_by,requested_role,requested_ward,accession_number,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, values.patientKey, modality, values.priority || 'ROUTINE', initialStatus,
      JSON.stringify(incoming), '{}', values.userId, values.role || '', values.ward || '', accessionNumber, now, now,
    );
  return getOrder(database, id);
}

export function cancelOrder(database, id, actor) {
  const current = getOrder(database, id);
  if (!current) return null;
  const role = String(actor?.role || '').toUpperCase();
  if (!['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(role)) throw new Error('Only the ordering doctor or an administrator can delete a paraclinic request.');
  if (!['PAYMENT_PENDING','ORDERED'].includes(current.status)) throw new Error('This paraclinic request can no longer be deleted because department processing has started.');
  if (role === 'DOCTOR' && current.requestedBy !== actor.userId) throw new Error('Only the doctor who created this request can delete it.');
  database.sqlite.prepare(`UPDATE paraclinic_orders SET status='CANCELLED', cancelled_at=?, updated_at=? WHERE id=?`).run(Date.now(),Date.now(),id);
  return getOrder(database,id);
}

export function getOrder(database, id) {
  const row = database.sqlite.prepare(`SELECT o.*, u.display_name AS requester_name,
    p.display_name AS performer_name, v.display_name AS validator_name, r.display_name AS reviewer_name,
    wr.display_name AS ward_receiver_name, cb.display_name AS collector_name, sb.display_name AS sender_name,
    rb.display_name AS receiver_name, x.display_name AS rejector_name, ca.display_name AS critical_ack_name,
    ws.display_name AS ward_seen_name
    FROM paraclinic_orders o
    JOIN users u ON u.id=o.requested_by
    LEFT JOIN users p ON p.id=o.performed_by
    LEFT JOIN users v ON v.id=o.validated_by
    LEFT JOIN users r ON r.id=o.reviewed_by
    LEFT JOIN users wr ON wr.id=o.ward_received_by
    LEFT JOIN users cb ON cb.id=o.collected_by
    LEFT JOIN users sb ON sb.id=o.sent_to_lab_by
    LEFT JOIN users rb ON rb.id=o.received_by
    LEFT JOIN users x ON x.id=o.rejected_by
    LEFT JOIN users ca ON ca.id=o.critical_ack_by
    LEFT JOIN users ws ON ws.id=o.ward_seen_by
    WHERE o.id=?`).get(id);
  if (!row) return null;
  const attachments = database.sqlite.prepare('SELECT id,filename,content_type,uploaded_at FROM paraclinic_attachments WHERE order_id=? ORDER BY uploaded_at').all(id);
  const seenBy = database.sqlite.prepare(`SELECT v.user_id AS userId,u.display_name AS doctorName,
    v.seen_at AS seenAt,v.first_acknowledgment AS firstAcknowledgment
    FROM paraclinic_result_views v JOIN users u ON u.id=v.user_id
    WHERE v.order_id=? AND v.released_at=? ORDER BY v.seen_at,v.user_id`).all(id,row.released_at || 0);
  return {
    id: row.id, patientKey: row.patient_key, modality: row.modality, priority: row.priority, status: row.status,
    accessionNumber: row.accession_number || accessionFor(row.modality, row.created_at, row.id),
    request: parseJson(row.request_json, {}), result: parseJson(row.result_json, {}),
    requestedBy: row.requested_by, requesterName: row.requester_name, requestedRole: row.requested_role,
    requestedWard: row.requested_ward, performedBy: row.performed_by, performerName: row.performer_name,
    validatedBy: row.validated_by, validatorName: row.validator_name, reviewedBy: row.reviewed_by, reviewerName: row.reviewer_name,
    wardReceivedBy: row.ward_received_by, wardReceiverName: row.ward_receiver_name, wardReceivedAt: row.ward_received_at,
    collectedBy: row.collected_by, collectorName: row.collector_name, collectedAt: row.collected_at,
    sentToLabBy: row.sent_to_lab_by, senderName: row.sender_name, sentToLabAt: row.sent_to_lab_at,
    receivedBy: row.received_by, receiverName: row.receiver_name, receivedAt: row.received_at,
    rejectedBy: row.rejected_by, rejectorName: row.rejector_name, rejectedAt: row.rejected_at, rejectionReason: row.rejection_reason || '',
    scheduledAt: row.scheduled_at, performedAt: row.performed_at, hasCritical: row.has_critical === 1,
    criticalAckBy: row.critical_ack_by, criticalAckName: row.critical_ack_name, criticalAckAt: row.critical_ack_at,
    criticalAckNote: row.critical_ack_note || '',
    wardSeenBy: row.ward_seen_by, wardSeenName: row.ward_seen_name, wardSeenAt: row.ward_seen_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
    releasedAt: row.released_at, reviewedAt: row.reviewed_at, cancelledAt: row.cancelled_at,
    seenBy: seenBy.map(item => ({...item,firstAcknowledgment:Boolean(item.firstAcknowledgment)})),
    reportVersions: row.modality === 'LAB' ? database.sqlite.prepare('SELECT released_at AS releasedAt,result_json,validator_name AS validatorName FROM lab_report_snapshots WHERE order_id=? ORDER BY released_at').all(id).map(v=>({releasedAt:v.releasedAt,validatorName:v.validatorName,result:parseJson(v.result_json,{})})) : [],
    attachments: attachments.map(item => ({ id:item.id, filename:item.filename, contentType:item.content_type, uploadedAt:item.uploaded_at })),
  };
}

export function listOrders(database, filters = {}) {
  const clauses = [];
  const params = [];
  if (filters.patientKey) { clauses.push('patient_key=?'); params.push(filters.patientKey); }
  if (filters.modality) { clauses.push('modality=?'); params.push(filters.modality); }
  if (filters.status) { clauses.push('status=?'); params.push(filters.status); }
  const sql = `SELECT id FROM paraclinic_orders ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY CASE priority WHEN 'URGENT' THEN 0 ELSE 1 END, created_at DESC LIMIT 500`;
  return database.sqlite.prepare(sql).all(...params).map(row => getOrder(database, row.id));
}

export function addParaclinicExtraFee(database, values) {
  const id=crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO paraclinic_extra_fees
    (id,order_id,patient_key,charge_id,invoice_id,service_code,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(id,values.orderId,values.patientKey,values.chargeId,values.invoiceId,values.serviceCode,values.userId,values.now||Date.now());
  return getParaclinicExtraFee(database,id);
}

export function getParaclinicExtraFee(database,id) {
  const row=database.sqlite.prepare(`SELECT f.*,o.modality,o.accession_number,o.request_json,
      c.description,c.amount_minor,c.currency,c.voided_at charge_voided_at,c.void_reason,
      p.display_name provider_name,n.display_name nurse_name,a.display_name waiver_requester_name,r.display_name reviewer_name
    FROM paraclinic_extra_fees f JOIN paraclinic_orders o ON o.id=f.order_id
    LEFT JOIN finance_charges c ON c.id=f.charge_id
    LEFT JOIN users p ON p.id=f.created_by LEFT JOIN users n ON n.id=f.nurse_informed_by
    LEFT JOIN users a ON a.id=f.waiver_requested_by LEFT JOIN users r ON r.id=f.reviewed_by
    WHERE f.id=?`).get(id);
  if(!row)return null;
  return {id:row.id,orderId:row.order_id,patientKey:row.patient_key,chargeId:row.charge_id,invoiceId:row.invoice_id,
    serviceCode:row.service_code,description:row.description||row.service_code,amountMinor:Number(row.amount_minor||0),currency:row.currency||'KHR',
    modality:row.modality,accessionNumber:row.accession_number,request:parseJson(row.request_json,{}),createdBy:row.created_by,providerName:row.provider_name||'',createdAt:row.created_at,
    nurseInformedBy:row.nurse_informed_by||'',nurseName:row.nurse_name||'',nurseInformedAt:row.nurse_informed_at||null,
    waiverStatus:row.waiver_status,waiverReason:row.waiver_reason,waiverRequestedBy:row.waiver_requested_by||'',waiverRequesterName:row.waiver_requester_name||'',waiverRequestedAt:row.waiver_requested_at||null,
    reviewedBy:row.reviewed_by||'',reviewerName:row.reviewer_name||'',reviewedAt:row.reviewed_at||null,reviewNote:row.review_note||'',chargeVoidedAt:row.charge_voided_at||null,voidReason:row.void_reason||''};
}

export function listParaclinicExtraFees(database,{patientKey='',waiverStatus=''}={}) {
  const clauses=[],params=[];
  if(patientKey){clauses.push('patient_key=?');params.push(patientKey);}
  if(waiverStatus){clauses.push('waiver_status=?');params.push(waiverStatus);}
  return database.sqlite.prepare(`SELECT id FROM paraclinic_extra_fees ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY created_at DESC LIMIT 300`).all(...params).map(row=>getParaclinicExtraFee(database,row.id)).filter(Boolean);
}

export function updateParaclinicExtraFee(database,id,patch,actor) {
  const current=getParaclinicExtraFee(database,id);if(!current)throw new Error('Paraclinic fee request was not found.');
  const now=Date.now(),role=String(actor?.role||'').toUpperCase(),userId=actor?.userId;
  if(patch.action==='PATIENT_INFORMED'){
    if(!['NURSE','MIDWIFE'].includes(role))throw new Error('Ward nurse access is required.');
    if(current.waiverStatus==='PENDING'||current.waiverStatus==='APPROVED'||current.chargeVoidedAt)throw new Error('This fee cannot be marked for payment in its current state.');
    database.sqlite.prepare('UPDATE paraclinic_extra_fees SET nurse_informed_by=?,nurse_informed_at=? WHERE id=?').run(userId,now,id);
  }else if(patch.action==='REQUEST_WAIVER'){
    if(!['NURSE','MIDWIFE'].includes(role))throw new Error('Ward nurse access is required.');
    if(current.waiverStatus==='APPROVED'||current.chargeVoidedAt)throw new Error('This fee has already been made free.');
    const reason=String(patch.reason||'').trim();if(!reason||reason.length>500)throw new Error('Enter a reason (up to 500 characters) for the free-charge request.');
    database.sqlite.prepare(`UPDATE paraclinic_extra_fees SET waiver_status='PENDING',waiver_reason=?,waiver_requested_by=?,waiver_requested_at=?,reviewed_by=NULL,reviewed_at=NULL,review_note='' WHERE id=?`).run(reason,userId,now,id);
  }else if(patch.action==='REVIEW_WAIVER'){
    if(!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role))throw new Error('Administrator or Director access is required.');
    if(current.waiverStatus!=='PENDING')throw new Error('This free-charge request is no longer pending.');
    const decision=patch.approved===true?'APPROVED':'REJECTED';
    const reviewNote=String(patch.note||'').trim();if(decision==='REJECTED'&&!reviewNote)throw new Error('Enter a reason when declining a free-charge request.');
    database.sqlite.prepare(`UPDATE paraclinic_extra_fees SET waiver_status=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=?`).run(decision,userId,now,reviewNote.slice(0,500),id);
  }else throw new Error('Paraclinic fee action is invalid.');
  return getParaclinicExtraFee(database,id);
}

function convertToBase(value, unit, test) {
  if (value === '' || value == null) return null;
  return convertValue(value, unit, test.baseUnit, test);
}
function convertFromBase(value, unit, test) {
  return value == null ? null : convertValue(value, test.baseUnit, unit, test);
}

function round(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toPrecision(6));
}

export function normalizeLabResults(database, result, person=null, at=Date.now()) {
  const rows = Array.isArray(result?.items) ? result.items : [];
  return {
    ...result,
    items: rows.map(item => {
      const catalogTest=findLabTest(database,String(item.code||''));
      const test=catalogTest?clinicalLimits(catalogTest,person,at):null;
      if (!test) return { ...item, flag: '', baseValue: null };
      if (test.resultType === 'TEXT') {
        return {
          code: test.code, name: test.name, resultType:test.resultType, category:test.category, specimen:test.specimen, loincCode:test.loincCode, value: String(item.value ?? '').trim().slice(0,1000), unit: '',
          baseValue: null, baseUnit: '', flag: '', referenceLow: null, referenceHigh: null,
          criticalLow: null, criticalHigh: null, referenceNote: test.referenceNote,
          comment: String(item.comment || '').slice(0,500),
        };
      }
      const unit = String(item.unit || test.baseUnit || '');
      unitRule(test,unit);
      const baseValue = convertToBase(item.value, unit, test);
      const flag=baseValue===null?'':resultFlag(item.value,unit,test);
      return {
        code: test.code, name: test.name, resultType:test.resultType, category:test.category, specimen:test.specimen, loincCode:test.loincCode, value: item.value === '' || item.value == null ? '' : Number(item.value), unit,
        baseValue: round(baseValue), baseUnit: test.baseUnit, flag, referenceConfig: test.referenceConfig, referenceContext:test.referenceContext,criticalContext:test.criticalContext,
        referenceLow: round(convertFromBase(test.referenceLow, unit, test)),
        referenceHigh: round(convertFromBase(test.referenceHigh, unit, test)),
        criticalLow: round(convertFromBase(test.criticalLow, unit, test)),
        criticalHigh: round(convertFromBase(test.criticalHigh, unit, test)),
        referenceNote: test.referenceNote,
        comment: String(item.comment || '').slice(0,500),
      };
    }),
  };
}

export function updateOrder(database, id, patch, actor) {
  const current = getOrder(database, id);
  if (!current) return null;
  const role = String(actor?.role || '').toUpperCase();
  const status = String(patch.status || current.status).toUpperCase();
  const allowedStatuses = current.modality === 'LAB'
    ? new Set(['ORDERED','PAYMENT_PENDING','WARD_RECEIVED','COLLECTED','SENT_TO_LAB','RECEIVED','PROCESSING','RESULT_AVAILABLE','WARD_SEEN','REJECTED','CANCELLED'])
    : new Set(['ORDERED','PAYMENT_PENDING','SCHEDULED','PERFORMED','PROCESSING','RESULT_AVAILABLE','CANCELLED']);
  if (!allowedStatuses.has(status)) throw new Error('Paraclinic status is invalid.');
  if (current.status === 'PAYMENT_PENDING' && status !== 'PAYMENT_PENDING') {
    throw new Error('Cashier must confirm payment before the paraclinic department can start this request.');
  }

  const now = Date.now();
  let result = patch.result === undefined ? current.result : patch.result;
  if(current.modality==='LAB'&&current.releasedAt&&patch.result!==undefined&&patch.release!==true)throw Error('Finalized laboratory results are read-only; an explicit revised release is required.');
  if (current.modality === 'LAB' && patch.result !== undefined) {const person=database.findPatient(current.patientKey)||{};result=normalizeLabResults(database,result,{sex:person.sex,age:person.age,dateOfBirth:person.date_of_birth},current.collectedAt||current.createdAt);}

  let request = current.request;
  if (patch.request && typeof patch.request === 'object' && !Array.isArray(patch.request)) {
    // Department users may add workflow metadata, but must not rewrite the doctor's clinical request.
    const workflowPatch = {};
    if (current.modality !== 'LAB' && patch.request.scheduledLocal !== undefined) {
      workflowPatch.scheduledLocal = String(patch.request.scheduledLocal || '').trim().slice(0,40);
    }
    if(current.modality!=='LAB'&&patch.request.wardWorkflow&&['NURSE','MIDWIFE'].includes(role)){
      const requested=String(patch.request.wardWorkflow.stage||'').toUpperCase();
      const oldStage=String(current.request?.wardWorkflow?.stage||'').toUpperCase();
      if(!['RECEIVED_ORDER','PATIENT_SENT_TO_IMAGING'].includes(requested))throw new Error('Imaging ward workflow stage is invalid.');
      if(requested==='RECEIVED_ORDER'&&oldStage)throw new Error('This imaging order has already been received by the ward.');
      if(requested==='PATIENT_SENT_TO_IMAGING'&&oldStage!=='RECEIVED_ORDER')throw new Error('Receive the imaging order before sending the patient.');
      workflowPatch.wardWorkflow={
        stage:requested,
        receivedBy:requested==='RECEIVED_ORDER'?actor.userId:(current.request?.wardWorkflow?.receivedBy||''),
        receivedAt:requested==='RECEIVED_ORDER'?now:(current.request?.wardWorkflow?.receivedAt||null),
        sentBy:requested==='PATIENT_SENT_TO_IMAGING'?actor.userId:(current.request?.wardWorkflow?.sentBy||''),
        sentAt:requested==='PATIENT_SENT_TO_IMAGING'?now:(current.request?.wardWorkflow?.sentAt||null),
      };
    }
    request = { ...current.request, ...workflowPatch };
  }

  const patientForOrder = database.findPatient(current.patientKey);
  const isOpdOrder = String(patientForOrder?.service_mode || '').toLowerCase() === 'opd';
  if(current.modality!=='LAB'&&['NURSE','MIDWIFE'].includes(role)){
    if(status!==current.status||patch.result!==undefined||patch.release===true||patch.performed||!patch.request?.wardWorkflow){
      throw new Error('Ward staff can only receive the imaging order and send the patient to imaging.');
    }
  }
  if (current.modality === 'LAB' && !['ADMIN','VICE_DIRECTOR'].includes(role)) {
    const wardRoles = new Set(['NURSE','MIDWIFE']);
    if (wardRoles.has(role)) {
      const permitted = new Set(['WARD_RECEIVED','COLLECTED','SENT_TO_LAB','WARD_SEEN']);
      if (!permitted.has(status) || patch.result !== undefined || patch.release === true || patch.performed) {
        throw new Error('Ward staff can receive the order, collect/send the specimen, and mark a returned result as seen.');
      }
    } else if (role === 'DOCTOR') {
      if (status !== 'WARD_SEEN' || patch.result !== undefined || patch.release === true || patch.performed) {
        throw new Error('Doctors can mark a returned laboratory result as seen but cannot enter laboratory results.');
      }
    } else if (role === 'LAB') {
      const permitted = new Set(['RECEIVED','PROCESSING','RESULT_AVAILABLE','REJECTED']);
      const directOpdStart = isOpdOrder && current.status === 'ORDERED' && ['PROCESSING','RESULT_AVAILABLE'].includes(status);
      const directOpdRelease = isOpdOrder && current.status === 'ORDERED' && patch.release === true;
      if (!permitted.has(status) && !directOpdStart && !directOpdRelease) throw new Error('Laboratory staff can receive/reject specimens and enter/release results only after dispatch.');
    }
  }

  if (current.modality === 'LAB' && !['ADMIN','VICE_DIRECTOR'].includes(role)) {
    if (status === 'WARD_RECEIVED' && current.status !== 'ORDERED') throw new Error('The ward can receive only a newly ordered laboratory request.');
    if (status === 'COLLECTED' && !['WARD_RECEIVED','REJECTED'].includes(current.status)) throw new Error('Receive the order in the ward before collecting the specimen.');
    if (status === 'SENT_TO_LAB' && current.status !== 'COLLECTED') throw new Error('Collect the specimen before sending it to the laboratory.');
    if (status === 'RECEIVED' && !(current.status === 'SENT_TO_LAB' || (isOpdOrder && current.status === 'ORDERED'))) throw new Error('The laboratory can receive only a specimen already forwarded by the workflow.');
    if (status === 'REJECTED' && !['SENT_TO_LAB','RECEIVED','PROCESSING'].includes(current.status)) throw new Error('Only a specimen delivered to the laboratory can be rejected.');
    if (status === 'PROCESSING' && !['RECEIVED','PROCESSING'].includes(current.status) && !(isOpdOrder && current.status === 'ORDERED')) throw new Error('Receive/collect the specimen before entering results.');
    if (patch.release === true && !['RECEIVED','PROCESSING'].includes(current.status) && !(isOpdOrder && current.status === 'ORDERED')) throw new Error('Receive/collect the specimen before releasing results.');
    if (status === 'WARD_SEEN' && current.status !== 'RESULT_AVAILABLE') throw new Error('Only a released result returned to the ward can be marked seen.');
  }

  const released = patch.release === true;
  const performedBy = patch.performed ? actor.userId : current.performedBy;
  const validatedBy = released ? actor.userId : current.validatedBy;
  if (released && current.modality === 'LAB' && current.releasedAt) database.sqlite.prepare('INSERT OR IGNORE INTO lab_report_snapshots VALUES (?,?,?,?)').run(id,current.releasedAt,JSON.stringify(current.result),current.validatorName||'');
  const releasedAt = released ? Math.max(now,(current.releasedAt || 0)+1) : current.releasedAt;
  const finalStatus = released ? 'RESULT_AVAILABLE' : status;

  let wardReceivedBy = current.wardReceivedBy;
  let wardReceivedAt = current.wardReceivedAt;
  let collectedBy = current.collectedBy;
  let collectedAt = current.collectedAt;
  let sentToLabBy = current.sentToLabBy;
  let sentToLabAt = current.sentToLabAt;
  let receivedBy = current.receivedBy;
  let receivedAt = current.receivedAt;
  let wardSeenBy = current.wardSeenBy;
  let wardSeenAt = current.wardSeenAt;
  let rejectedBy = current.rejectedBy;
  let rejectedAt = current.rejectedAt;
  let rejectionReason = current.rejectionReason || '';

  if (current.modality === 'LAB') {
    // OPD patients go directly to the laboratory. The laboratory technician
    // receives the patient, collects the specimen, and starts testing without
    // the separate ward-receive/collect/send-to-lab steps used for IPD.
    if (isOpdOrder && role === 'LAB' && current.status === 'ORDERED' && (status === 'PROCESSING' || released)) {
      if (!collectedAt) {
        collectedBy = actor.userId;
        collectedAt = now;
      }
      if (!receivedAt) {
        receivedBy = actor.userId;
        receivedAt = now;
      }
    }
    if (status === 'WARD_RECEIVED' && !wardReceivedAt) {
      wardReceivedBy = actor.userId;
      wardReceivedAt = now;
    }
    if (status === 'COLLECTED') {
      const requestedCollection = Number(patch.collectedAt);
      collectedBy = actor.userId;
      collectedAt = Number.isFinite(requestedCollection) && requestedCollection > 0 ? requestedCollection : now;
      // Recollection after a rejected specimen clears the active rejection alert.
      if (current.status === 'REJECTED') {
        rejectedBy = null;
        rejectedAt = null;
        rejectionReason = '';
        sentToLabBy = null;
        sentToLabAt = null;
        receivedBy = null;
        receivedAt = null;
      }
    }
    if (status === 'SENT_TO_LAB') {
      sentToLabBy = actor.userId;
      sentToLabAt = now;
    }
    if (status === 'RECEIVED') {
      receivedBy = actor.userId;
      receivedAt = now;
    }
    if (status === 'REJECTED') {
      rejectionReason = String(patch.rejectionReason || '').trim().slice(0,500);
      if (!rejectionReason) throw new Error('A specimen rejection reason is required.');
      rejectedBy = actor.userId;
      rejectedAt = now;
    }
    if (status === 'WARD_SEEN') {
      wardSeenBy = actor.userId;
      wardSeenAt = now;
    }
  }

  const scheduledAt = current.modality !== 'LAB' && status === 'SCHEDULED' ? Number(patch.scheduledAt || now) : current.scheduledAt;
  const performedAt = (status === 'PERFORMED' || patch.performed) && !current.performedAt ? now : current.performedAt;
  const critical = current.modality === 'LAB' && released ? hasCriticalResult(result) : current.hasCritical;

  database.sqlite.prepare(`UPDATE paraclinic_orders SET status=?, request_json=?, result_json=?, performed_by=?, validated_by=?,
    released_at=?, ward_received_by=?, ward_received_at=?, collected_by=?, collected_at=?, sent_to_lab_by=?, sent_to_lab_at=?,
    received_by=?, received_at=?, rejected_by=?, rejected_at=?, rejection_reason=?, ward_seen_by=?, ward_seen_at=?,
    scheduled_at=?, performed_at=?, has_critical=?, updated_at=? WHERE id=?`).run(
      finalStatus, JSON.stringify(request || {}), JSON.stringify(result || {}), performedBy || null, validatedBy || null, releasedAt || null,
      wardReceivedBy || null, wardReceivedAt || null, collectedBy || null, collectedAt || null, sentToLabBy || null, sentToLabAt || null,
      receivedBy || null, receivedAt || null, rejectedBy || null, rejectedAt || null, rejectionReason || '', wardSeenBy || null, wardSeenAt || null,
      scheduledAt || null, performedAt || null, critical ? 1 : 0, now, id,
    );
  if (released) database.sqlite.prepare('UPDATE paraclinic_orders SET reviewed_by=NULL,reviewed_at=NULL WHERE id=?').run(id);
  if (released && current.modality === 'LAB') database.sqlite.prepare('INSERT OR IGNORE INTO lab_report_snapshots VALUES (?,?,?,?)').run(id,releasedAt,JSON.stringify(result),database.sqlite.prepare('SELECT display_name FROM users WHERE id=?').get(actor.userId)?.display_name||'');
  return getOrder(database, id);
}

export function markReviewed(database, id, userId) {
  return recordResultSeen(database,id,userId,false);
}

export function markResultViewed(database, id, userId) {
  return recordResultSeen(database,id,userId,true);
}

function recordResultSeen(database,id,userId,automatic) {
  const current=getOrder(database,id);
  if (!current?.releasedAt || !['RESULT_AVAILABLE','WARD_SEEN'].includes(current.status)) {
    throw new Error('Only a released result can be marked seen.');
  }
  if (automatic && !current.reviewedAt) throw new Error('The first doctor must confirm seeing this result.');
  const now=Date.now();
  database.sqlite.exec('SAVEPOINT result_seen');
  try {
    const first=database.sqlite.prepare(`UPDATE paraclinic_orders
      SET reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=? AND reviewed_at IS NULL`)
      .run(userId,now,now,id).changes > 0;
    database.sqlite.prepare(`INSERT OR IGNORE INTO paraclinic_result_views
      (order_id,user_id,released_at,seen_at,first_acknowledgment) VALUES (?,?,?,?,?)`)
      .run(id,userId,current.releasedAt,now,first?1:0);
    database.sqlite.exec('RELEASE result_seen');
  } catch(error) {
    database.sqlite.exec('ROLLBACK TO result_seen');database.sqlite.exec('RELEASE result_seen');throw error;
  }
  return getOrder(database,id);
}

export function acknowledgeCritical(database, id, userId, note = '') {
  const current = getOrder(database, id);
  if (!current) return null;
  if (!current.hasCritical || !current.releasedAt) throw new Error('This order does not contain a released critical laboratory result.');
  const now = Date.now();
  database.sqlite.prepare(`UPDATE paraclinic_orders SET critical_ack_by=?, critical_ack_at=?, critical_ack_note=?, updated_at=? WHERE id=?`)
    .run(userId, now, String(note || '').trim().slice(0,500), now, id);
  return getOrder(database, id);
}

export function addAttachment(database, orderId, values) {
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO paraclinic_attachments
    (id,order_id,filename,content_type,storage_path,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?)`).run(
      id, orderId, values.filename, values.contentType, values.storagePath, values.userId, Date.now(),
    );
  return { id, orderId, filename: values.filename, contentType: values.contentType };
}

export function getAttachment(database, id) {
  return database.sqlite.prepare(`SELECT a.*, o.patient_key, o.modality FROM paraclinic_attachments a
    JOIN paraclinic_orders o ON o.id=a.order_id WHERE a.id=?`).get(id) || null;
}

export function imagingCatalog(database, includeInactive = false) {
  const query = includeInactive 
    ? 'SELECT * FROM imaging_catalog ORDER BY group_id, name_en'
    : 'SELECT * FROM imaging_catalog WHERE active = 1 ORDER BY group_id, name_en';
  return database.sqlite.prepare(query).all().map(r => ({
    code: r.code,
    groupId: r.group_id,
    nameEn: r.name_en,
    nameKh: r.name_kh,
    active: r.active === 1,
    updatedAt: r.updated_at
  }));
}

export function updateImagingModality(database, code, patch = {}) {
  const current = database.sqlite.prepare('SELECT * FROM imaging_catalog WHERE code = ?').get(code);
  if (!current) return null;
  const activeVal = patch.active !== undefined ? (patch.active ? 1 : 0) : current.active;
  database.sqlite.prepare('UPDATE imaging_catalog SET active = ?, updated_at = ? WHERE code = ?').run(
    activeVal,
    Date.now(),
    code
  );
  return {
    code,
    groupId: current.group_id,
    nameEn: current.name_en,
    nameKh: current.name_kh,
    active: activeVal === 1
  };
}
