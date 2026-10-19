document.addEventListener('DOMContentLoaded', () => {
    console.log('OPD Lite Initialized');

    const btnSavePatient = document.getElementById('btn-save-patient');
    const btnSaveTreatment = document.getElementById('btn-save-treatment');
    const btnClear = document.getElementById('btn-clear');

    // New elements for prescribing
    const medInput = document.createElement('div');
    medInput.className = 'field-group';
    medInput.style.marginTop = '20px';
    medInput.innerHTML = `
        <label for="lite-meds">ឱសថ (ឈ្មោះ, បរិមាណ)</label>
        <textarea id="lite-meds" placeholder="ឧទាហរណ៍: Paracetamol 500mg, 10 tablets" style="width:100%; height:80px; margin-bottom:10px; padding:8px;"></textarea>
        <button id="btn-send-pharmacy" class="submit" style="background-color: #28a745; color: white;">បញ្ជូនទៅឱសថស្ថាន</button>
    `;
    const formSection = document.querySelector('.form-section');
    if (formSection) formSection.appendChild(medInput);

    async function saveData(endpoint, payload) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': window.sessionStorage.getItem('csrf-token') || ''
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'មិនអាចរក្សាទុកទិន្នន័យបានទេ។');
            return result;
        } catch (error) {
            alert('កំហុស: ' + error.message);
            throw error;
        }
    }

    btnSavePatient.addEventListener('click', async () => {
        const patientData = {
            name: document.getElementById('lite-patient-name').value,
            id: document.getElementById('lite-patient-id').value,
            vitals: {
                bp: document.getElementById('lite-bp').value,
                temp: document.getElementById('lite-temp').value,
                weight: document.getElementById('lite-weight').value,
                height: document.getElementById('lite-height').value
            }
        };

        if (!patientData.name || !patientData.id) {
            alert('សូមបញ្ចូលឈ្មោះ និង លេខសម្គាល់អ្នកជំងឺ!');
            return;
        }

        try {
            await saveData('/api/opd-lite/save', patientData);
            alert('បានរក្សាទុកព័ត៌មានអ្នកជំងឺជោគជ័យ!');
        } catch (e) {
            // Error handled in saveData
        }
    });

    btnSaveTreatment.addEventListener('click', async () => {
        const patientId = document.getElementById('lite-patient-id').value;
        const treatmentNote = document.getElementById('lite-treatment-note').value;

        if (!patientId) {
            alert('សូមបញ្ចូលលេខសម្គាល់អ្នកជំងឺជាមុនសិន!');
            return;
        }
        if (!treatmentNote) {
            alert('សូមបញ្ចូលព័ត៌មានព្យាបាល!');
            return;
        }

        try {
            await saveData('/api/opd-lite/save', {
                name: document.getElementById('lite-patient-name').value,
                id: patientId,
                treatmentNote: treatmentNote
            });
            alert('បានរក្សាទុកការព្យាបាលជោគជ័យ!');
        } catch (e) {
            // Error handled in saveData
        }
    });

    document.getElementById('btn-send-pharmacy')?.addEventListener('click', async () => {
        const patientId = document.getElementById('lite-patient-id').value;
        const medsText = document.getElementById('lite-meds').value;

        if (!patientId) {
            alert('សូមបញ្ចូលលេខសម្គាល់អ្នកជំងឺ!');
            return;
        }
        if (!medsText.trim()) {
            alert('សូមបញ្ចូលឈ្មោះឱសថ!');
            return;
        }

        // Simple parsing of medications from text area
        const medications = medsText.split('\n').filter(line => line.trim()).map(line => {
            const [name, ...rest] = line.split(',');
            return {
                name: name.trim(),
                total: rest.join(',').trim() || '1',
                doseAmount: '1'
            };
        });

        try {
            await saveData('/api/opd-lite/prescribe', {
                id: patientId,
                medications: medications
            });
            alert('បានបញ្ជូនវេជ្ជបញ្ជាទៅឱសថស្ថានជោគជ័យ!');
        } catch (e) {
            // Error handled in saveData
        }
    });

    btnClear.addEventListener('click', () => {
        if(confirm('តើអ្នកចង់សម្អាតទិន្នន័យទាំងអស់មែនទេ?')) {
            document.getElementById('lite-patient-name').value = '';
            document.getElementById('lite-patient-id').value = '';
            document.getElementById('lite-bp').value = '';
            document.getElementById('lite-temp').value = '';
            document.getElementById('lite-weight').value = '';
            document.getElementById('lite-height').value = '';
            document.getElementById('lite-treatment-note').value = '';
            document.getElementById('lite-meds').value = '';
        }
    });
});
