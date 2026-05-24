/* ============================================
   HORIZON BUDGET — Router & Utilitaires
   Navigation et fonctions partagées
   v1.0
   ============================================ */

/* ==========================================
   ROUTER
   ========================================== */
const Router = {
  current: 'accueil',
  history: [],

  go(screenId, params = {}) {
    const prev = document.querySelector('.screen.active');
    const next = document.getElementById(`screen-${screenId}`);
    if (!next) return;

    this.history.push(this.current);
    this.current = screenId;

    if (prev) prev.classList.remove('active');
    next.classList.add('active');
    next.dataset.params = JSON.stringify(params);

    // Mise à jour de la nav du bas
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.screen === screenId);
    });

    // Déclenchement du rendu de l'écran
    if (Screens[screenId] && Screens[screenId].onEnter) {
      Screens[screenId].onEnter(params);
    }

    // Scroll en haut
    const body = next.querySelector('.screen-body');
    if (body) body.scrollTop = 0;
  },

  back() {
    if (this.history.length === 0) return;
    const prev = this.history.pop();
    this.current = prev;

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${prev}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.screen === prev);
    });

    if (Screens[prev] && Screens[prev].onEnter) {
      Screens[prev].onEnter();
    }
  }
};

/* ==========================================
   FORMATAGE
   ========================================== */
const Format = {

  // Montant avec signe
  money(amount) {
    const abs = Math.abs(amount).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return (amount < 0 ? '-' : '+') + abs + ' €';
  },

  // Montant absolu sans signe
  moneyAbs(amount) {
    return Math.abs(amount).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  },

  // Date lisible (Aujourd'hui, Hier, ou date)
  date(isoDate) {
    if (!isoDate) return '';
    const d         = new Date(isoDate + 'T00:00:00');
    const today     = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString())     return "Aujourd'hui";
    if (d.toDateString() === yesterday.toDateString()) return 'Hier';

    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  },

  // Date courte : 24 mai
  dateShort(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  },

  // Mois long : Mai 2026
  mois(isoMois) {
    const [year, month] = isoMois.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  },

  // Mois court : mai
  moisCourt(isoMois) {
    const [year, month] = isoMois.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, 1);
    return d.toLocaleDateString('fr-FR', { month: 'short' });
  },

  // Mois courant au format YYYY-MM
  currentMois() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  },

  // Date du jour au format YYYY-MM-DD
  today() {
    return new Date().toISOString().split('T')[0];
  },

  // Pourcentage
  pct(value, total) {
    if (!total) return 0;
    return Math.min(100, Math.round(value / total * 100));
  }
};

/* ==========================================
   TOAST
   ========================================== */
function showToast(msg, duration = 2500) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ==========================================
   MODAL
   ========================================== */
const Modal = {
  open(id) {
    document.getElementById(`overlay-${id}`)?.classList.add('open');
    document.getElementById(`modal-${id}`)?.classList.add('open');
  },
  close(id) {
    document.getElementById(`overlay-${id}`)?.classList.remove('open');
    document.getElementById(`modal-${id}`)?.classList.remove('open');
  }
};

/* ==========================================
   PAVÉ NUMÉRIQUE
   ========================================== */
function NumpadController(displayId, cursorId, colorVar, onChange) {
  let raw = '0';

  function render() {
    const el = document.getElementById(displayId);
    if (!el) return;
    const num = parseFloat(raw) || 0;
    el.textContent = num.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
    if (onChange) onChange(num);
  }

  function press(key) {
    if (key === 'del') {
      raw = raw.length > 1 ? raw.slice(0, -1) : '0';
    } else if (key === '.') {
      if (!raw.includes('.')) raw += '.';
    } else {
      if (raw === '0') raw = key;
      else if (raw.includes('.') && raw.split('.')[1].length >= 2) return;
      else raw += key;
    }
    render();
  }

  function getValue() { return parseFloat(raw) || 0; }
  function setValue(v) { raw = String(v); render(); }
  function reset()    { raw = '0'; render(); }

  render();
  return { press, getValue, setValue, reset };
}

/* ==========================================
   GROUPEMENT PAR DATE
   ========================================== */
function groupByDate(transactions) {
  const groups = {};
  transactions.forEach(tx => {
    if (!groups[tx.date]) groups[tx.date] = [];
    groups[tx.date].push(tx);
  });
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]));
}

/* ==========================================
   CONFIG STATUTS DE POINTAGE
   ========================================== */
const StatutConfig = {
  pointe:   { color: 'var(--green-ok)',  bg: 'var(--green-ok-bg)',   label: 'Pointé',     icon: '✓',  next: 'anomalie' },
  attente:  { color: 'var(--orange)',    bg: 'var(--orange-bg)',      label: 'En attente', icon: '○',  next: 'pointe'   },
  anomalie: { color: 'var(--red)',       bg: 'var(--red-bg)',         label: 'Anomalie',   icon: '!',  next: 'attente'  },
  virtuel:  { color: 'var(--pearl)',     bg: 'var(--pearl-bg)',       label: 'Virtuel',    icon: '⬜', next: null       },
};

/* ==========================================
   SVG LOGO CERCLES CONCENTRIQUES
   ========================================== */
function logoSVG(size = 20, color = '#2d6a4f') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="27" stroke="${color}" stroke-width="3" fill="none"/>
    <circle cx="30" cy="30" r="18" stroke="${color}" stroke-width="3" fill="none"/>
    <circle cx="30" cy="30" r="10" stroke="${color}" stroke-width="3" fill="none"/>
    <circle cx="30" cy="30" r="4"  fill="${color}"/>
  </svg>`;
}

/* ==========================================
   REGISTRY DES ÉCRANS
   ========================================== */
const Screens = {};
