/* fix.js v3.3 — correctif minimal iOS */
(function() {

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function() {

    /* ── 1. Masquer screen-onboarding si visible sans raison ── */
    var onb = document.getElementById('screen-onboarding');
    if (onb && window.getComputedStyle(onb).display !== 'none') {
      onb.style.display = 'none';
    }

    /* ── 2. Inputs dans les modales : autoriser la saisie iOS ── */
    function fixInputs() {
      document.querySelectorAll('.modal input, .modal textarea, .modal select').forEach(function(el) {
        el.style.fontSize   = '16px';
        el.style.pointerEvents = 'auto';
      });
    }
    fixInputs();

    /* ── 3. Refixer les inputs quand une modale s'ouvre ── */
    /* Intercepter Modal.open sans MutationObserver */
    var checkModal = setInterval(function() {
      if (typeof Modal !== 'undefined' && Modal.open && !Modal._fixed) {
        Modal._fixed = true;
        var origOpen = Modal.open.bind(Modal);
        Modal.open = function(id) {
          origOpen(id);
          setTimeout(fixInputs, 60);
        };
        clearInterval(checkModal);
      }
    }, 100);

  });

})();
