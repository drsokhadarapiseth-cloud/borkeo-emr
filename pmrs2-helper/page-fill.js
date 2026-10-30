// Runs in the Borkeo page world (injected by borkeo-content.js). It waits for the
// page's pmrs2-import module to be ready, then dispatches the import event the
// module listens for. The payload travels in a data attribute set by the content
// script. Nothing here saves the patient.
(function () {
  'use strict';
  let tries = 0;
  const go = () => {
    if (typeof window.applyPmrs2Registration === 'function') {
      document.dispatchEvent(new CustomEvent('borkeo:pmrs2-import'));
      return;
    }
    if (tries++ < 50) setTimeout(go, 200);
  };
  go();
})();
