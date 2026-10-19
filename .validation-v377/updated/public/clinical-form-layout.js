'use strict';

(function organizeMaternityForms() {
  const midwifePane = document.getElementById('nursing_maternity');
  const deliveryPanel = document.getElementById('sub_delivery');
  const partographPanel = document.getElementById('sub_partograph');
  if (!midwifePane || !deliveryPanel || !partographPanel) return;

  const midwifeCarePanel = document.createElement('div');
  midwifeCarePanel.id = 'midwife-care-panel';
  midwifeCarePanel.className = 'midwife-workflow-panel';
  midwifeCarePanel.setAttribute('role', 'tabpanel');
  midwifeCarePanel.setAttribute('aria-label', 'ដំណើរការថែទាំឆ្មប');
  Array.from(midwifePane.childNodes).forEach(node => midwifeCarePanel.append(node));

  deliveryPanel.classList.remove('sub-tab', 'active');
  deliveryPanel.classList.add('midwife-workflow-panel');
  deliveryPanel.setAttribute('role', 'tabpanel');
  deliveryPanel.setAttribute('aria-label', 'ទម្រង់សម្រាលកូន');

  partographPanel.classList.remove('sub-tab', 'active');
  partographPanel.classList.add('midwife-workflow-panel');
  partographPanel.setAttribute('role', 'tabpanel');
  partographPanel.setAttribute('aria-label', 'តារាងតាមដានសម្រាល');

  const navigation = document.createElement('div');
  navigation.className = 'midwife-workflow-nav no-print';
  navigation.setAttribute('role', 'tablist');
  navigation.setAttribute('aria-label', 'ទម្រង់ការងាររបស់ឆ្មប');

  const panelMap = new Map([
    ['care', midwifeCarePanel],
    ['delivery', deliveryPanel],
    ['partograph', partographPanel],
  ]);
  const buttonMap = new Map();
  const choices = [
    ['care', 'fa-clipboard-list', 'ដំណើរការថែទាំឆ្មប'],
    ['delivery', 'fa-baby-carriage', 'សម្រាលកូន'],
    ['partograph', 'fa-chart-line', 'តារាងតាមដានសម្រាល'],
  ];

  choices.forEach(([key, icon, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'midwife-workflow-tab';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panelMap.get(key).id);
    button.innerHTML = '<i class="fa-solid ' + icon + '" aria-hidden="true"></i><span>' + label + '</span>';
    button.addEventListener('click', () => showMidwifeWorkflow(key));
    navigation.append(button);
    buttonMap.set(key, button);
  });

  function showMidwifeWorkflow(requestedKey) {
    const key = panelMap.has(requestedKey) ? requestedKey : 'care';
    panelMap.forEach((panel, panelKey) => {
      const selected = panelKey === key;
      panel.hidden = !selected;
      panel.setAttribute('aria-hidden', String(!selected));
    });
    buttonMap.forEach((button, buttonKey) => {
      const selected = buttonKey === key;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    midwifePane.dataset.activeWorkflow = key;

    if (key === 'partograph' && typeof window.loadPartographFrame === 'function') {
      window.loadPartographFrame()
        .then(() => typeof window.syncPartographPatientData === 'function'
          ? window.syncPartographPatientData(false)
          : undefined)
        .catch(() => { /* The partograph panel displays loading errors. */ });
    }
    if (key === 'care' && typeof window.scheduleNursingChartRender === 'function') {
      window.scheduleNursingChartRender();
    }
  }

  midwifePane.append(navigation, midwifeCarePanel, deliveryPanel, partographPanel);
  window.switchMidwifeWorkflow = showMidwifeWorkflow;
  showMidwifeWorkflow('care');
})();
