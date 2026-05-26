/* ============================================
   HORIZON BUDGET — router.js v2.0
   Navigation fluide avec transitions premium
   ============================================ */

const Router = (() => {
  let currentScreen  = 'accueil';
  let previousScreen = null;
  let history        = ['accueil'];
  let isTransitioning = false;

  // Mapping écrans → fonction d'init
  const screenInits = {};

  // ==========================================
  // ENREGISTRER UNE INIT D'ÉCRAN
  // ==========================================
  function onEnter(screenId, fn) {
    screenInits[screenId] = fn;
  }

  // ==========================================
  // NAVIGATION PRINCIPALE
  // ==========================================
  async function go(screenId, options = {}) {
    if (screenId === currentScreen && !options.force) return;
    if (isTransitioning) return;

    isTransitioning = true;

    const currentEl = document.getElementById(`screen-${currentScreen}`);
    const nextEl    = document.getElementById(`screen-${screenId}`);

    if (!nextEl) {
      console.warn('[Router] Écran introuvable:', screenId);
      isTransitioning = false;
      return;
    }

    // Sauvegarder historique
    previousScreen = currentScreen;
    if (!options.replace) {
      history.push(screenId);
    }

    // Transition sortie
    if (currentEl && currentEl.classList.contains('active')) {
      const isBack = options.back === true;
      if (isBack) {
        currentEl.style.transform = 'translateX(40px)';
        currentEl.style.opacity   = '0';
      } else {
        currentEl.classList.add('slide-back');
      }
    }

    // Courte pause pour l'animation
    await sleep(20);

    // Désactiver tous les écrans
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active', 'slide-back');
      s.style.display = 'none';
      s.style.opacity = '0';
      s.style.pointerEvents = 'none';
      s.style.visibility = 'hidden';
      s.style.transform = '';
    });

    // Activer le nouvel écran
    currentScreen = screenId;
    nextEl.style.display = 'flex';
    nextEl.style.opacity = '1';
    nextEl.style.pointerEvents = 'auto';
    nextEl.style.visibility = 'visible';
    nextEl.classList.add('active');

    // Mettre à jour la nav
    updateNav(screenId);

    // Remonter le scroll en haut
    const body = nextEl.querySelector('.screen-body');
    if (body) body.scrollTop = 0;

    // Exécuter l'init de l'écran
    if (screenInits[screenId]) {
      try {
        await screenInits[screenId](options.params || {});
      } catch(e) {
        console.error('[Router] Erreur init écran', screenId, e);
      }
    }

    await sleep(300);
  } finally {
    isTransitioning = false;
  }

  // ==========================================
  // RETOUR ARRIÈRE
  // ==========================================
  function back() {
    if (history.length > 1) {
      history.pop();
      const prev = history[history.length - 1];
      go(prev, { back: true, replace: true });
    } else {
      go('accueil');
    }
  }

  // ==========================================
  // MISE À JOUR DE LA NAV
  // ==========================================
  function updateNav(screenId) {
    const mainScreens = ['accueil', 'releve', 'stats', 'parametres'];
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.screen === screenId) {
        item.classList.add('active');
      }
    });

    // Masquer/afficher la nav selon l'écran
    const nav = document.querySelector('.bottom-nav');
    if (nav) {
      const showNav = mainScreens.includes(screenId) || mainScreens.includes(screenId);
      nav.style.display = (screenId === 'saisie') ? 'none' : 'flex';
    }
  }

  // ==========================================
  // ÉTAT COURANT
  // ==========================================
  function current() {
    return currentScreen;
  }

  function previous() {
    return previousScreen;
  }

  // ==========================================
  // HELPER
  // ==========================================
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ==========================================
  // GESTION BOUTON BACK NATIF (Android)
  // ==========================================
  window.addEventListener('popstate', (e) => {
    back();
  });

  // Push state initial
  if (window.history && window.history.pushState) {
    window.history.pushState({ screen: 'accueil' }, '', window.location.href);
  }

  return { go, back, onEnter, current, previous };
})();

// ==========================================
// MODAL MANAGER
// ==========================================
const Modal = (() => {
  const openModals = new Set();

  function open(id) {
    const overlay = document.getElementById(`overlay-${id}`);
    const modal   = document.getElementById(`modal-${id}`);
    if (!overlay || !modal) return;

    overlay.classList.add('open');
    modal.classList.add('open');
    openModals.add(id);

    // Bloquer le scroll du body
    document.body.style.overflow = 'hidden';
  }

  function close(id) {
    const overlay = document.getElementById(`overlay-${id}`);
    const modal   = document.getElementById(`modal-${id}`);
    if (!overlay || !modal) return;

    overlay.classList.remove('open');
    modal.classList.remove('open');
    openModals.delete(id);

    if (openModals.size === 0) {
      document.body.style.overflow = '';
    }
  }

  function closeAll() {
    [...openModals].forEach(id => close(id));
  }

  // Fermeture avec Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openModals.size > 0) {
      const last = [...openModals].pop();
      close(last);
    }
  });

  return { open, close, closeAll };
})();

// ==========================================
// TOAST MANAGER
// ==========================================
const Toast = (() => {
  let toastEl = null;
  let timeout = null;

  function show(message, duration = 2800, type = 'default') {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }

    clearTimeout(timeout);

    // Style selon le type
    const bg = {
      default: 'var(--green-dark)',
      success: '#22c55e',
      error:   '#d63b3b',
      warning: '#e07b28'
    };
    toastEl.style.background = bg[type] || bg.default;
    toastEl.textContent = message;
    toastEl.classList.add('show');

    timeout = setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }

  function success(msg) { show('✅ ' + msg, 2500, 'success'); }
  function error(msg)   { show('❌ ' + msg, 3000, 'error'); }
  function warning(msg) { show('⚠️ ' + msg, 3000, 'warning'); }

  return { show, success, error, warning };
})();

// ==========================================
// NUMPAD MANAGER
// ==========================================
class Numpad {
  constructor(displayEl, cursorEl, options = {}) {
    this.displayEl = displayEl;
    this.cursorEl  = cursorEl;
    this.value     = '0';
    this.onchange  = options.onchange || (() => {});
    this.maxDigits = options.maxDigits || 8;
  }

  reset() {
    this.value = '0';
    this._update();
  }

  setValue(v) {
    this.value = String(parseFloat(v) || 0);
    this._update();
  }

  press(key) {
    if (key === 'del') {
      if (this.value.length <= 1) {
        this.value = '0';
      } else {
        this.value = this.value.slice(0, -1);
        if (this.value === '' || this.value === '-') this.value = '0';
      }
    } else if (key === '.') {
      if (!this.value.includes('.')) {
        this.value += '.';
      }
    } else {
      const digits = this.value.replace('.', '').replace('-', '');
      if (digits.length >= this.maxDigits) return;

      if (this.value === '0') {
        this.value = key;
      } else {
        this.value += key;
      }
    }

    // Limiter les décimales à 2
    if (this.value.includes('.')) {
      const [int, dec] = this.value.split('.');
      if (dec && dec.length > 2) {
        this.value = `${int}.${dec.substring(0, 2)}`;
      }
    }

    this._update();
    this._animatePress();
  }

  getMontant() {
    return parseFloat(this.value) || 0;
  }

  _update() {
    if (!this.displayEl) return;

    const n = parseFloat(this.value) || 0;
    let display;

    if (this.value.endsWith('.')) {
      display = n.toLocaleString('fr-FR') + ',';
    } else if (this.value.includes('.')) {
      const dec = this.value.split('.')[1];
      display = n.toLocaleString('fr-FR', {
        minimumFractionDigits: dec.length,
        maximumFractionDigits: 2
      });
      // Remplacer le point décimal par virgule
      display = display.replace('.', ',');
    } else {
      display = n.toLocaleString('fr-FR');
    }

    this.displayEl.textContent = display + ' €';
    if (this.cursorEl) {
      this.displayEl.appendChild(this.cursorEl);
    }

    this.onchange(n);
  }

  _animatePress() {
    if (!this.displayEl) return;
    this.displayEl.style.transform = 'scale(1.04)';
    setTimeout(() => {
      this.displayEl.style.transform = '';
    }, 80);
  }
}
