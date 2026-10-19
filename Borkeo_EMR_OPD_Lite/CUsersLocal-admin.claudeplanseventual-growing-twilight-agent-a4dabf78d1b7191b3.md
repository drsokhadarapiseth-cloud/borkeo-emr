# Implementation Plan: Connecting OPD Lite Frontend to Backend

## Overview
Connect the `public/opd-lite.js` frontend to the backend to enable saving patient information and vitals using the `upsertPatient` database method.

## Requirements Analysis
1. **API Endpoint**: New POST endpoint `/api/opd-lite/save` in `server/server.mjs`.
2. **Data Mapping**:
   - Frontend `name` $\rightarrow$ `summary.fullName`
   - Frontend `id` $\rightarrow$ `patientKey`
   - Frontend `vitals` $\rightarrow$ `data` (JSON object)
3. **Context**: 
   - `serviceMode` = 'opd'
   - `departmentCode` = default (e.g., 'opd')
4. **Frontend**: Replace mock alerts with `fetch` calls and handle responses.

## Detailed Design

### 1. Backend Implementation (`server/server.mjs`)
- **Endpoint**: `/api/opd-lite/save`
- **Method**: `POST`
- **Logic**:
    - Validate session.
    - Validate CSRF token.
    - Parse JSON body.
    - Validate required fields (`name`, `id`).
    - Resolve `patientKey` using `clinicalPatientKey(body.id)`.
    - Construct `record` object for `database.upsertPatient`:
      ```javascript
      const record = {
        id: crypto.randomUUID(),
        patientKey: patientKey,
        userId: session.user_id,
        savedAt: Date.now(),
        summary: {
          fullName: body.name,
          healthId: body.id,
          serviceMode: 'opd',
          departmentCode: 'opd', // Default
          // Fill other summary fields with empty strings as required by upsertPatient
          caseNumber: '', firstName: '', lastName: '', sex: '', age: '', 
          dateOfBirth: '', phone: '', equityCard: '', paymentType: '', 
          departmentNameKh: '', departmentNameEn: '', entryDate: new Date().toISOString().split('T')[0], 
          dischargeDate: ''
        },
        data: {
          vitals: body.vitals,
          treatmentNote: body.treatmentNote || ''
        }
      };
      ```
    - Call `database.upsertPatient(record)`.
    - Audit the action.
    - Return the saved record as JSON.

### 2. Frontend Implementation (`public/opd-lite.js`)
- **Helper Function**: Create a `saveOpdLiteData(data)` function to handle the `fetch` call.
- **CSRF Token**: Retrieve the CSRF token from the session (likely available via `emrSession` or a global variable if `emr-session.js` provides it). Since `emr-session.js` is included, I will check how it stores the token.
- **Update `btnSavePatient`**:
    - Collect name, id, and vitals.
    - Call `saveOpdLiteData`.
- **Update `btnSaveTreatment`**:
    - Collect current patient id (from input) and treatment note.
    - Call `saveOpdLiteData` with the updated note.

### 3. Verification Plan
1. **UI Test**:
   - Enter patient name and ID.
   - Enter vitals.
   - Click "Save Patient Information" $\rightarrow$ Verify success alert.
   - Enter treatment note $\rightarrow$ Click "Save Treatment" $\rightarrow$ Verify success alert.
2. **Database Test**:
   - Query `patient_records` table to verify the record exists with the correct `patient_key`.
   - Verify `record_json` contains the vitals and treatment note.
   - Verify `service_mode` is 'opd'.
3. **Security Test**:
   - Try calling the API without a session $\rightarrow$ Verify 401.
   - Try calling without a CSRF token $\rightarrow$ Verify 403.

## Critical Files for Implementation
- `server/server.mjs`
- `public/opd-lite.js`
- `server/database.mjs`
