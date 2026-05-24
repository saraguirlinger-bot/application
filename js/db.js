/* ============================================
   HORIZON BUDGET — Base de données (IndexedDB)
   v1.1 — Budgets virtuels avec accumulation
   ============================================ */

const DB_NAME    = 'HorizonDB';
const DB_VERSION = 2;
let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('comptes')) {
        const s = db.createObjectStore('comptes', { keyPath: 'id', autoIncrement: true });
        s.createIndex('nom',   'nom',   { unique: false });
        s.createIndex('actif', 'actif', { unique: false });
      }

      if (!db.objectStoreNames.contains('transactions')) {
        const s = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        s.createIndex('date',            'date',            { unique: false });
        s.createIndex('compteId',        'compteId',        { unique: false });
        s.createIndex('type',            'type',            { unique: false });
        s.createIndex('statut',          'statut',          { unique: false });
        s.createIndex('categorie',       'categorie',       { unique: false });
        s.createIndex('chargeFixeId',    'chargeFixeId',    { unique: false });
        s.createIndex('budgetVirtuelId', 'budgetVirtuelId', { unique: false });
      }

      if (!db.objectStoreNames.contains('categories')) {
        const s = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
        s.createIndex('nom', 'nom', { unique: false });
      }

      if (!db.objectStoreNames.contains('chargesFixes')) {
        const s = db.createObjectStore('chargesFixes', { keyPath: 'id', autoIncrement: true });
        s.createIndex('actif', 'actif', { unique: false });
      }

      if (!db.objectStoreNames.contains('budgetsVirtuels')) {
        const s = db.createObjectStore('budgetsVirtuels', { keyPath: 'id', autoIncrement: true });
        s.createIndex('actif', 'actif', { unique: false });
      }

      // Mouvements de budgets virtuels (provisions + dépenses)
      if (!db.objectStoreNames.contains('mouvementsBV')) {
        const s = db.createObjectStore('mouvementsBV', { keyPath: 'id', autoIncrement: true });
        s.createIndex('budgetId', 'budgetId', { unique: false });
        s.createIndex('mois',     'mois',     { unique: false });
        s.createIndex('type',     'type',     { unique: false });
      }

      if (!db.objectStoreNames.contains('budgetsMensuels')) {
        const s = db.createObjectStore('budgetsMensuels', { keyPath: 'id', autoIncrement: true });
        s.createIndex('mois',      'mois',      { unique: false });
        s.createIndex('categorie', 'categorie', { unique: false });
      }

      if (!db.objectStoreNames.contains('parametres')) {
        db.createObjectStore('parametres', { keyPath: 'cle' });
      }
    };

    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror   = e => reject(e.target.error);
  });
}

/* ---- HELPERS ---- */
function dbGet(store, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbGetAll(store, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const os  = tx.objectStore(store);
    const req = indexName !== undefined ? os.index(indexName).getAll(value) : os.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbAdd(store, data) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbPut(store, data) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbDelete(store, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* ---- PARAMÈTRES ---- */
function dbGetParam(cle) { return dbGet('parametres', cle).then(r => r ? r.valeur : null); }
function dbSetParam(cle, valeur) { return dbPut('parametres', { cle, valeur }); }

/* ---- DONNÉES PAR DÉFAUT ---- */
async function seedDefaultData() {
  const comptes = await dbGetAll('comptes');
  if (comptes.length > 0) return;

  await dbAdd('comptes', { nom: 'Compte Courant', icone: '🏦', actif: true, createdAt: new Date().toISOString() });
  await dbAdd('comptes', { nom: 'Épargne',        icone: '💰', actif: true, createdAt: new Date().toISOString() });

  const categories = [
    { nom: 'Logement',     icone: '🏠', sousCategories: ['Loyer', 'Charges', 'Assurance habitation', 'Travaux'] },
    { nom: 'Crédit',       icone: '💳', sousCategories: ['Crédit immobilier', 'Crédit voiture', 'Crédit conso'] },
    { nom: 'Énergie',      icone: '⚡', sousCategories: ['EDF', 'Gaz', 'Eau', 'Fioul'] },
    { nom: 'Abonnements',  icone: '📱', sousCategories: ['Internet', 'Téléphone', 'Streaming', 'Presse'] },
    { nom: 'Alimentation', icone: '🛒', sousCategories: ['Courses', 'Restaurant', 'Boulangerie'] },
    { nom: 'Transport',    icone: '🚗', sousCategories: ['Carburant', 'Assurance auto', 'Entretien', 'Péage'] },
    { nom: 'Loisirs',      icone: '🎭', sousCategories: ['Sorties', 'Sport', 'Vacances', 'Cinéma'] },
    { nom: 'Santé',        icone: '💊', sousCategories: ['Pharmacie', 'Médecin', 'Mutuelle', 'Dentiste'] },
    { nom: 'Éducation',    icone: '📚', sousCategories: ['École', 'Fournitures', 'Livres'] },
    { nom: 'Vêtements',    icone: '👕', sousCategories: ['Vêtements adulte', 'Vêtements enfant', 'Chaussures'] },
    { nom: 'Épargne',      icone: '🏦', sousCategories: ['Livret A', 'Assurance vie', 'PEA', 'Autres'] },
    { nom: 'Recettes',     icone: '💶', sousCategories: ['Salaire', 'Allocations', 'Remboursement', 'Prime', 'Autres'] },
    { nom: 'Divers',       icone: '📦', sousCategories: ['Divers', 'Cadeaux', 'Dons'] },
  ];

  for (const cat of categories) {
    await dbAdd('categories', { ...cat, createdAt: new Date().toISOString() });
  }

  await dbSetParam('soldeInitial',       0);
  await dbSetParam('dateInitial',        new Date().toISOString().split('T')[0]);
  await dbSetParam('nomFoyer',           'Mon Foyer');
  await dbSetParam('alerteBudget',       true);
  await dbSetParam('alerteChargesFixes', true);
  await dbSetParam('alerteIA',           true);
  await dbSetParam('injectionFaiteMois', '');
  await dbSetParam('provisionFaiteMois', '');
}

/* ---- CALCUL SOLDES ---- */
async function calculerSoldeReel(compteId) {
  const soldeInit    = parseFloat(await dbGetParam('soldeInitial')) || 0;
  const transactions = await dbGetAll('transactions');
  const filtered     = transactions.filter(t => {
    if (t.statut === 'virtuel') return false;
    return compteId ? t.compteId === compteId : true;
  });
  return filtered.reduce((acc, t) => acc + (t.type === 'credit' ? t.montant : -t.montant), soldeInit);
}

async function calculerSoldeVirtuel() {
  const soldeReel    = await calculerSoldeReel();
  const budgets      = await dbGetAll('budgetsVirtuels');
  const totalVirtuel = budgets.filter(b => b.actif).reduce((acc, b) => acc + b.montantMensuel, 0);
  return soldeReel - totalVirtuel;
}

/* ---- CAGNOTTES ---- */

// Solde accumulé d'un budget virtuel
async function getSoldeCagnotte(budgetId) {
  const mouvements = await dbGetAll('mouvementsBV', 'budgetId', budgetId);
  return mouvements.reduce((acc, m) => acc + (m.type === 'provision' ? m.montant : -m.montant), 0);
}

// Tous les soldes de cagnottes
async function getAllSoldesCagnottes() {
  const budgets = await dbGetAll('budgetsVirtuels');
  const result  = [];
  for (const bv of budgets.filter(b => b.actif)) {
    const solde = await getSoldeCagnotte(bv.id);
    result.push({ ...bv, soldeCagnotte: solde });
  }
  return result;
}

// Provision mensuelle automatique au 1er du mois
async function provisionnerBudgetsDuMois() {
  const mois     = Format.currentMois();
  const dejaFait = await dbGetParam('provisionFaiteMois');
  if (dejaFait === mois) return;

  const budgets = await dbGetAll('budgetsVirtuels');
  for (const bv of budgets.filter(b => b.actif)) {
    const mouvements       = await dbGetAll('mouvementsBV', 'budgetId', bv.id);
    const dejaProvisionne  = mouvements.find(m => m.mois === mois && m.type === 'provision');
    if (!dejaProvisionne) {
      await dbAdd('mouvementsBV', {
        budgetId:  bv.id,
        type:      'provision',
        montant:   bv.montantMensuel,
        mois,
        date:      `${mois}-01`,
        libelle:   `Provision ${bv.nom}`,
        createdAt: new Date().toISOString()
      });
    }
  }
  await dbSetParam('provisionFaiteMois', mois);
}

// Déduire une dépense d'un budget virtuel
async function deduireDuBudgetVirtuel(budgetId, montant, libelle, txId) {
  const mois = Format.currentMois();
  await dbAdd('mouvementsBV', {
    budgetId,
    type:          'depense',
    montant,
    mois,
    date:          Format.today(),
    libelle:       libelle || 'Dépense',
    transactionId: txId || null,
    createdAt:     new Date().toISOString()
  });
}

// Historique des mouvements d'un budget
async function getHistoriqueCagnotte(budgetId) {
  const mouvements = await dbGetAll('mouvementsBV', 'budgetId', budgetId);
  return mouvements.sort((a, b) => b.date.localeCompare(a.date));
}

/* ---- REQUÊTES MÉTIER ---- */
async function getTransactionsDuMois(mois) {
  const all = await dbGetAll('transactions');
  return all
    .filter(t => t.date && t.date.startsWith(mois))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

async function getTotauxDuMois(mois) {
  const txs      = await getTransactionsDuMois(mois);
  const recettes = txs.filter(t => t.type === 'credit' && t.statut !== 'virtuel').reduce((a, t) => a + t.montant, 0);
  const depenses = txs.filter(t => t.type === 'debit'  && t.statut !== 'virtuel').reduce((a, t) => a + t.montant, 0);
  return { recettes, depenses };
}

async function getDepensesParCategorie(mois) {
  const txs      = await getTransactionsDuMois(mois);
  const depenses = txs.filter(t => t.type === 'debit' && t.statut !== 'virtuel');
  const map      = {};
  depenses.forEach(t => {
    const cat = t.categorie || 'Divers';
    if (!map[cat]) map[cat] = { montant: 0, count: 0, icone: t.iconeCategorie || '📦' };
    map[cat].montant += t.montant;
    map[cat].count++;
  });
  return Object.entries(map).sort((a, b) => b[1].montant - a[1].montant);
}

async function getHistoriqueMensuel(nbMois = 6) {
  const all    = await dbGetAll('transactions');
  const result = [];
  const now    = new Date();
  for (let i = nbMois - 1; i >= 0; i--) {
    const d    = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const txs  = all.filter(t => t.date && t.date.startsWith(mois) && t.statut !== 'virtuel');
    const recettes = txs.filter(t => t.type === 'credit').reduce((a, t) => a + t.montant, 0);
    const depenses = txs.filter(t => t.type === 'debit').reduce((a, t) => a + t.montant, 0);
    result.push({ mois, recettes, depenses, solde: recettes - depenses });
  }
  return result;
}
