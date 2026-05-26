/* fix.js v3.4 — correctif minimal mobile */
(function() {
  "use strict";

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function() {

    /* ── 1. Masquer les écrans parasites au démarrage ── */
    var onb = document.getElementById('screen-onboarding');
    if (onb && window.getComputedStyle(onb).display !== 'none') {
      onb.style.display = 'none';
    }

    /* ── 2. Inputs dans les modales : saisie iOS ── */
    function fixInputs() {
      document.querySelectorAll('.modal input, .modal textarea, .modal select').forEach(function(el) {
        el.style.fontSize = '16px';
        el.style.pointerEvents = 'auto';
      });
    }
    fixInputs();

    /* ── 3. Refixer les inputs quand une modale s'ouvre ── */
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

    /* ── 4. Monitor écrans — garantit que l'écran actif est visible ── */
    setInterval(function() {
      var actifs = document.querySelectorAll('.screen.active');
      actifs.forEach(function(el) {
        if (el.style.display !== 'flex' || el.style.opacity !== '1') {
          el.style.display = 'flex';
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
          el.style.visibility = 'visible';
        }
      });
      document.querySelectorAll('.screen:not(.active)').forEach(function(el) {
        if (el.id === 'screen-activation' || el.id === 'screen-onboarding') return;
        if (el.style.display !== 'none') {
          el.style.display = 'none';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          el.style.visibility = 'hidden';
        }
      });
    }, 500);

  });

})();
