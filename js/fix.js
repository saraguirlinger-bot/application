/* ============================================
   HORIZON BUDGET — fix.js
   Correctif universel boutons + accueil
   À charger EN DERNIER dans index.html
   ============================================ */

(function() {
  "use strict";

  /* ── Attendre que tout soit chargé ── */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function() {
    /* Petit délai pour laisser app.js et router.js s'initialiser */
    setTimeout(initFix, 800);
  });

  function initFix() {

    /* ══════════════════════════════════════
       1. CORRIGER screen-onboarding
       Il doit être caché par défaut
       ══════════════════════════════════════ */
    var onb = document.getElementById('screen-onboarding');
    if (onb && onb.style.display !== 'none' && !onb.classList.contains('active')) {
      // Vérifier s'il couvre l'écran avec z-index élevé
      var cs = window.getComputedStyle(onb);
      if (parseInt(cs.zIndex) > 50 && cs.display !== 'none') {
        onb.style.display = 'none';
        console.log('[FIX] screen-onboarding masqué');
      }
    }

    /* ══════════════════════════════════════
       2. CORRIGER screen-activation
       Doit être caché si app est visible
       ══════════════════════════════════════ */
    var app = document.getElementById('app');
    var act = document.getElementById('screen-activation');
    if (app && act && app.style.display !== 'none') {
      act.style.display = 'none';
      console.log('[FIX] screen-activation masqué (app active)');
    }

    /* ══════════════════════════════════════
       3. FORCER L'AFFICHAGE DE L'ACCUEIL
       Si aucun écran n'est actif → forcer accueil
       ══════════════════════════════════════ */
    var activeScreens = document.querySelectorAll('.screen.active');
    if (activeScreens.length === 0 && app && app.style.display !== 'none') {
      console.log('[FIX] Aucun écran actif, forçage accueil');
      if (typeof Router !== 'undefined' && Router.go) {
        Router.go('accueil', { force: true });
      } else {
        // Fallback manuel
        var accueil = document.getElementById('screen-accueil');
        if (accueil) {
          document.querySelectorAll('.screen').forEach(function(s) {
            s.classList.remove('active');
            s.style.pointerEvents = 'none';
            s.style.opacity = '0';
          });
          accueil.classList.add('active');
          accueil.style.pointerEvents = 'all';
          accueil.style.opacity = '1';
        }
      }
      // Déclencher le chargement des données
      setTimeout(function() {
        if (typeof chargerAccueil === 'function') chargerAccueil();
      }, 200);
    }

    /* ══════════════════════════════════════
       4. FIXER LES BOUTONS — event listeners directs
       Pour tous les onclick qui ne répondent pas
       ══════════════════════════════════════ */
    fixAllButtons();

    /* ══════════════════════════════════════
       5. OBSERVER — refixer après changements DOM
       ══════════════════════════════════════ */
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.addedNodes.length > 0) {
          setTimeout(fixAllButtons, 100);
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[FIX] Correctif initialisé');
  }

  /* ══════════════════════════════════════
     FIXER TOUS LES BOUTONS
     ══════════════════════════════════════ */
  function fixAllButtons() {
    /* Éléments qui doivent être cliquables */
    var selectors = [
      '.btn',
      '.card-row',
      '.nav-item',
      '.nav-add',
      '.num-btn',
      '.chip',
      '.accueil-tab',
      '.tab',
      '.emoji-btn',
      '.guide-step',
      '[onclick]',
      'button',
      '.back-btn',
      '.toggle-btn',
      '.cagnotte-btn-action',
      '.filter-chip',
      '.platform-tab',
      '.param-toggle',
    ];

    selectors.forEach(function(sel) {
      var els = document.querySelectorAll(sel);
      els.forEach(function(el) {
        // S'assurer que l'élément est bien cliquable
        el.style.pointerEvents = 'auto';
        el.style.touchAction = 'manipulation';
        el.style.cursor = 'pointer';

        // Ajouter touchend → click pour iOS si pas déjà fait
        if (!el._fixApplied) {
          el._fixApplied = true;
          el.addEventListener('touchend', function(e) {
            // Ne pas déclencher si scroll
            if (!this._touchMoved) {
              e.preventDefault();
              this.click();
            }
          }, { passive: false });
          el.addEventListener('touchstart', function() {
            this._touchMoved = false;
          }, { passive: true });
          el.addEventListener('touchmove', function() {
            this._touchMoved = true;
          }, { passive: true });
        }
      });
    });

    /* Inputs dans les modales — toujours accessibles */
    document.querySelectorAll('.modal input, .modal textarea').forEach(function(inp) {
      inp.style.pointerEvents = 'auto';
      inp.style.userSelect = 'text';
      inp.style.webkitUserSelect = 'text';
      inp.style.touchAction = 'manipulation';
      // Empêcher le zoom iOS (font-size minimum 16px)
      if (parseFloat(window.getComputedStyle(inp).fontSize) < 16) {
        inp.style.fontSize = '16px';
      }
    });

    /* S'assurer que les modales ouvertes sont au-dessus */
    document.querySelectorAll('.modal.open, .modal-overlay.open').forEach(function(el) {
      el.style.pointerEvents = 'auto';
    });
  }

  /* ══════════════════════════════════════
     6. CORRIGER Modal.open / Modal.close
     Vérifier que le CSS réagit à .open
     ══════════════════════════════════════ */
  if (typeof Modal !== 'undefined') {
    var origOpen  = Modal.open.bind(Modal);
    var origClose = Modal.close.bind(Modal);

    Modal.open = function(id) {
      origOpen(id);
      // Forcer les styles au cas où le CSS ne s'applique pas
      setTimeout(function() {
        var overlay = document.getElementById('overlay-' + id);
        var modal   = document.getElementById('modal-' + id);
        if (overlay) {
          overlay.style.opacity = '1';
          overlay.style.pointerEvents = 'all';
        }
        if (modal) {
          modal.style.transform = 'translateX(-50%) translateY(0)';
          modal.style.pointerEvents = 'auto';
          // Fixer les inputs dedans
          modal.querySelectorAll('input, textarea').forEach(function(inp) {
            inp.style.pointerEvents = 'auto';
            inp.style.userSelect = 'text';
            inp.style.webkitUserSelect = 'text';
            if (parseFloat(window.getComputedStyle(inp).fontSize) < 16) {
              inp.style.fontSize = '16px';
            }
          });
        }
        fixAllButtons();
      }, 50);
    };

    Modal.close = function(id) {
      origClose(id);
      // Nettoyer les styles forcés
      setTimeout(function() {
        var overlay = document.getElementById('overlay-' + id);
        var modal   = document.getElementById('modal-' + id);
        if (overlay) { overlay.style.opacity = ''; overlay.style.pointerEvents = ''; }
        if (modal)   { modal.style.transform = ''; modal.style.pointerEvents = ''; }
      }, 50);
    };
  }

  /* ══════════════════════════════════════
     7. FORCER LE RELOAD SI STUCK
     Si après 3 secondes l'accueil est vide
     ══════════════════════════════════════ */
  setTimeout(function() {
    var solde = document.getElementById('accueil-solde-virtuel');
    var app   = document.getElementById('app');
    if (app && app.style.display !== 'none' && solde && solde.textContent === '0,00 €') {
      console.log('[FIX] Accueil vide détecté — rechargement des données');
      if (typeof chargerAccueil === 'function') chargerAccueil();
    }
  }, 3000);

})();
