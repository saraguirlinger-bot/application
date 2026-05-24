/* ============================================
   HORIZON BUDGET — Application principale
   v1.1 — Cagnottes & déduction budgets virtuels
   ============================================ */

/* ==========================================
   ÉCRAN ACCUEIL
   ========================================== */
Screens.accueil = {
  onglet: 'charges', // 'charges' ou 'cagnottes'

  async onEnter() {
    const mois = Format.currentMois();
    const [soldeReel, soldeVirtuel, totaux, chargesFixes, cagnottes, nomFoyer] = await Promise.all([
      calculerSoldeReel(),
      calculerSoldeVirtuel(),
      getTotauxDuMois(mois),
      dbGetAll('chargesFixes'),
      getAllSoldesCagnottes(),
      dbGetParam('nomFoyer')
    ]);

    const totalVirtuel = cagnottes.reduce((a, b) => a + b.montantMensuel, 0);

    document.getElementById('accueil-foyer').textContent         = nomFoyer || 'Mon Foyer';
    document.getElementById('accueil-mois').textContent          = Format.mois(mois);
    document.getElementById('accueil-solde-reel').textContent    = Format.moneyAbs(soldeReel);
    document.getElementById('accueil-solde-virtuel').textContent = Format.moneyAbs(soldeVirtuel);
    document.getElementById('accueil-recettes').textContent      = '+' + Format.moneyAbs(totaux.recettes);
    document.getElementById('accueil-depenses').textContent      = '-' + Format.moneyAbs(totaux.depenses);
    document.getElementById('accueil-pill-virtuels').textContent = '-' + Format.moneyAbs(totalVirtuel);

    this.renderOnglet();
  },

  switchOnglet(onglet) {
    this.onglet = onglet;
    document.getElementById('tab-charges').className   = 'accueil-tab' + (onglet === 'charges'   ? ' active' : '');
    document.getElementById('tab-cagnottes').className = 'accueil-tab' + (onglet === 'cagnottes' ? ' active' : '');
    this.renderOnglet();
  },

  async renderOnglet() {
    const container = document.getElementById('accueil-onglet-content');

    if (this.onglet === 'charges') {
      const chargesFixes = await dbGetAll('chargesFixes');
      const cfActives    = chargesFixes.filter(c => c.actif);
      const budgetsV     = await dbGetAll('budgetsVirtuels');
      const bvActifs     = budgetsV.filter(b => b.actif);

      container.innerHTML = `
        <!-- Charges fixes -->
        <div class="section-title" style="margin-top:4px">Charges fixes du mois</div>
        <div style="padding:0 14px;margin-bottom:14px">
          ${cfActives.length === 0
            ? `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-sub">Aucune charge fixe configurée</div></div>`
            : cfActives.map(cf => `
              <div class="card-row" style="background:var(--surface);border-radius:var(--radius-md);border:1px solid var(--border2);margin-bottom:6px;padding-left:10px;position:relative"
                   onclick="Router.go('chargesFixes')">
                <div style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:32px;background:var(--orange);border-radius:0 3px 3px 0"></div>
                <div class="row-icon" style="background:var(--orange-bg)">${cf.icone || '💳'}</div>
                <div class="row-info">
                  <div class="row-label">${cf.nom}</div>
                  <div class="row-sub">${cf.categorie || 'Charge fixe'}${cf.sousCategorie ? ' · ' + cf.sousCategorie : ''} · Auto 1er</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:0.78rem;font-weight:600;color:var(--orange)">-${Format.moneyAbs(cf.montant)}</div>
                  <div style="font-size:0.58rem;color:var(--green-main);margin-top:2px;cursor:pointer"
                       onclick="event.stopPropagation();Screens.chargesFixes.openEdit(${cf.id})">✏️ Modifier</div>
                </div>
              </div>`).join('')}
        </div>

        <!-- Budgets virtuels résumé -->
        <div class="section-title">Budgets virtuels</div>
        <div style="padding:0 14px;margin-bottom:14px">
          ${bvActifs.length === 0
            ? `<div class="empty-state"><div class="empty-icon">⬜</div><div class="empty-sub">Aucun budget virtuel configuré</div></div>`
            : bvActifs.map(bv => `
              <div class="card-row" style="background:var(--pearl-bg);border-radius:var(--radius-md);border:1px solid var(--pearl-border);margin-bottom:6px;padding-left:10px;position:relative"
                   onclick="Screens.accueil.switchOnglet('cagnottes')">
                <div style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:32px;background:var(--pearl);border-radius:0 3px 3px 0"></div>
                <div class="row-icon" style="background:var(--pearl-bg)">${bv.icone || '💰'}</div>
                <div class="row-info">
                  <div class="row-label" style="color:var(--pearl-dark)">${bv.nom}</div>
                  <span class="badge badge-virtual">⬜ Non rapproché · Virtuel</span>
                </div>
                <div style="font-size:0.78rem;font-weight:600;color:var(--pearl)">-${Format.moneyAbs(bv.montantMensuel)}</div>
              </div>`).join('')}
        </div>`;

    } else {
      // ONGLET CAGNOTTES
      const cagnottes = await getAllSoldesCagnottes();

      if (cagnottes.length === 0) {
        container.innerHTML = `<div class="empty-state" style="margin-top:20px">
          <div class="empty-icon">🏦</div>
          <div class="empty-title">Aucune cagnotte</div>
          <div class="empty-sub">Créez des budgets virtuels pour commencer à épargner par catégorie</div>
          <div class="btn btn-primary" style="margin-top:16px;max-width:200px" onclick="Router.go('budgetsVirtuels')">Créer une cagnotte</div>
        </div>`;
        return;
      }

      const totalCagnottes = cagnottes.reduce((a, b) => a + Math.max(0, b.soldeCagnotte), 0);

      container.innerHTML = `
        <!-- Résumé total cagnottes -->
        <div style="margin:8px 14px 12px;background:linear-gradient(145deg,#3a4a52,#2a3a42);border-radius:18px;padding:14px 18px;position:relative;overflow:hidden;box-shadow:0 8px 24px rgba(42,58,66,0.25)">
          <svg style="position:absolute;top:6px;right:10px;opacity:0.1" width="55" height="55" viewBox="0 0 60 60" fill="none">
            <circle cx="30" cy="30" r="28" stroke="white" stroke-width="1.5" fill="none"/>
            <circle cx="30" cy="30" r="20" stroke="white" stroke-width="1.5" fill="none"/>
            <circle cx="30" cy="30" r="12" stroke="white" stroke-width="1.5" fill="none"/>
            <circle cx="30" cy="30" r="5" fill="white"/>
          </svg>
          <div style="font-size:0.58rem;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;position:relative;z-index:1">Total épargné dans les cagnottes</div>
          <div style="font-family:var(--font-head);font-size:1.6rem;font-weight:700;color:rgba(255,255,255,0.9);position:relative;z-index:1">${Format.moneyAbs(totalCagnottes)}</div>
        </div>

        <!-- Liste des cagnottes -->
        <div class="section-title">Mes cagnottes</div>
        <div style="padding:0 14px;display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          ${cagnottes.map(bv => {
            const solde    = bv.soldeCagnotte || 0;
            const pct      = bv.objectif ? Format.pct(Math.max(0, solde), bv.objectif) : 0;
            const enDeficit = solde < 0;
            return `
            <div class="card animate-in" style="border-color:var(--pearl-border);cursor:pointer" onclick="Screens.cagnotte.open(${bv.id})">
              <div class="card-row" style="cursor:pointer">
                <div class="row-icon" style="background:var(--pearl-bg)">${bv.icone || '💰'}</div>
                <div class="row-info">
                  <div class="row-label" style="color:var(--pearl-dark)">${bv.nom}</div>
                  <div class="row-sub">+${Format.moneyAbs(bv.montantMensuel)} / mois</div>
                </div>
                <div style="text-align:right">
                  <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;color:${enDeficit ? 'var(--red)' : 'var(--pearl-dark)'}">${Format.moneyAbs(solde)}</div>
                  <div style="font-size:0.58rem;color:var(--text3)">${enDeficit ? '⚠️ Déficit' : 'disponible'}</div>
                </div>
              </div>
              ${bv.objectif ? `
              <div style="padding:8px 14px 12px;border-top:1px solid var(--border2)">
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--pearl),var(--pearl-dark))"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.58rem;color:var(--text3);margin-top:4px">
                  <span>${pct}% de l'objectif ${Format.moneyAbs(bv.objectif)}</span>
                  ${bv.echeance ? `<span style="color:var(--green-main)">Échéance ${Format.dateShort(bv.echeance)}</span>` : ''}
                </div>
              </div>` : ''}
            </div>`;
          }).join('')}
        </div>`;
    }
  }
};

/* ==========================================
   ÉCRAN CAGNOTTE (détail + historique)
   ========================================== */
Screens.cagnotte = {
  currentId: null,

  async open(budgetId) {
    this.currentId = budgetId;
    Router.go('cagnotte');
  },

  async onEnter() {
    if (!this.currentId) { Router.back(); return; }
    const [bv, historique] = await Promise.all([
      dbGet('budgetsVirtuels', this.currentId),
      getHistoriqueCagnotte(this.currentId)
    ]);
    if (!bv) { Router.back(); return; }

    const solde = await getSoldeCagnotte(this.currentId);

    document.getElementById('cagnotte-icon').textContent  = bv.icone || '💰';
    document.getElementById('cagnotte-nom').textContent   = bv.nom;
    document.getElementById('cagnotte-solde').textContent = Format.moneyAbs(solde);
    document.getElementById('cagnotte-solde').style.color = solde < 0 ? 'var(--red)' : 'var(--pearl-dark)';
    document.getElementById('cagnotte-mensuel').textContent = `+${Format.moneyAbs(bv.montantMensuel)} / mois`;

    const listeEl = document.getElementById('cagnotte-liste');
    listeEl.innerHTML = historique.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-sub">Aucun mouvement pour l'instant</div></div>`
      : historique.map(m => `
          <div class="card-row animate-in" style="background:var(--surface);border-radius:var(--radius-md);border:1px solid var(--border2);margin-bottom:4px;cursor:default">
            <div class="tx-stripe" style="background:${m.type === 'provision' ? 'var(--pearl)' : 'var(--red)'}"></div>
            <div class="row-icon" style="background:${m.type === 'provision' ? 'var(--pearl-bg)' : 'var(--red-bg)'}">
              ${m.type === 'provision' ? '💰' : '💸'}
            </div>
            <div class="row-info">
              <div class="row-label">${m.libelle}</div>
              <div class="row-sub">${Format.date(m.date)}</div>
            </div>
            <div style="font-size:0.8rem;font-weight:700;color:${m.type === 'provision' ? 'var(--pearl-dark)' : 'var(--red)'}">
              ${m.type === 'provision' ? '+' : '-'}${Format.moneyAbs(m.montant)}
            </div>
          </div>`).join('');
  }
};

/* ==========================================
   ÉCRAN RELEVÉ
   ========================================== */
Screens.releve = {
  moisCourant: Format.currentMois(),
  compteIdFiltre: null,

  async onEnter() {
    this.moisCourant    = Format.currentMois();
    this.compteIdFiltre = null;
    await this.loadComptes();
    await this.render();
  },

  async loadComptes() {
    const comptes = await dbGetAll('comptes');
    const el = document.getElementById('releve-comptes-chips');
    el.innerHTML = `<div class="chip active" onclick="Screens.releve.filtrerCompte(null, this)">Tous</div>`
      + comptes.filter(c => c.actif).map(c =>
        `<div class="chip" onclick="Screens.releve.filtrerCompte(${c.id}, this)">${c.icone} ${c.nom}</div>`
      ).join('');
  },

  async filtrerCompte(compteId, el) {
    document.querySelectorAll('#releve-comptes-chips .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    this.compteIdFiltre = compteId;
    await this.render();
  },

  async render() {
    let txs = await getTransactionsDuMois(this.moisCourant);
    if (this.compteIdFiltre) txs = txs.filter(t => t.compteId === this.compteIdFiltre);

    const nbAttente = txs.filter(t => t.statut === 'attente').length;
    document.getElementById('releve-count').textContent = `${txs.length} opération${txs.length > 1 ? 's' : ''}`;
    document.getElementById('releve-mois').textContent  = Format.mois(this.moisCourant);

    const alerteEl = document.getElementById('releve-alerte');
    if (nbAttente > 0) {
      alerteEl.style.display = 'flex';
      document.getElementById('releve-alerte-count').textContent =
        `${nbAttente} transaction${nbAttente > 1 ? 's' : ''} en attente de pointage`;
    } else {
      alerteEl.style.display = 'none';
    }

    const container = document.getElementById('releve-list');
    if (txs.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">Aucune transaction</div>
        <div class="empty-sub">Ajoutez votre première transaction en appuyant sur +</div>
      </div>`;
      return;
    }

    const groups = groupByDate(txs);
    container.innerHTML = groups.map(([date, items]) => `
      <div class="date-separator">${Format.date(date)}</div>
      ${items.map(tx => {
        const cfg          = StatutConfig[tx.statut] || StatutConfig.attente;
        const isVirtual    = tx.statut === 'virtuel';
        const montantColor = tx.type === 'credit' ? 'var(--green-ok)' : isVirtual ? 'var(--pearl)' : 'var(--red)';
        const bvBadge      = tx.budgetVirtuelId
          ? `<div style="font-size:0.55rem;color:var(--pearl);margin-top:2px">⬜ Déduit cagnotte</div>` : '';
        return `
        <div class="card-row animate-in" style="background:var(--surface);border-radius:var(--radius-md);border:1px solid var(--border2);margin-bottom:4px"
             onclick="Screens.releve.openDetail(${tx.id})">
          <div class="tx-stripe" style="background:${cfg.color}"></div>
          <div class="row-icon" style="background:${cfg.bg}">${tx.icone || '💳'}</div>
          <div class="row-info">
            <div class="row-label">${tx.libelle || 'Sans libellé'}</div>
            <div class="row-sub">${tx.categorie || ''}${tx.sousCategorie ? ' · ' + tx.sousCategorie : ''}</div>
            ${bvBadge}
          </div>
          <div style="font-size:0.8rem;font-weight:700;color:${montantColor};margin-right:6px">
            ${tx.type === 'credit' ? '+' : '-'}${Format.moneyAbs(tx.montant)}
          </div>
          <div style="width:22px;height:22px;border-radius:7px;display:flex;align-items:center;justify-content:center;
                      font-size:0.68rem;background:${cfg.bg};color:${cfg.color};flex-shrink:0;cursor:pointer"
               onclick="event.stopPropagation();Screens.releve.cycleStatut(${tx.id})">${cfg.icon}</div>
        </div>`;
      }).join('')}
    `).join('');
  },

  async cycleStatut(txId) {
    const tx = await dbGet('transactions', txId);
    if (!tx || tx.statut === 'virtuel') return;
    const cfg = StatutConfig[tx.statut];
    if (!cfg || !cfg.next) return;
    tx.statut = cfg.next;
    await dbPut('transactions', tx);
    const labels = { pointe: '✅ Pointé', anomalie: '⚠️ Anomalie', attente: '🔄 En attente' };
    showToast(labels[tx.statut] || '');
    await this.render();
  },

  async openDetail(txId) {
    const tx = await dbGet('transactions', txId);
    if (!tx) return;
    const cfg = StatutConfig[tx.statut] || StatutConfig.attente;
    document.getElementById('detail-libelle').textContent   = tx.libelle || 'Sans libellé';
    document.getElementById('detail-montant').textContent   = (tx.type === 'credit' ? '+' : '-') + Format.moneyAbs(tx.montant);
    document.getElementById('detail-montant').style.color   = tx.type === 'credit' ? 'var(--green-ok)' : 'var(--red)';
    document.getElementById('detail-date').textContent      = Format.date(tx.date);
    document.getElementById('detail-categorie').textContent = tx.categorie || 'Non catégorisé';
    document.getElementById('detail-souscat').textContent   = tx.sousCategorie || '';
    document.getElementById('detail-compte').textContent    = tx.compteNom || '';
    document.getElementById('detail-statut').textContent    = cfg.label;
    document.getElementById('detail-statut').style.color    = cfg.color;
    document.getElementById('detail-delete-btn').onclick    = () => this.deleteTx(tx.id);
    Modal.open('detail');
  },

  async deleteTx(txId) {
    await dbDelete('transactions', txId);
    Modal.close('detail');
    showToast('🗑️ Transaction supprimée');
    await this.render();
  }
};

/* ==========================================
   ÉCRAN SAISIE
   ========================================== */
Screens.saisie = {
  type: 'debit',
  numpad: null,
  selectedCategorie: null,
  selectedSousCategorie: null,
  selectedCompteId: null,
  selectedDate: Format.today(),
  selectedBudgetVirtuelId: null,

  async onEnter() {
    this.type                   = 'debit';
    this.selectedCategorie      = null;
    this.selectedSousCategorie  = null;
    this.selectedDate           = Format.today();
    this.selectedBudgetVirtuelId = null;

    document.getElementById('saisie-cat-val').textContent     = 'Choisir...';
    document.getElementById('saisie-cat-val').classList.add('empty');
    document.getElementById('saisie-libelle-val').textContent = 'Saisir un libellé...';
    document.getElementById('saisie-libelle-val').classList.add('empty');
    document.getElementById('saisie-date-val').textContent    = "Aujourd'hui";
    document.getElementById('saisie-bv-row').style.display    = 'none';
    document.getElementById('saisie-bv-val').textContent      = 'Aucun';

    const comptes = await dbGetAll('comptes');
    const actifs  = comptes.filter(c => c.actif);
    this.selectedCompteId = actifs[0]?.id || null;
    document.getElementById('saisie-compte-val').textContent = actifs[0]?.nom || '';

    this.numpad = NumpadController('saisie-amount', 'saisie-cursor', 'var(--red)');
    this.updateType('debit');
  },

  updateType(type) {
    this.type = type;
    document.getElementById('toggle-debit').className  = 'toggle-btn' + (type === 'debit'  ? ' active-debit'  : '');
    document.getElementById('toggle-credit').className = 'toggle-btn' + (type === 'credit' ? ' active-credit' : '');
    const color = type === 'credit' ? 'var(--green-ok)' : 'var(--red)';
    document.getElementById('saisie-amount').style.color = color;
    const cur = document.getElementById('saisie-cursor');
    if (cur) cur.style.background = color;
    // Masquer l'option cagnotte pour les recettes
    document.getElementById('saisie-bv-row').style.display = type === 'debit' ? '' : 'none';
  },

  async openCatPicker() {
    const cats     = await dbGetAll('categories');
    const relevant = this.type === 'credit'
      ? cats.filter(c => c.nom === 'Recettes')
      : cats.filter(c => c.nom !== 'Recettes');

    document.getElementById('souscat-list').style.display = 'none';
    document.getElementById('cat-list').style.display     = 'block';
    document.getElementById('modal-catPicker').querySelector('.modal-title').textContent = 'Catégorie';

    document.getElementById('cat-list').innerHTML = relevant.map(c => `
      <div class="card-row" onclick="Screens.saisie.selectCat('${c.nom}', '${c.icone}', ${JSON.stringify(c.sousCategories)})">
        <div class="row-icon" style="background:var(--green-pale)">${c.icone}</div>
        <div class="row-info"><div class="row-label">${c.nom}</div></div>
        <div class="row-arrow">›</div>
      </div>`).join('');

    Modal.open('catPicker');
  },

  selectCat(nom, icone, sousCats) {
    this.selectedCategorie     = nom;
    this.selectedSousCategorie = null;
    document.getElementById('saisie-cat-val').textContent = `${icone} ${nom}`;
    document.getElementById('saisie-cat-val').classList.remove('empty');

    if (sousCats && sousCats.length > 0) {
      document.getElementById('cat-list').style.display     = 'none';
      document.getElementById('souscat-list').style.display = 'block';
      document.getElementById('modal-catPicker').querySelector('.modal-title').textContent = nom;
      document.getElementById('souscat-list').innerHTML = sousCats.map(sc => `
        <div class="card-row" onclick="Screens.saisie.selectSousCat('${sc}', '${icone}')">
          <div class="row-info"><div class="row-label">${sc}</div></div>
          <div class="row-arrow">›</div>
        </div>`).join('');
    } else {
      Modal.close('catPicker');
    }
  },

  selectSousCat(sc, icone) {
    this.selectedSousCategorie = sc;
    document.getElementById('saisie-cat-val').textContent = `${icone} ${this.selectedCategorie} · ${sc}`;
    Modal.close('catPicker');
  },

  async openComptePicker() {
    const comptes = await dbGetAll('comptes');
    document.getElementById('compte-list').innerHTML = comptes.filter(c => c.actif).map(c => `
      <div class="card-row" onclick="Screens.saisie.selectCompte(${c.id}, '${c.nom}')">
        <div class="row-icon" style="background:var(--green-pale)">${c.icone}</div>
        <div class="row-info"><div class="row-label">${c.nom}</div></div>
        <div class="row-arrow">›</div>
      </div>`).join('');
    Modal.open('comptePicker');
  },

  selectCompte(id, nom) {
    this.selectedCompteId = id;
    document.getElementById('saisie-compte-val').textContent = nom;
    Modal.close('comptePicker');
  },

  // ✨ Sélecteur de cagnotte
  async openBudgetVirtuelPicker() {
    const cagnottes = await getAllSoldesCagnottes();
    document.getElementById('bv-picker-list').innerHTML = cagnottes.length === 0
      ? `<div class="empty-state"><div class="empty-sub">Aucune cagnotte disponible</div></div>`
      : [
          `<div class="card-row" onclick="Screens.saisie.selectBV(null, 'Aucun')">
            <div class="row-info"><div class="row-label" style="color:var(--text3)">Ne pas déduire d'une cagnotte</div></div>
          </div>`,
          ...cagnottes.map(bv => `
            <div class="card-row" onclick="Screens.saisie.selectBV(${bv.id}, '${bv.nom}')">
              <div class="row-icon" style="background:var(--pearl-bg)">${bv.icone || '💰'}</div>
              <div class="row-info">
                <div class="row-label" style="color:var(--pearl-dark)">${bv.nom}</div>
                <div class="row-sub">Disponible : ${Format.moneyAbs(bv.soldeCagnotte)}</div>
              </div>
              <div class="row-arrow">›</div>
            </div>`)
        ].join('');
    Modal.open('bvPicker');
  },

  selectBV(id, nom) {
    this.selectedBudgetVirtuelId = id;
    document.getElementById('saisie-bv-val').textContent = id ? nom : 'Aucun';
    Modal.close('bvPicker');
  },

  async save() {
    const montant = this.numpad?.getValue() || 0;
    if (montant <= 0) { showToast('⚠️ Montant invalide'); return; }

    const libelle = document.getElementById('saisie-libelle-val').classList.contains('empty')
      ? '' : document.getElementById('saisie-libelle-val').textContent;

    const comptes = await dbGetAll('comptes');
    const compte  = comptes.find(c => c.id === this.selectedCompteId);
    const cats    = await dbGetAll('categories');
    const cat     = cats.find(c => c.nom === this.selectedCategorie);

    const txId = await dbAdd('transactions', {
      montant,
      type:              this.type,
      libelle:           libelle || (this.type === 'credit' ? 'Recette' : 'Dépense'),
      categorie:         this.selectedCategorie     || 'Divers',
      sousCategorie:     this.selectedSousCategorie || '',
      icone:             cat?.icone || (this.type === 'credit' ? '💶' : '💳'),
      iconeCategorie:    cat?.icone || '📦',
      compteId:          this.selectedCompteId,
      compteNom:         compte?.nom || '',
      date:              this.selectedDate,
      statut:            'attente',
      budgetVirtuelId:   this.selectedBudgetVirtuelId || null,
      createdAt:         new Date().toISOString()
    });

    // ✨ Déduire de la cagnotte si sélectionnée
    if (this.selectedBudgetVirtuelId && this.type === 'debit') {
      await deduireDuBudgetVirtuel(
        this.selectedBudgetVirtuelId,
        montant,
        libelle || 'Dépense',
        txId
      );
      showToast('✅ Transaction ajoutée · Cagnotte mise à jour');
    } else {
      showToast('✅ Transaction ajoutée');
    }

    Router.go('releve');
  },

  promptLibelle() {
    const current = document.getElementById('saisie-libelle-val');
    const val = prompt('Libellé :', current.classList.contains('empty') ? '' : current.textContent);
    if (val !== null && val.trim()) {
      current.textContent = val.trim();
      current.classList.remove('empty');
    }
  }
};

/* ==========================================
   ÉCRAN STATISTIQUES
   ========================================== */
Screens.stats = {
  moisCourant: Format.currentMois(),

  async onEnter() {
    this.moisCourant = Format.currentMois();
    document.getElementById('stats-mois').textContent = Format.mois(this.moisCourant);
    await this.render();
  },

  async render() {
    const [depensesParCat, totaux, historique] = await Promise.all([
      getDepensesParCategorie(this.moisCourant),
      getTotauxDuMois(this.moisCourant),
      getHistoriqueMensuel(6)
    ]);

    document.getElementById('stats-total-dep').textContent   = Format.moneyAbs(totaux.depenses);
    document.getElementById('stats-total-rec').textContent   = Format.moneyAbs(totaux.recettes);
    document.getElementById('stats-solde-mois').textContent  = Format.money(totaux.recettes - totaux.depenses);
    document.getElementById('stats-solde-mois').style.color  =
      totaux.recettes >= totaux.depenses ? 'var(--green-ok)' : 'var(--red)';

    const catEl = document.getElementById('stats-cat-list');
    catEl.innerHTML = depensesParCat.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-sub">Aucune dépense ce mois</div></div>`
      : depensesParCat.map(([cat, data]) => {
          const pct = Format.pct(data.montant, totaux.depenses);
          return `
          <div class="card-row" style="background:var(--surface);border-radius:var(--radius-md);border:1px solid var(--border2);margin-bottom:4px;cursor:default">
            <div class="row-icon" style="background:var(--green-pale)">${data.icone}</div>
            <div class="row-info">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <div class="row-label">${cat}</div>
                <div style="font-size:0.72rem;font-weight:600">${Format.moneyAbs(data.montant)}</div>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${pct}%;background:var(--green-main)"></div>
              </div>
              <div style="font-size:0.58rem;color:var(--text3);margin-top:3px">${pct}% · ${data.count} transaction${data.count > 1 ? 's' : ''}</div>
            </div>
          </div>`;
        }).join('');

    this.renderChart(historique);
  },

  renderChart(historique) {
    const el = document.getElementById('stats-chart');
    if (!el || historique.length === 0) return;
    const maxVal = Math.max(...historique.map(h => Math.max(h.recettes, h.depenses)), 1);
    const w = 260, pts = historique.length;
    const stepX = w / (pts - 1 || 1);
    const polyRec = historique.map((h, i) => `${i * stepX},${70 - (h.recettes / maxVal * 60)}`).join(' ');
    const polyDep = historique.map((h, i) => `${i * stepX},${70 - (h.depenses / maxVal * 60)}`).join(' ');

    el.innerHTML = `
      <svg viewBox="0 0 ${w} 80" style="width:100%;height:80px;overflow:visible">
        <defs>
          <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22c55e" stop-opacity="0.3"/><stop offset="100%" stop-color="#22c55e" stop-opacity="0"/></linearGradient>
          <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d63b3b" stop-opacity="0.2"/><stop offset="100%" stop-color="#d63b3b" stop-opacity="0"/></linearGradient>
        </defs>
        <line x1="0" y1="23" x2="${w}" y2="23" stroke="var(--border2)" stroke-width="0.5"/>
        <line x1="0" y1="46" x2="${w}" y2="46" stroke="var(--border2)" stroke-width="0.5"/>
        <line x1="0" y1="69" x2="${w}" y2="69" stroke="var(--border2)" stroke-width="0.5"/>
        <polygon points="${polyRec} ${(pts-1)*stepX},80 0,80" fill="url(#gR)"/>
        <polygon points="${polyDep} ${(pts-1)*stepX},80 0,80" fill="url(#gD)"/>
        <polyline points="${polyRec}" fill="none" stroke="var(--green-ok)" stroke-width="2" stroke-linejoin="round"/>
        <polyline points="${polyDep}" fill="none" stroke="var(--red)" stroke-width="2" stroke-linejoin="round"/>
        ${historique.map((h, i) => `<text x="${i*stepX}" y="80" font-size="7" fill="var(--text3)" text-anchor="middle" font-family="DM Sans">${Format.moisCourt(h.mois)}</text>`).join('')}
      </svg>`;
  }
};

/* ==========================================
   ÉCRAN PARAMÈTRES
   ========================================== */
Screens.parametres = {
  async onEnter() {
    const [nomFoyer, soldeInit, dateInit, alerteBudget, alerteCF, alerteIA] = await Promise.all([
      dbGetParam('nomFoyer'), dbGetParam('soldeInitial'), dbGetParam('dateInitial'),
      dbGetParam('alerteBudget'), dbGetParam('alerteChargesFixes'), dbGetParam('alerteIA')
    ]);
    document.getElementById('param-foyer-val').textContent = nomFoyer || 'Mon Foyer';
    document.getElementById('param-solde-val').textContent = Format.moneyAbs(parseFloat(soldeInit) || 0);
    document.getElementById('param-date-val').textContent  = dateInit ? Format.dateShort(dateInit) : 'Non définie';
    document.getElementById('param-toggle-budget').className = `param-toggle${alerteBudget  !== false ? '' : ' off'}`;
    document.getElementById('param-toggle-cf').className     = `param-toggle${alerteCF      !== false ? '' : ' off'}`;
    document.getElementById('param-toggle-ia').className     = `param-toggle${alerteIA      !== false ? '' : ' off'}`;
  },

  async toggleAlerte(cle, btnId) {
    const current = await dbGetParam(cle);
    const next    = current === false ? true : false;
    await dbSetParam(cle, next);
    document.getElementById(btnId).className = `param-toggle${next ? '' : ' off'}`;
    showToast(next ? '🔔 Alerte activée' : '🔕 Alerte désactivée');
  },

  promptNomFoyer() {
    const val = prompt('Nom de votre foyer :', document.getElementById('param-foyer-val').textContent);
    if (val?.trim()) {
      dbSetParam('nomFoyer', val.trim()).then(() => {
        document.getElementById('param-foyer-val').textContent = val.trim();
        showToast('✅ Nom mis à jour');
      });
    }
  },

  promptSoldeInit() {
    const current = document.getElementById('param-solde-val').textContent.replace(' €','').replace(',','.');
    const val = prompt('Solde initial (€) :', current);
    if (val !== null) {
      const montant = parseFloat(val.replace(',', '.')) || 0;
      Promise.all([dbSetParam('soldeInitial', montant), dbSetParam('dateInitial', Format.today())]).then(() => {
        document.getElementById('param-solde-val').textContent = Format.moneyAbs(montant);
        document.getElementById('param-date-val').textContent  = Format.dateShort(Format.today());
        showToast('✅ Solde initial mis à jour');
      });
    }
  }
};

/* ==========================================
   CHARGES FIXES
   ========================================== */
Screens.chargesFixes = {
  async onEnter() { await this.render(); },

  async render() {
    const charges = await dbGetAll('chargesFixes');
    const actives = charges.filter(c => c.actif);
    document.getElementById('cf-list').innerHTML = actives.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Aucune charge fixe</div><div class="empty-sub">Ajoutez vos charges récurrentes</div></div>`
      : actives.map(cf => `
          <div class="card-row animate-in" style="background:var(--surface);border-radius:var(--radius-md);border:1px solid var(--border2);margin-bottom:6px"
               onclick="Screens.chargesFixes.openEdit(${cf.id})">
            <div class="row-icon" style="background:var(--orange-bg)">${cf.icone || '💳'}</div>
            <div class="row-info">
              <div class="row-label">${cf.nom}</div>
              <div class="row-sub">${cf.categorie || ''}${cf.sousCategorie ? ' · ' + cf.sousCategorie : ''} · Auto 1er</div>
            </div>
            <div style="font-size:0.78rem;font-weight:600;color:var(--orange)">${Format.moneyAbs(cf.montant)} ›</div>
          </div>`).join('');
  },

  async add() {
    const nom     = document.getElementById('cf-nom').value.trim();
    const montant = parseFloat(document.getElementById('cf-montant').value.replace(',','.')) || 0;
    const cat     = document.getElementById('cf-categorie').value.trim();
    const souscat = document.getElementById('cf-souscat').value.trim();
    if (!nom)     { showToast('⚠️ Nom requis');    return; }
    if (!montant) { showToast('⚠️ Montant requis'); return; }
    await dbAdd('chargesFixes', { nom, montant, categorie: cat, sousCategorie: souscat, icone: '💳', actif: true, createdAt: new Date().toISOString() });
    await this.injecterCharge({ nom, montant, categorie: cat, sousCategorie: souscat, icone: '💳' });
    ['cf-nom','cf-montant','cf-categorie','cf-souscat'].forEach(id => document.getElementById(id).value = '');
    Modal.close('newCF');
    showToast('✅ Charge fixe ajoutée');
    await this.render();
  },

  async openEdit(id) {
    const cf = await dbGet('chargesFixes', id);
    if (!cf) return;
    document.getElementById('edit-cf-id').value      = cf.id;
    document.getElementById('edit-cf-nom').value     = cf.nom;
    document.getElementById('edit-cf-montant').value = cf.montant;
    Modal.open('editCF');
  },

  async saveEdit() {
    const id      = parseInt(document.getElementById('edit-cf-id').value);
    const nom     = document.getElementById('edit-cf-nom').value.trim();
    const montant = parseFloat(document.getElementById('edit-cf-montant').value.replace(',','.')) || 0;
    if (!nom || !montant) { showToast('⚠️ Champs requis'); return; }
    const cf = await dbGet('chargesFixes', id);
    if (!cf) return;
    cf.nom = nom; cf.montant = montant;
    await dbPut('chargesFixes', cf);
    Modal.close('editCF');
    showToast('✅ Charge modifiée');
    await this.render();
  },

  async injecterCharge(cf) {
    const mois = Format.currentMois();
    await dbAdd('transactions', {
      montant: cf.montant, type: 'debit', libelle: cf.nom,
      categorie: cf.categorie || 'Charges fixes', sousCategorie: cf.sousCategorie || '',
      icone: cf.icone || '💳', compteId: null, compteNom: '',
      date: `${mois}-01`, statut: 'attente',
      chargeFixeId: cf.id || null, createdAt: new Date().toISOString()
    });
  },

  async injecterToutesLeChargesDuMois() {
    const mois     = Format.currentMois();
    const dejaFait = await dbGetParam('injectionFaiteMois');
    if (dejaFait === mois) return;
    const charges  = await dbGetAll('chargesFixes');
    const txDuMois = await getTransactionsDuMois(mois);
    for (const cf of charges.filter(c => c.actif)) {
      if (!txDuMois.find(t => t.chargeFixeId === cf.id)) await this.injecterCharge({ ...cf });
    }
    await dbSetParam('injectionFaiteMois', mois);
  }
};

/* ==========================================
   BUDGETS VIRTUELS
   ========================================== */
Screens.budgetsVirtuels = {
  selectedEmoji: '💰',

  async onEnter() { await this.render(); },

  async render() {
    const cagnottes = await getAllSoldesCagnottes();
    const total     = cagnottes.reduce((a, b) => a + b.montantMensuel, 0);
    document.getElementById('bv-total').textContent = Format.moneyAbs(total);
    document.getElementById('bv-count').textContent = `${cagnottes.length} budget${cagnottes.length > 1 ? 's' : ''} actif${cagnottes.length > 1 ? 's' : ''}`;

    document.getElementById('bv-list').innerHTML = cagnottes.length === 0
      ? `<div class="empty-state"><div class="empty-icon">⬜</div><div class="empty-title">Aucun budget virtuel</div><div class="empty-sub">Provisionnez vos dépenses futures</div></div>`
      : cagnottes.map(bv => {
          const pct = bv.objectif ? Format.pct(Math.max(0, bv.soldeCagnotte), bv.objectif) : 0;
          return `
          <div class="card animate-in" style="border-color:var(--pearl-border);margin-bottom:10px">
            <div class="card-row" style="cursor:default">
              <div class="row-icon" style="background:var(--pearl-bg)">${bv.icone || '💰'}</div>
              <div class="row-info">
                <div class="row-label" style="color:var(--pearl-dark)">${bv.nom}</div>
                <div class="row-sub">${Format.moneyAbs(bv.montantMensuel)} / mois</div>
                <span class="badge badge-virtual" style="margin-top:3px">⬜ Non rapproché</span>
              </div>
              <div style="text-align:right">
                <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;color:${bv.soldeCagnotte < 0 ? 'var(--red)' : 'var(--pearl-dark)'}">
                  ${Format.moneyAbs(bv.soldeCagnotte)}
                </div>
                <div style="font-size:0.57rem;color:var(--text3)">dans la cagnotte</div>
              </div>
            </div>
            ${bv.objectif ? `
            <div style="padding:10px 14px 12px;border-top:1px solid var(--border2)">
              <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--pearl),var(--pearl-dark))"></div></div>
              <div style="display:flex;justify-content:space-between;font-size:0.58rem;color:var(--text3);margin-top:4px">
                <span>${pct}% · objectif ${Format.moneyAbs(bv.objectif)}</span>
                ${bv.echeance ? `<span style="color:var(--green-main)">Échéance ${Format.dateShort(bv.echeance)}</span>` : ''}
              </div>
            </div>` : ''}
            <div style="display:flex;border-top:1px solid var(--border2)">
              <div style="flex:1;padding:9px;text-align:center;font-size:0.65rem;color:var(--text2);cursor:pointer;border-right:1px solid var(--border2)"
                   onclick="Screens.budgetsVirtuels.openEdit(${bv.id})">✏️ Modifier</div>
              <div style="flex:1;padding:9px;text-align:center;font-size:0.65rem;color:var(--green-main);cursor:pointer;border-right:1px solid var(--border2)"
                   onclick="Screens.cagnotte.open(${bv.id})">📋 Historique</div>
              <div style="flex:1;padding:9px;text-align:center;font-size:0.65rem;color:var(--red);cursor:pointer"
                   onclick="Screens.budgetsVirtuels.delete(${bv.id})">🗑️</div>
            </div>
          </div>`;
        }).join('');
  },

  async add() {
    const nom      = document.getElementById('bv-nom').value.trim();
    const montant  = parseFloat(document.getElementById('bv-montant').value.replace(',','.')) || 0;
    const objectif = parseFloat(document.getElementById('bv-objectif').value.replace(',','.')) || null;
    const echeance = document.getElementById('bv-echeance').value || null;
    if (!nom)     { showToast('⚠️ Nom requis');    return; }
    if (!montant) { showToast('⚠️ Montant requis'); return; }
    await dbAdd('budgetsVirtuels', { nom, montantMensuel: montant, icone: this.selectedEmoji, objectif, echeance, soldeCagnotte: 0, actif: true, createdAt: new Date().toISOString() });
    ['bv-nom','bv-montant','bv-objectif','bv-echeance'].forEach(id => document.getElementById(id).value = '');
    Modal.close('newBV');
    showToast('✅ Budget virtuel créé');
    await provisionnerBudgetsDuMois();
    await this.render();
  },

  async openEdit(id) {
    const bv = await dbGet('budgetsVirtuels', id);
    if (!bv) return;
    document.getElementById('edit-bv-id').value      = bv.id;
    document.getElementById('edit-bv-nom').value     = bv.nom;
    document.getElementById('edit-bv-montant').value = bv.montantMensuel;
    Modal.open('editBV');
  },

  async saveEdit() {
    const id      = parseInt(document.getElementById('edit-bv-id').value);
    const nom     = document.getElementById('edit-bv-nom').value.trim();
    const montant = parseFloat(document.getElementById('edit-bv-montant').value.replace(',','.')) || 0;
    if (!nom || !montant) { showToast('⚠️ Champs requis'); return; }
    const bv = await dbGet('budgetsVirtuels', id);
    if (!bv) return;
    bv.nom = nom; bv.montantMensuel = montant;
    await dbPut('budgetsVirtuels', bv);
    Modal.close('editBV');
    showToast('✅ Budget modifié');
    await this.render();
  },

  async delete(id) {
    if (!confirm('Supprimer ce budget virtuel ?')) return;
    await dbDelete('budgetsVirtuels', id);
    showToast('🗑️ Budget supprimé');
    await this.render();
  },

  selectEmoji(emoji, el) {
    this.selectedEmoji = emoji;
    document.querySelectorAll('#bv-emoji-grid .emoji-btn').forEach(b => b.classList.remove('sel'));
    el.classList.add('sel');
  }
};
