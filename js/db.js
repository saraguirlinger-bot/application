/* ============================================
   HORIZON BUDGET — db.js v3.3
   IndexedDB — Gestion complète des données
   Nouveautés : clôture mois, dépassement enveloppe,
   mouvements manuels cagnotte, charges variables
   ============================================ */

const DB_NAME    = 'HorizonBudget';
const DB_VERSION = 6;

let db = null;

// ==========================================
// INITIALISATION
// ==========================================
function initDB() {
  // Vérifier que IndexedDB est disponible
  if (!window.indexedDB) {
    return Promise.reject(new Error('IndexedDB non disponible sur cet appareil'));
  }
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      const oldVersion = e.oldVersion;

      // ---- STORES v1 ----
      if (oldVersion < 1) {
        const settings = d.createObjectStore('settings', { keyPath: 'key' });
        const tx = d.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        tx.createIndex('date',      'date',      { unique: false });
        tx.createIndex('categorie', 'categorie', { unique: false });
        tx.createIndex('compte',    'compte',    { unique: false });
        tx.createIndex('mois',      'mois',      { unique: false });
        tx.createIndex('type',      'type',      { unique: false });
        d.createObjectStore('chargesFixes',    { keyPath: 'id', autoIncrement: true });
        d.createObjectStore('budgetsVirtuels', { keyPath: 'id', autoIncrement: true });
        d.createObjectStore('comptes',         { keyPath: 'id', autoIncrement: true });
      }

      // ---- STORES v2 ----
      if (oldVersion < 2) {
        const mbv = d.createObjectStore('mouvementsBV', { keyPath: 'id', autoIncrement: true });
        mbv.createIndex('budgetId',      'budgetId',      { unique: false });
        mbv.createIndex('mois',          'mois',          { unique: false });
        mbv.createIndex('transactionId', 'transactionId', { unique: false });
      }

      // ---- STORES v3 ----
      if (oldVersion < 3) {
        if (!d.objectStoreNames.contains('onboarding'))
          d.createObjectStore('onboarding', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('scores')) {
          const sc = d.createObjectStore('scores', { keyPath: 'id', autoIncrement: true });
          sc.createIndex('mois', 'mois', { unique: true });
        }
        if (!d.objectStoreNames.contains('objectifs'))
          d.createObjectStore('objectifs', { keyPath: 'id', autoIncrement: true });
        if (!d.objectStoreNames.contains('clotures')) {
          const cl = d.createObjectStore('clotures', { keyPath: 'id', autoIncrement: true });
          cl.createIndex('mois', 'mois', { unique: true });
        }
        if (!d.objectStoreNames.contains('conseils'))
          d.createObjectStore('conseils', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('badges')) {
          const bg = d.createObjectStore('badges', { keyPath: 'id', autoIncrement: true });
          bg.createIndex('mois', 'mois', { unique: false });
          bg.createIndex('type', 'type', { unique: false });
        }
      }

      // ---- STORES v4 — Charges variables ----
      if (oldVersion < 4) {
        if (!d.objectStoreNames.contains('chargesVariables')) {
          const cv = d.createObjectStore('chargesVariables', { keyPath: 'id', autoIncrement: true });
          cv.createIndex('categorie', 'categorie', { unique: false });
        }
      }

      // ---- STORES v5 — Cagnottes (store indépendant) ----
      if (oldVersion < 5) {
        if (!d.objectStoreNames.contains('cagnottes')) {
          d.createObjectStore('cagnottes', { keyPath: 'id', autoIncrement: true });
        }
        if (!d.objectStoreNames.contains('mouvementsCagnotte')) {
          const mc = d.createObjectStore('mouvementsCagnotte', { keyPath: 'id', autoIncrement: true });
          mc.createIndex('cagnotteId', 'cagnotteId', { unique: false });
          mc.createIndex('date',       'date',        { unique: false });
        }
      }

      // ---- STORES v6 — Revenus multi-sources ----
      if (oldVersion < 6) {
        if (!d.objectStoreNames.contains('revenus')) {
          d.createObjectStore('revenus', { keyPath: 'id', autoIncrement: true });
        }
      }
    };

    req.onsuccess  = (e) => { db = e.target.result; resolve(db); };
    req.onerror    = (e) => reject(e.target.error);
    req.onblocked  = ()  => {
      console.warn('[DB] Base bloquée — fermer les autres onglets');
      // Tenter de continuer avec la connexion existante si disponible
      if (db) resolve(db);
    };
  });
}

// ==========================================
// HELPERS GÉNÉRIQUES
// ==========================================
function dbGet(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function dbPut(store, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function dbAdd(store, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function dbDelete(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function dbGetByIndex(store, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const idx = tx.objectStore(store).index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ==========================================
// SETTINGS
// ==========================================
async function getSetting(key, defaultVal = null) {
  try {
    const r = await dbGet('settings', key);
    return r ? r.value : defaultVal;
  } catch(e) {
    return defaultVal;
  }
}
async function setSetting(key, value) {
  try {
    return dbPut('settings', { key, value });
  } catch(e) {
    console.warn('[DB] setSetting échoué:', key);
  }
}

// ==========================================
// ONBOARDING
// ==========================================
async function getOnboarding(key, defaultVal = null) {
  const r = await dbGet('onboarding', key);
  return r ? r.value : defaultVal;
}
async function setOnboarding(key, value) {
  return dbPut('onboarding', { key, value });
}
async function isOnboardingDone() {
  return !!(await getOnboarding('completed', false));
}
async function markOnboardingDone() {
  await setOnboarding('completed', true);
  await setOnboarding('completedAt', new Date().toISOString());
}


// ==========================================
// REVENUS MULTI-SOURCES
// ==========================================

async function getRevenus() {
  const all = await dbGetAll('revenus');
  return all.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
}

async function addRevenu(revenu) {
  const obj = {
    nom:       revenu.nom      || 'Revenu',
    montant:   parseFloat(revenu.montant) || 0,
    categorie: revenu.categorie || 'Autre',
    actif:     revenu.actif !== false,
    ordre:     revenu.ordre || 0,
  };
  const id = await dbAdd('revenus', obj);
  // Mettre à jour le total dans settings
  await _majTotalRevenus();
  return id;
}

async function updateRevenu(id, changes) {
  const existing = await dbGet('revenus', id);
  if (!existing) return;
  const updated = { ...existing, ...changes };
  if (changes.montant !== undefined) updated.montant = parseFloat(changes.montant) || 0;
  await dbPut('revenus', updated);
  await _majTotalRevenus();
}

async function deleteRevenu(id) {
  await dbDelete('revenus', id);
  await _majTotalRevenus();
}

async function _majTotalRevenus() {
  const all   = await getRevenus();
  const total = all.filter(r => r.actif !== false).reduce((s, r) => s + (parseFloat(r.montant) || 0), 0);
  await setSetting('revenus', total);
  return total;
}

async function getTotalRevenus() {
  // D'abord essayer le store revenus
  try {
    const all = await getRevenus();
    if (all.length > 0) {
      return all.filter(r => r.actif !== false).reduce((s, r) => s + (parseFloat(r.montant) || 0), 0);
    }
  } catch(e) {}
  // Fallback sur le setting legacy
  return parseFloat(await getSetting('revenus', 0)) || 0;
}

// ==========================================
// TRANSACTIONS
// ==========================================
async function addTransaction(tx) {
  tx.createdAt = new Date().toISOString();
  if (!tx.statut) tx.statut = 'attente';
  if (!tx.date)   tx.date   = new Date().toISOString().split('T')[0];
  if (!tx.mois)   tx.mois   = tx.date.substring(0, 7);
  if (!tx.compte) tx.compte = 'Compte Courant';
  return dbAdd('transactions', tx);
}
async function getTransactionsByMois(mois) {
  return dbGetByIndex('transactions', 'mois', mois);
}
async function getAllTransactions() {
  return dbGetAll('transactions');
}
async function updateTransaction(tx) {
  return dbPut('transactions', tx);
}
async function deleteTransaction(id) {
  return dbDelete('transactions', id);
}

// Solde réel
async function calculerSoldeReel(mois) {
  const soldeInit = await getSetting('soldeInitial', 0);
  const allTx     = await getAllTransactions();
  let solde = parseFloat(soldeInit) || 0;
  for (const tx of allTx) {
    if (tx.mois > mois) continue;
    if (tx.type === 'virtuel') continue;
    const montant = parseFloat(tx.montant) || 0;
    if (tx.typeOp === 'credit') solde += montant;
    else solde -= montant;
  }
  return solde;
}

// Solde virtuel = solde réel - provisions enveloppes
async function calculerSoldeVirtuel(mois) {
  const soldeReel   = await calculerSoldeReel(mois);
  const budgetsVirt = await getBudgetsVirtuelsActifs();
  let provisionsTotales = 0;
  for (const bv of budgetsVirt) {
    provisionsTotales += parseFloat(bv.montant) || 0;
  }
  return Math.max(0, soldeReel - provisionsTotales);
}

// ==========================================
// CHARGES FIXES
// ==========================================
async function getChargesFixes() { return dbGetAll('chargesFixes'); }
async function addChargeFixes(cf) {
  cf.actif = cf.actif !== false;
  cf.createdAt = new Date().toISOString();
  return dbAdd('chargesFixes', cf);
}
async function updateChargeFixes(cf) { return dbPut('chargesFixes', cf); }
async function deleteChargeFixes(id) { return dbDelete('chargesFixes', id); }

async function injecterChargesDuMois(mois) {
  const key  = `injection_${mois}`;
  const done = await getSetting(key, false);
  if (done) return { injected: 0, skipped: true };
  const charges = await getChargesFixes();
  const actives = charges.filter(c => c.actif !== false);
  let count = 0;
  for (const cf of actives) {
    await addTransaction({
      libelle:   cf.nom,
      montant:   cf.montant,
      categorie: cf.categorie || 'Charges fixes',
      souscat:   cf.souscat || '',
      compte:    cf.compte || 'Compte Courant',
      type:      'fixe',
      typeOp:    'debit',
      mois,
      date:      `${mois}-01`,
      statut:    'attente',
      cfId:      cf.id
    });
    count++;
  }
  await setSetting(key, true);
  return { injected: count, skipped: false };
}

// ==========================================
// CHARGES VARIABLES
// ==========================================
async function getChargesVariables()        { return dbGetAll('chargesVariables'); }
async function addChargeVariable(cv) {
  cv.createdAt = new Date().toISOString();
  return dbAdd('chargesVariables', cv);
}
async function updateChargeVariable(cv)     { return dbPut('chargesVariables', cv); }
async function deleteChargeVariable(id)     { return dbDelete('chargesVariables', id); }

// ==========================================
// CAGNOTTES (store indépendant — cumul permanent)
// ==========================================
async function getCagnottes()       { return dbGetAll('cagnottes'); }
async function getCagnotteById(id)  { return dbGet('cagnottes', id); }

async function addCagnotte(c) {
  c.createdAt = new Date().toISOString();
  c.solde     = c.solde || 0;
  c.actif     = c.actif !== false;
  return dbAdd('cagnottes', c);
}

async function updateCagnotte(c)    { return dbPut('cagnottes', c); }
async function deleteCagnotte(id)   { return dbDelete('cagnottes', id); }

// Ajouter de l'argent à une cagnotte
async function alimenterCagnotte(cagnotteId, montant, libelle, mois) {
  const c = await getCagnotteById(cagnotteId);
  if (!c) return null;
  const m = parseFloat(montant);
  c.solde = (parseFloat(c.solde) || 0) + m;
  await updateCagnotte(c);
  await dbAdd('mouvementsCagnotte', {
    cagnotteId, type: 'credit', montant: m,
    libelle: libelle || 'Ajout', mois: mois || new Date().toISOString().substring(0,7),
    date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString()
  });
  return c;
}

// Retirer de l'argent d'une cagnotte
async function retirerDeCagnotte(cagnotteId, montant, libelle, mois) {
  const c = await getCagnotteById(cagnotteId);
  if (!c) return null;
  const m = parseFloat(montant);
  c.solde = Math.max(0, (parseFloat(c.solde) || 0) - m);
  await updateCagnotte(c);
  await dbAdd('mouvementsCagnotte', {
    cagnotteId, type: 'debit', montant: m,
    libelle: libelle || 'Retrait', mois: mois || new Date().toISOString().substring(0,7),
    date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString()
  });
  return c;
}

// Provisionner automatiquement chaque mois
async function provisionnerCagnottesDuMois(mois) {
  const key  = `cagnotte_provision_${mois}`;
  const done = await getSetting(key, false);
  if (done) return;
  const cagnottes = await getCagnottes();
  for (const c of cagnottes.filter(c => c.actif !== false && (parseFloat(c.provisionMensuelle)||0) > 0)) {
    await alimenterCagnotte(c.id, c.provisionMensuelle, `Provision ${mois}`, mois);
  }
  await setSetting(key, true);
}

// Historique mouvements d'une cagnotte
async function getMouvementsCagnotte(cagnotteId) {
  return dbGetByIndex('mouvementsCagnotte', 'cagnotteId', cagnotteId);
}

// ==========================================
// BUDGETS VIRTUELS / ENVELOPPES (store existant — budget mensuel)
// ==========================================
async function getBudgetsVirtuels()         { return dbGetAll('budgetsVirtuels'); }
async function getBudgetsVirtuelsActifs() {
  const all = await getBudgetsVirtuels();
  return all.filter(b => b.actif !== false);
}
async function addBudgetVirtuel(bv) {
  bv.actif     = bv.actif !== false;
  bv.createdAt = new Date().toISOString();
  bv.cagnotte  = bv.cagnotte || 0;
  return dbAdd('budgetsVirtuels', bv);
}
async function updateBudgetVirtuel(bv)      { return dbPut('budgetsVirtuels', bv); }
async function deleteBudgetVirtuel(id)      { return dbDelete('budgetsVirtuels', id); }

async function provisionnerBudgetsDuMois(mois) {
  const key  = `provision_${mois}`;
  const done = await getSetting(key, false);
  if (done) return { provisioned: 0, skipped: true };
  const budgets = await getBudgetsVirtuelsActifs();
  let count = 0;
  for (const bv of budgets) {
    const montant = parseFloat(bv.montant) || 0;
    bv.cagnotte = (parseFloat(bv.cagnotte) || 0) + montant;
    await updateBudgetVirtuel(bv);
    await dbAdd('mouvementsBV', {
      budgetId:  bv.id,
      type:      'provision',
      montant,
      mois,
      date:      `${mois}-01`,
      libelle:   `Provision ${mois}`,
      createdAt: new Date().toISOString()
    });
    count++;
  }
  await setSetting(key, true);
  return { provisioned: count, skipped: false };
}

// Déduire d'une enveloppe (avec vérif dépassement)
async function deduireDeCagnotte(budgetId, montant, transactionId, mois) {
  const bv = await dbGet('budgetsVirtuels', budgetId);
  if (!bv) return { success: false, error: 'Budget introuvable' };
  const soldeAvant   = parseFloat(bv.cagnotte) || 0;
  const montantNum   = parseFloat(montant);
  const soldeApres   = soldeAvant - montantNum;
  bv.cagnotte        = Math.max(0, soldeApres);
  await updateBudgetVirtuel(bv);
  await dbAdd('mouvementsBV', {
    budgetId,
    type:          'depense',
    montant:       montantNum,
    mois,
    date:          new Date().toISOString().split('T')[0],
    libelle:       'Dépense déduite',
    transactionId,
    createdAt:     new Date().toISOString()
  });
  return {
    success:      true,
    depasse:      soldeApres < 0,
    depassement:  soldeApres < 0 ? Math.abs(soldeApres) : 0,
    soldeAvant,
    soldeApres:   Math.max(0, soldeApres),
    nomEnveloppe: bv.nom
  };
}

// Mouvement manuel sur cagnotte (ajout ou retrait)
async function mouvementManuelCagnotte(budgetId, montant, type, libelle) {
  const bv = await dbGet('budgetsVirtuels', budgetId);
  if (!bv) return;
  const m = parseFloat(montant);
  if (type === 'ajout') {
    bv.cagnotte = (parseFloat(bv.cagnotte) || 0) + m;
  } else {
    bv.cagnotte = Math.max(0, (parseFloat(bv.cagnotte) || 0) - m);
  }
  await updateBudgetVirtuel(bv);
  const mois = new Date().toISOString().substring(0, 7);
  await dbAdd('mouvementsBV', {
    budgetId,
    type:      type === 'ajout' ? 'ajout_manuel' : 'retrait_manuel',
    montant:   m,
    mois,
    date:      new Date().toISOString().split('T')[0],
    libelle:   libelle || (type === 'ajout' ? 'Ajout manuel' : 'Retrait manuel'),
    createdAt: new Date().toISOString()
  });
  return bv;
}

// Transfert entre enveloppes (solution dépassement)
async function transfererEntreEnveloppes(sourceId, destId, montant, mois) {
  const source = await dbGet('budgetsVirtuels', sourceId);
  const dest   = await dbGet('budgetsVirtuels', destId);
  if (!source || !dest) return false;
  const m = parseFloat(montant);
  source.cagnotte = Math.max(0, (parseFloat(source.cagnotte) || 0) - m);
  dest.cagnotte   = (parseFloat(dest.cagnotte) || 0) + m;
  await updateBudgetVirtuel(source);
  await updateBudgetVirtuel(dest);
  const date = new Date().toISOString().split('T')[0];
  await dbAdd('mouvementsBV', { budgetId: sourceId, type: 'transfert_sortant', montant: m, mois, date, libelle: `Transfert → ${dest.nom}`, createdAt: new Date().toISOString() });
  await dbAdd('mouvementsBV', { budgetId: destId,   type: 'transfert_entrant', montant: m, mois, date, libelle: `Transfert ← ${source.nom}`, createdAt: new Date().toISOString() });
  return true;
}

async function getMouvementsBV(budgetId) {
  return dbGetByIndex('mouvementsBV', 'budgetId', budgetId);
}

// ==========================================
// COMPTES BANCAIRES
// ==========================================
async function getComptes()         { return dbGetAll('comptes'); }
async function addCompte(compte)    { compte.createdAt = new Date().toISOString(); return dbAdd('comptes', compte); }
async function deleteCompte(id)     { return dbDelete('comptes', id); }

// ==========================================
// CLÔTURE DE MOIS
// ==========================================
async function cloturerMois(moisACloturer) {
  // 1. Archiver les stats du mois
  const txMois   = await getTransactionsByMois(moisACloturer);
  const budgets  = await getBudgetsVirtuelsActifs();
  const charges  = await getChargesFixes();
  const scoreD   = await calculerScore(moisACloturer);

  const rec = txMois.filter(t => t.typeOp === 'credit').reduce((s, t) => s + (parseFloat(t.montant) || 0), 0);
  const dep = txMois.filter(t => t.typeOp === 'debit' && t.type !== 'virtuel').reduce((s, t) => s + (parseFloat(t.montant) || 0), 0);

  const archive = {
    mois:           moisACloturer,
    revenus:        rec,
    depenses:       dep,
    soldeVirtuel:   await calculerSoldeVirtuel(moisACloturer),
    nbTransactions: txMois.length,
    nbBudgets:      budgets.length,
    score:          scoreD.score,
    clotureLe:      new Date().toISOString()
  };

  try {
    await dbAdd('clotures', archive);
  } catch(e) {
    await dbPut('clotures', { ...archive, id: moisACloturer });
  }

  // 2. Calculer le mois suivant
  const [y, m] = moisACloturer.split('-').map(Number);
  const nextDate = new Date(y, m, 1); // mois suivant
  const moisSuivant = nextDate.toISOString().substring(0, 7);

  // 3. Calculer les reliquats des enveloppes non-épargne
  const reliquats = [];
  for (const bv of budgets) {
    if (bv.estEpargne) {
      // Épargne : on cumule directement, pas de question
      const montant = parseFloat(bv.montant) || 0;
      bv.cagnotte = (parseFloat(bv.cagnotte) || 0) + montant;
      await updateBudgetVirtuel(bv);
    } else {
      const soldeRestant = parseFloat(bv.cagnotte) || 0;
      if (soldeRestant > 0) {
        // Il reste quelque chose : on demande à l'utilisateur quoi en faire
        reliquats.push({ id: bv.id, nom: bv.nom, icone: bv.icone || '⬜', soldeRestant });
      }
      // On remet la cagnotte à 0 en attendant la réaffectation + la nouvelle provision
      bv.cagnotte = 0;
      await updateBudgetVirtuel(bv);
    }
  }

  // 4. Injecter charges + provisions du mois suivant
  await injecterChargesDuMois(moisSuivant);
  await provisionnerBudgetsDuMois(moisSuivant);
  await provisionnerCagnottesDuMois(moisSuivant);

  // 5. Mettre à jour le mois courant
  await setSetting('moisCourant', moisSuivant);

  return { success: true, moisSuivant, archive, reliquats };
}

async function getClotures() {
  return dbGetAll('clotures');
}
// Réaffecter un reliquat d'enveloppe après clôture
// destination : { type: 'cagnotte', id: number } | { type: 'compte' }
async function affecterReliquat(budgetSourceId, montant, destination, moisClos) {
  const m    = parseFloat(montant);
  const date = new Date().toISOString().split('T')[0];

  if (destination.type === 'cagnotte' && destination.id) {
    const dest = await dbGet('budgetsVirtuels', destination.id);
    if (!dest) return false;
    dest.cagnotte = (parseFloat(dest.cagnotte) || 0) + m;
    await updateBudgetVirtuel(dest);
    await dbAdd('mouvementsBV', {
      budgetId:  destination.id,
      type:      'transfert_entrant',
      montant:   m,
      mois:      moisClos,
      date,
      libelle:   `Reliquat clôture ${formatMoisLabel(moisClos)}`,
      createdAt: new Date().toISOString()
    });
    await dbAdd('mouvementsBV', {
      budgetId:  budgetSourceId,
      type:      'transfert_sortant',
      montant:   m,
      mois:      moisClos,
      date,
      libelle:   `Reliquat → ${dest.nom}`,
      createdAt: new Date().toISOString()
    });
  } else {
    // Affecter au compte courant
    await addTransaction({
      libelle:   `Reliquat enveloppe — clôture ${formatMoisLabel(moisClos)}`,
      montant:   m,
      categorie: 'Recettes',
      compte:    'Compte Courant',
      type:      'virtuel',
      typeOp:    'credit',
      mois:      moisClos,
      date,
      statut:    'ok'
    });
    await dbAdd('mouvementsBV', {
      budgetId:  budgetSourceId,
      type:      'retrait_manuel',
      montant:   m,
      mois:      moisClos,
      date,
      libelle:   `Reliquat → Compte courant`,
      createdAt: new Date().toISOString()
    });
  }
  return true;
}

// ==========================================
// SCORE BUDGÉTAIRE
// ==========================================
async function calculerScore(mois) {
  const txMois  = await getTransactionsByMois(mois);
  const budgets = await getBudgetsVirtuelsActifs();

  let score = 100;
  const details = {};

  const pointees = txMois.filter(t => t.statut === 'ok').length;
  const total    = txMois.filter(t => t.typeOp === 'debit').length;
  if (total > 0 && pointees / total < 0.5) { score -= 15; details.rapprochement = false; }
  else details.rapprochement = true;

  const soldeVirt = await calculerSoldeVirtuel(mois);
  if (soldeVirt <= 0) { score -= 20; details.soldePositif = false; }
  else details.soldePositif = true;

  let cagnotteDepassee = false;
  for (const bv of budgets) {
    if ((parseFloat(bv.cagnotte) || 0) < 0) { cagnotteDepassee = true; break; }
  }
  if (cagnotteDepassee) { score -= 10; details.enveloppesRespectees = false; }
  else details.enveloppesRespectees = true;

  const hasEpargne = budgets.some(b =>
    b.nom?.toLowerCase().includes('épargne') ||
    b.nom?.toLowerCase().includes('securite') ||
    b.nom?.toLowerCase().includes('sécurité') ||
    b.estEpargne
  );
  if (hasEpargne) { score = Math.min(100, score + 5); details.epargne = true; }
  else details.epargne = false;

  score = Math.max(0, Math.min(100, score));
  const scoreData = { mois, score, details, calculatedAt: new Date().toISOString() };
  try { await dbPut('scores', { ...scoreData, id: mois }); } catch(e) {}
  return scoreData;
}

function getScoreLabel(score) {
  if (score >= 90) return { label: 'Excellent',    emoji: '🏆', color: '#22c55e' };
  if (score >= 75) return { label: 'Très bien',    emoji: '✅', color: '#52a878' };
  if (score >= 55) return { label: 'Bien',         emoji: '📈', color: '#3d8b65' };
  if (score >= 35) return { label: 'À améliorer',  emoji: '⚠️', color: '#e07b28' };
  return               { label: 'Attention',      emoji: '🔴', color: '#d63b3b' };
}

function getProfilGestionnaire(score) {
  if (score >= 90) return 'Gestionnaire prudent 🏆';
  if (score >= 75) return 'Gestionnaire équilibré ✅';
  if (score >= 55) return 'En progression 📈';
  if (score >= 35) return 'Budget à surveiller ⚠️';
  return 'Réorganisation recommandée 🔄';
}

// ==========================================
// BADGES
// ==========================================
const BADGES_DEF = [
  { type: 'budget_respecte', label: 'Budget respecté',       icon: '🏅', condition: (s) => s.score >= 80 },
  { type: 'solde_positif',   label: 'Solde positif',          icon: '💚', condition: (s) => s.details?.soldePositif },
  { type: 'epargne',         label: 'Épargnant du mois',     icon: '🐖', condition: (s) => s.details?.epargne },
  { type: 'rapprochement',   label: 'Rapprochement fait',    icon: '✅', condition: (s) => s.details?.rapprochement },
  { type: 'enveloppes',      label: 'Enveloppes maîtrisées', icon: '🎯', condition: (s) => s.details?.enveloppesRespectees },
  { type: 'excellent',       label: 'Score Excellent',        icon: '🏆', condition: (s) => s.score >= 90 },
];

async function calculerBadges(mois) {
  const scoreData = await calculerScore(mois);
  const badges = [];
  for (const def of BADGES_DEF) {
    if (def.condition(scoreData)) {
      badges.push({ type: def.type, label: def.label, icon: def.icon, mois, earnedAt: new Date().toISOString() });
    }
  }
  const existing      = await dbGetByIndex('badges', 'mois', mois);
  const existingTypes = new Set(existing.map(b => b.type));
  for (const badge of badges) {
    if (!existingTypes.has(badge.type)) await dbAdd('badges', badge);
  }
  return badges;
}

async function getBadgesDuMois(mois) {
  return dbGetByIndex('badges', 'mois', mois);
}

// ==========================================
// CONSEILS
// ==========================================
async function genererConseils(mois) {
  const conseils  = [];
  const txMois    = await getTransactionsByMois(mois);
  const budgets   = await getBudgetsVirtuelsActifs();
  const charges   = await getChargesFixes();
  const revenus   = await getSetting('revenus', 0);
  const totalR    = parseFloat(revenus) || 0;
  const totalC    = charges.reduce((s, c) => s + (parseFloat(c.montant) || 0), 0);

  if (totalR > 0 && totalC / totalR > 0.5) {
    conseils.push({ type: 'alerte', icon: '⚠️', titre: 'Charges élevées', texte: `Vos charges fixes représentent ${Math.round(totalC/totalR*100)}% de vos revenus. La règle recommandée est de rester sous 50%.` });
  }
  const hasImprevus = budgets.some(b => b.nom?.toLowerCase().includes('imprévu') || b.nom?.toLowerCase().includes('urgence'));
  if (!hasImprevus && budgets.length > 0) {
    conseils.push({ type: 'conseil', icon: '🛡️', titre: 'Créer une enveloppe Imprévus', texte: "Même 50€/mois mis de côté peuvent éviter un découvert en cas d'imprévu." });
  }
  const hasEpargne = budgets.some(b => b.nom?.toLowerCase().includes('épargne') || b.nom?.toLowerCase().includes('sécurité') || b.estEpargne);
  if (!hasEpargne) {
    conseils.push({ type: 'conseil', icon: '🐖', titre: 'Commencer à épargner', texte: 'Une petite épargne régulière, même modeste, crée une sécurité financière sur le long terme.' });
  }
  const pointees = txMois.filter(t => t.statut === 'ok').length;
  const total    = txMois.filter(t => t.typeOp === 'debit').length;
  if (total > 3 && pointees / total < 0.3) {
    conseils.push({ type: 'rappel', icon: '📋', titre: 'Rapprochement en attente', texte: 'Pensez à pointer vos transactions dans le Relevé.' });
  }
  const soldeVirt = await calculerSoldeVirtuel(mois);
  if (soldeVirt < 100 && totalR > 0) {
    conseils.push({ type: 'alerte', icon: '🔴', titre: 'Reste à vivre très faible', texte: `Il ne vous reste que ${formatMontant(soldeVirt)} de disponible.` });
  }
  return conseils;
}

// ==========================================
// SIMULATION
// ==========================================
async function simulerDepense(montant, mois) {
  const soldeVirt  = await calculerSoldeVirtuel(mois);
  const budgets    = await getBudgetsVirtuelsActifs();
  const cagnottes  = await getCagnottes().catch(()=>[]);
  const txMois     = await getTransactionsByMois(mois);
  const revenus    = parseFloat(await getSetting('revenus', 0)) || 0;
  const m          = parseFloat(montant) || 0;
  const impact     = soldeVirt - m;

  // Projection fin de mois
  const today      = new Date();
  const jourDuMois = today.getDate();
  const totalJours = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  const joursRest  = Math.max(1, totalJours - jourDuMois);

  // Dépenses déjà faites ce mois
  const depDeja = txMois
    .filter(t => t.typeOp==='debit' && t.type!=='virtuel')
    .reduce((s,t) => s + (parseFloat(t.montant)||0), 0);

  // Rythme journalier actuel
  const rythmJour  = jourDuMois > 0 ? depDeja / jourDuMois : 0;

  // Projection : dépenses restantes estimées + cette dépense
  const depRestEstim = rythmJour * joursRest;
  const soldeFinMois = Math.max(0, soldeVirt - m - depRestEstim);

  // Reste à vivre par jour après cette dépense
  const resteParJour = joursRest > 0 ? Math.max(0, (soldeVirt - m)) / joursRest : 0;

  // Statut
  let statut, emoji, couleur;
  if (impact > soldeVirt * 0.5)    { statut='confortable'; emoji='✅'; couleur='#a7d2bf'; }
  else if (impact > 0)              { statut='possible';    emoji='⚠️'; couleur='#dcc0a5'; }
  else if (impact > -200)           { statut='risque';      emoji='🔴'; couleur='#f87171'; }
  else                              { statut='danger';      emoji='❌'; couleur='#f87171'; }

  // Enveloppes qui peuvent absorber
  const enveloppesOk = budgets
    .filter(b => (parseFloat(b.cagnotte)||0) >= m)
    .slice(0,3)
    .map(b => ({ id:b.id, nom:b.nom, icone:b.icone||'⬜', solde:parseFloat(b.cagnotte)||0, type:'enveloppe' }));

  // Cagnottes qui peuvent absorber
  const cagnottesOk = cagnottes
    .filter(c => c.actif!==false && (parseFloat(c.solde)||0) >= m)
    .slice(0,3)
    .map(c => ({ id:c.id, nom:c.nom, icone:c.icone||'🏦', solde:parseFloat(c.solde)||0, type:'cagnotte' }));

  return {
    montant:       m,
    soldeAvant:    soldeVirt,
    soldeApres:    Math.max(0, impact),
    impact,
    statut,
    emoji,
    couleur,
    joursRestants: joursRest,
    resteParJour,
    soldeFinMois,
    rythmJour,
    depDeja,
    enveloppesOk,
    cagnottesOk,
    // Compatibilité ancienne API
    message: `${emoji} ${statut==='confortable'?'Achat confortable':statut==='possible'?'Achat possible':statut==='risque'?'Achat risqué':'Budget dépassé'}`,
    alternatives: enveloppesOk,
  };
}

// ==========================================
// UTILITAIRES
// ==========================================
function getMoisCourant() {
  return new Date().toISOString().substring(0, 7);
}
function formatMoisLabel(mois) {
  const [y, m] = mois.split('-');
  const noms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  return `${noms[parseInt(m)-1]} ${y}`;
}
function formatMontant(val) {
  try {
    const n = parseFloat(val) || 0;
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  } catch(e) {
    return '0,00 €';
  }
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch(e) {
    return dateStr;
  }
}

// ==========================================
// SEED
// ==========================================
async function seedDefaultData() {
  const comptes = await getComptes();
  if (!comptes.length) {
    await addCompte({ nom: 'Compte Courant', type: 'courant', actif: true });
  }
}

// ==========================================
// EXPORT GLOBAL
// ==========================================
window.HorizonDB = {
  initDB, seedDefaultData,
  getSetting, setSetting,
  getOnboarding, setOnboarding, isOnboardingDone, markOnboardingDone,
  addTransaction, getTransactionsByMois, getAllTransactions,
  updateTransaction, deleteTransaction,
  calculerSoldeReel, calculerSoldeVirtuel,
  getChargesFixes, addChargeFixes, updateChargeFixes, deleteChargeFixes, injecterChargesDuMois,
  getChargesVariables, addChargeVariable, updateChargeVariable, deleteChargeVariable,
  getBudgetsVirtuels, getBudgetsVirtuelsActifs,
  addBudgetVirtuel, updateBudgetVirtuel, deleteBudgetVirtuel,
  provisionnerBudgetsDuMois, deduireDeCagnotte, getMouvementsBV,
  mouvementManuelCagnotte, transfererEntreEnveloppes,
  getComptes, addCompte, deleteCompte,
  cloturerMois, getClotures, affecterReliquat,
  getCagnottes, getCagnotteById, addCagnotte, updateCagnotte, deleteCagnotte,
  alimenterCagnotte, retirerDeCagnotte, provisionnerCagnottesDuMois, getMouvementsCagnotte,
  calculerScore, getScoreLabel, getProfilGestionnaire,
  calculerBadges, getBadgesDuMois,
  genererConseils, simulerDepense,
  getMoisCourant, formatMoisLabel, formatMontant, formatDate,
  getRevenus, addRevenu, updateRevenu, deleteRevenu, getTotalRevenus,
};
