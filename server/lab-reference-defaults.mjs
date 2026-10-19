export const REFERENCE_DEFAULTS={
  "MCV": {
    "referenceLow": 80,
    "referenceHigh": 98,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 80,
        "referenceHigh": 98,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "MCH": {
    "referenceLow": 27,
    "referenceHigh": 33,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 27,
        "referenceHigh": 33,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "MCHC": {
    "referenceLow": 32,
    "referenceHigh": 36.5,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 32,
        "referenceHigh": 36.5,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "RDW": {
    "referenceLow": 11,
    "referenceHigh": 14,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 11,
        "referenceHigh": 14,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "RETIC": {
    "referenceLow": 0.5,
    "referenceHigh": 1.5,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0.5,
        "referenceHigh": 1.5,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "MPV": {
    "referenceLow": 7.1,
    "referenceHigh": 10.7,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 7.1,
        "referenceHigh": 10.7,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "HGB": {
    "referenceLow": null,
    "referenceHigh": null,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minDays": 0,
        "maxDays": 2,
        "referenceLow": 14.9,
        "referenceHigh": 23.7,
        "label": "Paediatric group 1"
      },
      {
        "minDays": 2,
        "maxDays": 15,
        "referenceLow": 13.4,
        "referenceHigh": 20.5,
        "label": "Paediatric group 2"
      },
      {
        "minDays": 15,
        "maxDays": 31,
        "referenceLow": 11,
        "referenceHigh": 18,
        "label": "Paediatric group 3"
      },
      {
        "minDays": 31,
        "maxAge": 0.25,
        "referenceLow": 9.4,
        "referenceHigh": 13,
        "label": "Paediatric group 4"
      },
      {
        "minAge": 0.25,
        "maxAge": 1,
        "referenceLow": 10,
        "referenceHigh": 13,
        "label": "Paediatric group 5"
      },
      {
        "minAge": 1,
        "maxAge": 6,
        "referenceLow": 10.1,
        "referenceHigh": 13.8,
        "label": "Paediatric group 6"
      },
      {
        "minAge": 6,
        "maxAge": 12,
        "referenceLow": 11.1,
        "referenceHigh": 14.7,
        "label": "Paediatric group 7"
      },
      {
        "minAge": 12,
        "maxAge": 18,
        "sex": "M",
        "referenceLow": 12.1,
        "referenceHigh": 16.6,
        "label": "Adolescent"
      },
      {
        "minAge": 12,
        "maxAge": 18,
        "sex": "F",
        "referenceLow": 12.1,
        "referenceHigh": 15.1,
        "label": "Adolescent"
      },
      {
        "minAge": 18,
        "sex": "F",
        "referenceLow": 11.5,
        "referenceHigh": 16.5,
        "label": "Adult F"
      },
      {
        "minAge": 18,
        "sex": "M",
        "referenceLow": 13,
        "referenceHigh": 18,
        "label": "Adult M"
      }
    ],
    "note": "Adult starter interval; verify the local assay.",
    "criticalLow": 6,
    "criticalHigh": 20,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "maxDays": 50,
        "criticalLow": 6,
        "criticalHigh": 24,
        "label": "Birth through 7 weeks"
      },
      {
        "minDays": 50,
        "criticalLow": 6,
        "criticalHigh": 20,
        "label": "After 7 weeks"
      },
      {
        "minAge": 0.16666666666666666,
        "criticalLow": 6,
        "criticalHigh": 20,
        "label": "Age at least 2 months"
      }
    ]
  },
  "RBC": {
    "referenceLow": null,
    "referenceHigh": null,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "sex": "F",
        "referenceLow": 3.8,
        "referenceHigh": 5.5,
        "label": "Adult F"
      },
      {
        "minAge": 18,
        "sex": "M",
        "referenceLow": 4.5,
        "referenceHigh": 6,
        "label": "Adult M"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "HCT": {
    "referenceLow": null,
    "referenceHigh": null,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "sex": "F",
        "referenceLow": 37,
        "referenceHigh": 47,
        "label": "Adult F"
      },
      {
        "minAge": 18,
        "sex": "M",
        "referenceLow": 40,
        "referenceHigh": 52,
        "label": "Adult M"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "WBC": {
    "referenceLow": 4,
    "referenceHigh": 11,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minDays": 0,
        "maxDays": 2,
        "referenceLow": 6,
        "referenceHigh": 26,
        "label": "Paediatric group 1"
      },
      {
        "minDays": 2,
        "maxDays": 15,
        "referenceLow": 6,
        "referenceHigh": 21,
        "label": "Paediatric group 2"
      },
      {
        "minDays": 15,
        "maxDays": 31,
        "referenceLow": 5,
        "referenceHigh": 20,
        "label": "Paediatric group 3"
      },
      {
        "minDays": 31,
        "maxAge": 0.25,
        "referenceLow": 5,
        "referenceHigh": 17,
        "label": "Paediatric group 4"
      },
      {
        "minAge": 0.25,
        "maxAge": 1,
        "referenceLow": 6,
        "referenceHigh": 17,
        "label": "Paediatric group 5"
      },
      {
        "minAge": 1,
        "maxAge": 6,
        "referenceLow": 6,
        "referenceHigh": 17,
        "label": "Paediatric group 6"
      },
      {
        "minAge": 6,
        "maxAge": 12,
        "referenceLow": 4.5,
        "referenceHigh": 14.5,
        "label": "Paediatric group 7"
      },
      {
        "minAge": 12,
        "maxAge": 18,
        "referenceLow": 4.5,
        "referenceHigh": 13,
        "label": "Adolescent"
      },
      {
        "minAge": 18,
        "referenceLow": 4,
        "referenceHigh": 11,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay.",
    "criticalLow": null,
    "criticalHigh": 100,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true
  },
  "PLT": {
    "referenceLow": 150,
    "referenceHigh": 400,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Blood-counts-reference-ranges.pdf",
    "referenceRules": [
      {
        "minDays": 0,
        "maxDays": 2,
        "referenceLow": 150,
        "referenceHigh": 450,
        "label": "Paediatric group 1"
      },
      {
        "minDays": 2,
        "maxDays": 15,
        "referenceLow": 150,
        "referenceHigh": 500,
        "label": "Paediatric group 2"
      },
      {
        "minDays": 15,
        "maxDays": 31,
        "referenceLow": 150,
        "referenceHigh": 600,
        "label": "Paediatric group 3"
      },
      {
        "minDays": 31,
        "maxAge": 0.25,
        "referenceLow": 150,
        "referenceHigh": 650,
        "label": "Paediatric group 4"
      },
      {
        "minAge": 0.25,
        "maxAge": 1,
        "referenceLow": 150,
        "referenceHigh": 560,
        "label": "Paediatric group 5"
      },
      {
        "minAge": 1,
        "maxAge": 6,
        "referenceLow": 150,
        "referenceHigh": 550,
        "label": "Paediatric group 6"
      },
      {
        "minAge": 6,
        "maxAge": 12,
        "referenceLow": 150,
        "referenceHigh": 430,
        "label": "Paediatric group 7"
      },
      {
        "minAge": 12,
        "maxAge": 18,
        "referenceLow": 150,
        "referenceHigh": 430,
        "label": "Adolescent"
      },
      {
        "minAge": 18,
        "referenceLow": 150,
        "referenceHigh": 400,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay.",
    "criticalLow": 40,
    "criticalHigh": 1000,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true
  },
  "NEUT": {
    "referenceLow": 40,
    "referenceHigh": 60,
    "referenceSource": "https://medlineplus.gov/ency/article/003657.htm",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 40,
        "referenceHigh": 60,
        "label": "Adult"
      }
    ],
    "note": "Relative differential percentage; never substitute an absolute neutrophil critical limit."
  },
  "LYMPH": {
    "referenceLow": 20,
    "referenceHigh": 40,
    "referenceSource": "https://medlineplus.gov/ency/article/003657.htm",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 20,
        "referenceHigh": 40,
        "label": "Adult"
      }
    ],
    "note": "Relative differential percentage; never substitute an absolute neutrophil critical limit."
  },
  "MONO": {
    "referenceLow": 2,
    "referenceHigh": 8,
    "referenceSource": "https://medlineplus.gov/ency/article/003657.htm",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 2,
        "referenceHigh": 8,
        "label": "Adult"
      }
    ],
    "note": "Relative differential percentage; never substitute an absolute neutrophil critical limit."
  },
  "EOS": {
    "referenceLow": 1,
    "referenceHigh": 4,
    "referenceSource": "https://medlineplus.gov/ency/article/003657.htm",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 1,
        "referenceHigh": 4,
        "label": "Adult"
      }
    ],
    "note": "Relative differential percentage; never substitute an absolute neutrophil critical limit."
  },
  "BASO": {
    "referenceLow": 0.5,
    "referenceHigh": 1,
    "referenceSource": "https://medlineplus.gov/ency/article/003657.htm",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0.5,
        "referenceHigh": 1,
        "label": "Adult"
      }
    ],
    "note": "Relative differential percentage; never substitute an absolute neutrophil critical limit."
  },
  "ALT": {
    "referenceLow": 10,
    "referenceHigh": 49,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 10,
        "referenceHigh": 49,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay.",
    "criticalLow": null,
    "criticalHigh": 500,
    "criticalSource": "https://mft.nhs.uk/the-trust/other-departments/laboratory-medicine/information-for-gps/laboratory-medicines-newsletter-for-gps/the-communication-of-critical-biochemistry-results/",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "minAge": 18,
        "criticalLow": null,
        "criticalHigh": 500,
        "label": "Adult; local clinical exceptions apply"
      }
    ]
  },
  "ALP": {
    "referenceLow": 30,
    "referenceHigh": 130,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 30,
        "referenceHigh": 130,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "AST": {
    "referenceLow": null,
    "referenceHigh": 34,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": null,
        "referenceHigh": 34,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay.",
    "criticalLow": null,
    "criticalHigh": 500,
    "criticalSource": "https://mft.nhs.uk/the-trust/other-departments/laboratory-medicine/information-for-gps/laboratory-medicines-newsletter-for-gps/the-communication-of-critical-biochemistry-results/",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "minAge": 18,
        "criticalLow": null,
        "criticalHigh": 500,
        "label": "Adult; local clinical exceptions apply"
      }
    ]
  },
  "AMYLASE": {
    "referenceLow": 30,
    "referenceHigh": 118,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 30,
        "referenceHigh": 118,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "DBIL": {
    "referenceLow": 0,
    "referenceHigh": 5,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0,
        "referenceHigh": 5,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "TP": {
    "referenceLow": 57,
    "referenceHigh": 76,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 57,
        "referenceHigh": 76,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "FT4": {
    "referenceLow": 10,
    "referenceHigh": 18.7,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 10,
        "referenceHigh": 18.7,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "FT3": {
    "referenceLow": 3.5,
    "referenceHigh": 6.5,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 3.5,
        "referenceHigh": 6.5,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "TSH": {
    "referenceLow": 0.38,
    "referenceHigh": 5.5,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0.38,
        "referenceHigh": 5.5,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "TIBC": {
    "referenceLow": 45,
    "referenceHigh": 81,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 45,
        "referenceHigh": 81,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "C3": {
    "referenceLow": 0.75,
    "referenceHigh": 1.65,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0.75,
        "referenceHigh": 1.65,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "C4": {
    "referenceLow": 0.14,
    "referenceHigh": 0.54,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0.14,
        "referenceHigh": 0.54,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "CA125": {
    "referenceLow": 0,
    "referenceHigh": 35,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0,
        "referenceHigh": 35,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "CA199": {
    "referenceLow": 0,
    "referenceHigh": 35,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0,
        "referenceHigh": 35,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "CA153": {
    "referenceLow": 0,
    "referenceHigh": 30,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0,
        "referenceHigh": 30,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "CRP": {
    "referenceLow": 0,
    "referenceHigh": 5,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0,
        "referenceHigh": 5,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay.",
    "criticalLow": null,
    "criticalHigh": 300,
    "criticalSource": "https://mft.nhs.uk/the-trust/other-departments/laboratory-medicine/information-for-gps/laboratory-medicines-newsletter-for-gps/the-communication-of-critical-biochemistry-results/",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "minAge": 18,
        "criticalLow": null,
        "criticalHigh": 300,
        "label": "Adult; local clinical exceptions apply"
      }
    ]
  },
  "CREAT": {
    "referenceLow": null,
    "referenceHigh": null,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "sex": "M",
        "referenceLow": 53,
        "referenceHigh": 97,
        "label": "Adult M"
      },
      {
        "minAge": 18,
        "sex": "F",
        "referenceLow": 44,
        "referenceHigh": 71,
        "label": "Adult F"
      }
    ],
    "note": "Adult starter interval; verify the local assay.",
    "criticalLow": null,
    "criticalHigh": 354,
    "criticalSource": "https://mft.nhs.uk/the-trust/other-departments/laboratory-medicine/information-for-gps/laboratory-medicines-newsletter-for-gps/the-communication-of-critical-biochemistry-results/",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "minAge": 18,
        "criticalLow": null,
        "criticalHigh": 354,
        "label": "Adult creatinine; policy applies if no AKI stage is available"
      }
    ]
  },
  "FERRITIN": {
    "referenceLow": null,
    "referenceHigh": null,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "sex": "M",
        "referenceLow": 22,
        "referenceHigh": 322,
        "label": "Adult M"
      },
      {
        "minAge": 18,
        "sex": "F",
        "referenceLow": 10,
        "referenceHigh": 291,
        "label": "Adult F"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "CK": {
    "referenceLow": null,
    "referenceHigh": null,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "sex": "M",
        "referenceLow": 40,
        "referenceHigh": 320,
        "label": "Adult M"
      },
      {
        "minAge": 18,
        "sex": "F",
        "referenceLow": 25,
        "referenceHigh": 200,
        "label": "Adult F"
      }
    ],
    "note": "Adult starter interval; verify the local assay.",
    "criticalLow": null,
    "criticalHigh": 5000,
    "criticalSource": "https://mft.nhs.uk/the-trust/other-departments/laboratory-medicine/information-for-gps/laboratory-medicines-newsletter-for-gps/the-communication-of-critical-biochemistry-results/",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "minAge": 18,
        "criticalLow": null,
        "criticalHigh": 5000,
        "label": "Adult; local clinical exceptions apply"
      }
    ]
  },
  "TRANSFERRIN": {
    "referenceLow": null,
    "referenceHigh": null,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "sex": "M",
        "referenceLow": 2.2,
        "referenceHigh": 3.7,
        "label": "Adult M"
      },
      {
        "minAge": 18,
        "sex": "F",
        "referenceLow": 2.5,
        "referenceHigh": 3.8,
        "label": "Adult F"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "FOLATE": {
    "referenceLow": 12.236400000000001,
    "referenceHigh": null,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 12.236400000000001,
        "referenceHigh": null,
        "label": "Adult"
      }
    ],
    "note": "Serum folate lower limit; verify locally."
  },
  "VITB12": {
    "referenceLow": 155.718,
    "referenceHigh": 672.318,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 155.718,
        "referenceHigh": 672.318,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "TG": {
    "referenceLow": null,
    "referenceHigh": 1.7,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": null,
        "referenceHigh": 1.7,
        "label": "Adult"
      }
    ],
    "note": "Fasting decision limit; not a population reference interval."
  },
  "HCO3": {
    "referenceLow": 22,
    "referenceHigh": 29,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 22,
        "referenceHigh": 29,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify assay and clinical context.",
    "criticalLow": 10,
    "criticalHigh": null,
    "criticalSource": "https://mft.nhs.uk/the-trust/other-departments/laboratory-medicine/information-for-gps/laboratory-medicines-newsletter-for-gps/the-communication-of-critical-biochemistry-results/",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "minAge": 18,
        "criticalLow": 10,
        "criticalHigh": null,
        "label": "Adult; local clinical exceptions apply"
      }
    ]
  },
  "CL": {
    "referenceLow": 95,
    "referenceHigh": 108,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 95,
        "referenceHigh": 108,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify assay and clinical context."
  },
  "MG": {
    "referenceLow": 0.7,
    "referenceHigh": 1,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0.7,
        "referenceHigh": 1,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify assay and clinical context.",
    "criticalLow": 0.4114,
    "criticalHigh": 3.7026,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true
  },
  "LACTATE": {
    "referenceLow": 0.6,
    "referenceHigh": 2.5,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0.6,
        "referenceHigh": 2.5,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify assay and clinical context."
  },
  "LDH": {
    "referenceLow": 139,
    "referenceHigh": 249,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 139,
        "referenceHigh": 249,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify assay and clinical context."
  },
  "LIPASE": {
    "referenceLow": 13,
    "referenceHigh": 60,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 13,
        "referenceHigh": 60,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify assay and clinical context.",
    "criticalLow": null,
    "criticalHigh": 300,
    "criticalSource": "https://mft.nhs.uk/the-trust/other-departments/laboratory-medicine/information-for-gps/laboratory-medicines-newsletter-for-gps/the-communication-of-critical-biochemistry-results/",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "minAge": 18,
        "criticalLow": null,
        "criticalHigh": 300,
        "label": "Adult; local clinical exceptions apply"
      }
    ]
  },
  "TBIL": {
    "referenceLow": null,
    "referenceHigh": 21,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": null,
        "referenceHigh": 21,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify assay and clinical context."
  },
  "CEA": {
    "referenceLow": 0,
    "referenceHigh": 5,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0,
        "referenceHigh": 5,
        "label": "Adult"
      }
    ],
    "note": "Adult starter interval; verify assay and clinical context."
  },
  "BHCG": {
    "referenceLow": 0,
    "referenceHigh": 4,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0,
        "referenceHigh": 4,
        "label": "Non-pregnant adult baseline only; pregnancy needs gestational interpretation."
      }
    ],
    "note": "Non-pregnant adult baseline only; pregnancy needs gestational interpretation."
  },
  "VITD25": {
    "referenceLow": 50,
    "referenceHigh": 220,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 50,
        "referenceHigh": 220,
        "label": "Adult"
      }
    ],
    "note": "Published starter limit; verify assay and clinical context. Vitamin D limits are interpretive decision limits."
  },
  "URIC": {
    "referenceLow": null,
    "referenceHigh": null,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 19,
        "sex": "M",
        "referenceLow": 200,
        "referenceHigh": 430,
        "label": "Adult M"
      },
      {
        "minAge": 19,
        "sex": "F",
        "referenceLow": 140,
        "referenceHigh": 360,
        "label": "Adult F"
      }
    ],
    "note": "Adult starter interval; verify the local assay."
  },
  "FIB": {
    "criticalLow": 0.6,
    "criticalHigh": null,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true,
    "referenceLow": 1.7,
    "referenceHigh": 4.2,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Coagulation-reference-ranges.pdf",
    "note": "Method-specific starter interval.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 1.7,
        "referenceHigh": 4.2,
        "label": "Method-specific starter interval."
      }
    ]
  },
  "INR": {
    "criticalLow": null,
    "criticalHigh": 5,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true
  },
  "APTT": {
    "criticalLow": null,
    "criticalHigh": 150,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true,
    "referenceLow": 21,
    "referenceHigh": 30,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Coagulation-reference-ranges.pdf",
    "note": "Actin FS starter interval; verify reagent.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 21,
        "referenceHigh": 30,
        "label": "Actin FS starter interval; verify reagent."
      }
    ]
  },
  "K": {
    "criticalLow": 2.5,
    "criticalHigh": 6,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true,
    "referenceLow": 3.7,
    "referenceHigh": 5.2,
    "referenceSource": "https://medlineplus.gov/ency/article/003468.htm",
    "note": "Adult starter interval; verify locally.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 3.7,
        "referenceHigh": 5.2,
        "label": "Adult starter interval; verify locally."
      }
    ]
  },
  "NA": {
    "criticalLow": 120,
    "criticalHigh": 160,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true,
    "referenceLow": 135,
    "referenceHigh": 145,
    "referenceSource": "https://medlineplus.gov/ency/article/003468.htm",
    "note": "Adult starter interval; verify locally.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 135,
        "referenceHigh": 145,
        "label": "Adult starter interval; verify locally."
      }
    ]
  },
  "CA": {
    "criticalLow": 1.62175,
    "criticalHigh": 3.2435,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true,
    "referenceLow": 2.12075,
    "referenceHigh": 2.5448999999999997,
    "referenceSource": "https://medlineplus.gov/ency/article/003468.htm",
    "note": "Adult starter interval; verify locally.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 2.12075,
        "referenceHigh": 2.5448999999999997,
        "label": "Adult starter interval; verify locally."
      }
    ]
  },
  "PHOS": {
    "criticalLow": 0.3229,
    "criticalHigh": null,
    "criticalSource": "https://www.mayocliniclabs.com/~/media/it-mmfiles/special-instructions/DLMP_Critical_Values_-_Critical_Results_List.pdf",
    "criticalInclusive": true,
    "referenceLow": 0.8,
    "referenceHigh": 1.5,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2026/09/Biochemistry-Reference-Ranges-v15.pdf",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 0.8,
        "referenceHigh": 1.5,
        "label": "Adult phosphate"
      }
    ],
    "note": "Adult serum phosphate; verify local assay."
  },
  "ALB": {
    "criticalLow": 10,
    "criticalHigh": null,
    "criticalSource": "https://mft.nhs.uk/the-trust/other-departments/laboratory-medicine/information-for-gps/laboratory-medicines-newsletter-for-gps/the-communication-of-critical-biochemistry-results/",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "minAge": 18,
        "criticalLow": 10,
        "criticalHigh": null,
        "label": "Adult; local clinical exceptions apply"
      }
    ],
    "referenceLow": 34,
    "referenceHigh": 54,
    "referenceSource": "https://medlineplus.gov/ency/article/003468.htm",
    "note": "Adult starter interval; verify locally.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 34,
        "referenceHigh": 54,
        "label": "Adult starter interval; verify locally."
      }
    ]
  },
  "GLU": {
    "criticalLow": 2.5,
    "criticalHigh": 25,
    "criticalSource": "https://mft.nhs.uk/the-trust/other-departments/laboratory-medicine/information-for-gps/laboratory-medicines-newsletter-for-gps/the-communication-of-critical-biochemistry-results/",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "minAge": 18,
        "criticalLow": 2.5,
        "criticalHigh": 25,
        "label": "Adult; local clinical exceptions apply"
      }
    ],
    "referenceLow": 3.8850000000000002,
    "referenceHigh": 5.4945,
    "referenceSource": "https://medlineplus.gov/ency/article/003482.htm",
    "note": "Fasting glucose only; use a local range for random specimens.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 3.8850000000000002,
        "referenceHigh": 5.4945,
        "label": "Fasting glucose only; use a local range for random specimens."
      }
    ]
  },
  "UREA": {
    "criticalLow": null,
    "criticalHigh": 30,
    "criticalSource": "https://mft.nhs.uk/the-trust/other-departments/laboratory-medicine/information-for-gps/laboratory-medicines-newsletter-for-gps/the-communication-of-critical-biochemistry-results/",
    "criticalInclusive": true,
    "criticalRules": [
      {
        "minAge": 18,
        "criticalLow": null,
        "criticalHigh": 30,
        "label": "Adult urea; dialysis exception requires clinical review"
      }
    ],
    "referenceLow": 2.5,
    "referenceHigh": 7.8,
    "referenceSource": "https://www.barnsleyhospital.nhs.uk/pathology/blood-sciences/test-repertoire/table",
    "note": "Adult serum interval.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 2.5,
        "referenceHigh": 7.8,
        "label": "Adult serum interval."
      }
    ]
  },
  "BUN": {
    "referenceLow": 6,
    "referenceHigh": 20,
    "referenceSource": "https://medlineplus.gov/ency/article/003468.htm",
    "note": "Adult starter interval; verify locally.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 6,
        "referenceHigh": 20,
        "label": "Adult starter interval; verify locally."
      }
    ]
  },
  "HBA1C": {
    "referenceLow": null,
    "referenceHigh": 5.7,
    "referenceSource": "https://medlineplus.gov/ency/article/003640.htm",
    "note": "Non-diabetic decision limit <5.7%; treatment targets differ.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": null,
        "referenceHigh": 5.7,
        "label": "Non-diabetic decision limit; treatment targets differ."
      }
    ],
    "referenceHighExclusive": true
  },
  "PT": {
    "referenceLow": 9.9,
    "referenceHigh": 11.8,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Coagulation-reference-ranges.pdf",
    "note": "Method-specific starter interval; verify reagent.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": 9.9,
        "referenceHigh": 11.8,
        "label": "Method-specific starter interval; verify reagent."
      }
    ]
  },
  "DDIMER": {
    "referenceLow": null,
    "referenceHigh": 500,
    "referenceSource": "https://mft.nhs.uk/app/uploads/2024/07/Coagulation-reference-ranges.pdf",
    "note": "FEU decision limit; DDU conversion is not supported. No age-adjusted rule.",
    "referenceRules": [
      {
        "minAge": 18,
        "referenceLow": null,
        "referenceHigh": 500,
        "label": "FEU decision limit; DDU conversion is not supported. No age-adjusted rule."
      }
    ]
  },
  "GGT": {
    "referenceLow": null,
    "referenceHigh": null,
    "referenceSource": "https://www.gloshospitals.nhs.uk/our-services/services-we-offer/pathology/tests-and-investigations/gamma-gt-ggt/",
    "referenceHighExclusive": true,
    "note": "Adult assay-specific upper limit; verify local method.",
    "referenceRules": [
      {
        "minAge": 19,
        "sex": "M",
        "referenceHigh": 61,
        "label": "Adult M"
      },
      {
        "minAge": 19,
        "sex": "F",
        "referenceHigh": 36,
        "label": "Adult F"
      }
    ]
  },
  "CHOL": {
    "referenceLow": null,
    "referenceHigh": 5.172000000000001,
    "referenceSource": "https://magazine.medlineplus.gov/article/cholesterol-know-the-terms",
    "referenceHighExclusive": true,
    "note": "General adult healthy-level decision limit; cardiovascular risk may require a lower treatment target.",
    "referenceRules": [
      {
        "minAge": 20,
        "referenceHigh": 5.172000000000001,
        "label": "General adult decision limit; individual risk targets differ"
      }
    ]
  },
  "LDL": {
    "referenceLow": null,
    "referenceHigh": 3.3618,
    "referenceSource": "https://magazine.medlineplus.gov/article/cholesterol-know-the-terms",
    "referenceHighExclusive": true,
    "note": "General adult healthy-level decision limit; cardiovascular risk may require a lower treatment target.",
    "referenceRules": [
      {
        "minAge": 20,
        "referenceHigh": 3.3618,
        "label": "General adult decision limit; individual risk targets differ"
      }
    ]
  },
  "HDL": {
    "referenceLow": null,
    "referenceHigh": null,
    "referenceSource": "https://magazine.medlineplus.gov/article/cholesterol-know-the-terms",
    "note": "General adult lower healthy-level threshold; cardiovascular interpretation remains clinical.",
    "referenceRules": [
      {
        "minAge": 20,
        "sex": "M",
        "referenceLow": 1.0344,
        "label": "Adult M lower threshold"
      },
      {
        "minAge": 20,
        "sex": "F",
        "referenceLow": 1.1637,
        "label": "Adult F lower threshold"
      }
    ],
    "referenceLowExclusive": true
  }
};
