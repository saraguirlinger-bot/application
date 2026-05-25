/* ============================================
   HORIZON BUDGET v3.1 — app.js
   Corrections : cagnotte, saisie, dépassement,
   charges variables, clôture de mois
   ============================================ */

const D = () => window.HorizonDB;

let MOIS          = '';
let installPrompt = null;
let saisieType    = 'debit';
let saisieCat     = '';
let saisieCompte  = 'Compte Courant';
let saisieBudget  = null;   // { type: 'enveloppe'|'cagnotte'|'imprevus', id: null }
let bvEmoji       = '🏖️';
let onbStep       = 0;
const onbData     = { charges:[], enveloppes:[], epargne:[] };

window.numpadSaisie = null;
window.onbData      = onbData;

/* ==========================================
   CATÉGORIES
   ========================================== */
const CATS = [
  { nom:'Logement',     e:'🏠', sub:['Loyer','Crédit immo','Charges','Travaux'] },
  { nom:'Crédit',       e:'💳', sub:['Crédit voiture','Crédit conso','Rachat'] },
  { nom:'Énergie',      e:'⚡', sub:['Électricité','Gaz','Eau','Internet','Tél'] },
  { nom:'Abonnements',  e:'📱', sub:['Netflix','Spotify','Amazon','Sport'] },
  { nom:'Alimentation', e:'🛒', sub:['Courses','Marché','Drive','Bio'] },
  { nom:'Transport',    e:'🚗', sub:['Carburant','Assurance auto','Entretien','TC'] },
  { nom:'Santé',        e:'💊', sub:['Médecin','Pharmacie','Dentiste','Mutuelle'] },
  { nom:'Loisirs',      e:'🎭', sub:['Sorties','Cinéma','Restaurants','Vacances'] },
  { nom:'Vêtements',    e:'👗', sub:['Adultes','Enfants','Chaussures'] },
  { nom:'Enfants',      e:'👶', sub:['École','Activités','Garde'] },
  { nom:'Épargne',      e:'🐖', sub:['Livret A','Assurance vie','PEA'] },
  { nom:'Recettes',     e:'💰', sub:['Salaire','CAF','Pension','Freelance'] },
  { nom:'Animaux',      e:'🐾', sub:['Nourriture','Vétérinaire'] },
  { nom:'Cadeaux',      e:'🎁', sub:['Anniversaires','Fêtes'] },
  { nom:'Imprévus',     e:'🛡️', sub:['Réparation','Urgence','Divers'] },
  { nom:'Divers',       e:'📦', sub:['Autre'] },
];

const EMOJIS = ['🏖️','🎄','🚗','🏠','🎓','💊','✈️','🎁','🏋️','🎭','🐾','📱','🍽️','🎸','🌿','🛒','🐖','🛡️','🔧','👗','💍','🎯','🔑','🌍'];

/* ==========================================
   UTILITAIRES
   ========================================== */
function h(s)   { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function a(s)   { return String(s||'').replace(/'/g,"\\'"); }
function $(id)  { return document.getElementById(id); }
function txt(id, v) { const el=$(id); if(el) el.textContent=v; }
function fmt(v) { return D().formatMontant(v); }
function fmtD(v){ return D().formatDate(v); }

/* ==========================================
   INIT
   ========================================== */
async function appInit() {
  await D().initDB();
  await D().seedDefaultData();
  const savedMois = await D().getSetting('moisCourant', null);
  MOIS = savedMois || D().getMoisCourant();
  try {
    await D().injecterChargesDuMois(MOIS);
    await D().provisionnerBudgetsDuMois(MOIS);
    await D().provisionnerCagnottesDuMois(MOIS);
  } catch(e) {}
  const done = await D().isOnboardingDone();
  if (!done) { showOnboarding(); return; }
  startApp();
}
window.appInit = appInit;

async function startApp() {
  initPWA();
  // Forcer le rendu de l'accueil même si le Router pense être déjà dessus
  Router.go('accueil', { force: true });
  // Fallback : si le Router ne déclenche pas onEnter (ex: premier chargement),
  // on appelle directement la fonction d'init après un tick
  setTimeout(async () => {
    const el = $('screen-accueil');
    // Si l'écran est visible mais vide (solde encore à "0,00 €"), on force
    const soldeEl = $('accueil-solde-virtuel');
    if (el && soldeEl && soldeEl.textContent === '0,00 €') {
      await chargerAccueil();
    }
  }, 150);
  const key = localStorage.getItem('horizon_licence_key');
  txt('param-licence-val', key ? key+' · Active' : 'Non activée');
}
window.demarrerApp = startApp;

/* ==========================================
   ONBOARDING v2 — Séparation enveloppes / cagnottes
   ========================================== */

// 7 étapes : intro, revenus, charges, enveloppes, cagnottes, solde, fin
const ONB_STEPS = [
  { type:'intro' },
  { type:'revenus', champs:[{k:'salaire',l:'Salaire net',i:'💼'},{k:'aides',l:'Aides (CAF…)',i:'🏛️'},{k:'pension',l:'Pension/Retraite',i:'👴'},{k:'autres',l:'Autres revenus',i:'➕'}] },
  { type:'charges' },
  { type:'enveloppes' },
  { type:'cagnottes' },
  { type:'solde', champs:[{k:'soldeReel',l:'Solde actuel',i:'🏦'},{k:'decouvert',l:'Découvert à combler',i:'⚠️'}] },
  { type:'fin' },
];

// Labels et métadonnées visuelles par étape
const ONB_META = {
  intro:      { emoji:'👋', titre:'Bienvenue sur Horizon Budget', sub:'Configurons ensemble votre budget en quelques étapes.' },
  revenus:    { emoji:'💰', titre:'Vos revenus mensuels', sub:'Renseignez vos revenus nets réguliers.' },
  charges:    { emoji:'📋', titre:'Charges fixes', sub:'Loyer, crédits, abonnements… Injectés automatiquement chaque mois.', color:'#dcc0a5', colorBg:'rgba(220,185,165,0.1)', conseil:'💡 Ex : Loyer 750€ · EDF 80€ · Crédit voiture 320€' },
  enveloppes: { emoji:'🎯', titre:'Enveloppes budget', sub:'Alimentation, carburant, loisirs… Budget mensuel remis à zéro chaque mois.', color:'#a7d2bf', colorBg:'rgba(167,210,191,0.1)', conseil:'💡 Ex : Alimentation 400€ · Carburant 150€ · Loisirs 100€
Le solde non dépensé peut être transféré vers une cagnotte en fin de mois.' },
  cagnottes:  { emoji:'🏦', titre:'Vos cagnottes', sub:'Vacances, voiture, sécurité… Une cagnotte cumule dans le temps et ne repart jamais à zéro.', color:'#a796e6', colorBg:'rgba(167,150,230,0.1)', conseil:'🏦 Vous pouvez aussi payer une dépense directement depuis une cagnotte lors de la saisie.' },
  solde:      { emoji:'🏦', titre:'Solde bancaire actuel', sub:'Pour calibrer votre budget disponible réel.' },
  fin:        { emoji:'🎉', titre:'Budget configuré !', sub:'Horizon Budget est prêt. Bonne gestion !' },
};

function showOnboarding() {
  const el=$('screen-onboarding'); if(el) el.style.display='flex';
  onbStep=0; renderOnb();
}
window.afficherOnboarding = showOnboarding;

function renderOnb() {
  const s  = ONB_STEPS[onbStep];
  const m  = ONB_META[s.type];
  const nb = ONB_STEPS.length;

  // Barre de progression
  document.querySelectorAll('.onboarding-dot').forEach((d,i)=>d.classList.toggle('done',i<onbStep));

  let html='';

  if(s.type==='intro') {
    html=`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 8px">
        <div style="font-size:4rem;margin-bottom:18px">${m.emoji}</div>
        <div class="onboarding-title" style="text-align:center;margin-bottom:10px">${m.titre}</div>
        <div class="onboarding-sub" style="text-align:center;margin-bottom:28px">${m.sub}</div>
        <!-- Aperçu des 3 concepts -->
        <div style="display:flex;flex-direction:column;gap:8px;width:100%;text-align:left">
          <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(220,185,165,0.08);border:1px solid rgba(220,185,165,0.2);border-radius:14px">
            <div style="font-size:1.2rem">📋</div>
            <div><div style="font-size:.72rem;font-weight:600;color:#dcc0a5">Charges fixes</div><div style="font-size:.58rem;color:var(--text3);margin-top:1px">Loyer, crédits, abonnements</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(167,210,191,0.08);border:1px solid rgba(167,210,191,0.2);border-radius:14px">
            <div style="font-size:1.2rem">🎯</div>
            <div><div style="font-size:.72rem;font-weight:600;color:#a7d2bf">Enveloppes budget</div><div style="font-size:.58rem;color:var(--text3);margin-top:1px">Budget mensuel remis à zéro</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(167,150,230,0.08);border:1px solid rgba(167,150,230,0.2);border-radius:14px">
            <div style="font-size:1.2rem">🏦</div>
            <div><div style="font-size:.72rem;font-weight:600;color:#a796e6">Cagnottes</div><div style="font-size:.58rem;color:var(--text3);margin-top:1px">Épargne cumulative — jamais remise à zéro</div></div>
          </div>
        </div>
        <div style="margin-top:20px" class="onboarding-conseil">🔒 Vos données restent sur votre téléphone. Aucun compte requis.</div>
      </div>`;

  } else if(s.type==='revenus'||s.type==='solde') {
    html=`
      <div class="onboarding-emoji">${m.emoji}</div>
      <div class="onboarding-title">${m.titre}</div>
      <div class="onboarding-sub">${m.sub}</div>
      <div class="onboarding-input-group">
        ${s.champs.map(c=>`<div class="onboarding-input-row">
          <span class="onboarding-input-icon">${c.i}</span>
          <span class="onboarding-input-label">${c.l}</span>
          <input type="number" id="onb-${c.k}" placeholder="0" min="0" step="1" inputmode="numeric">
          <span style="font-size:.7rem;color:var(--text3)">€</span>
        </div>`).join('')}
      </div>`;

  } else if(s.type==='charges') {
    html=`
      <div class="onboarding-emoji">${m.emoji}</div>
      <div class="onboarding-title">${m.titre}</div>
      <div class="onboarding-sub">${m.sub}</div>
      <div id="onb-cl" style="margin-bottom:10px"></div>
      <div onclick="onbAddC()" style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(220,185,165,0.08);border:1px dashed rgba(220,185,165,0.3);border-radius:14px;cursor:pointer;margin-bottom:14px">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(220,185,165,0.15);display:flex;align-items:center;justify-content:center;font-size:.9rem">➕</div>
        <div style="font-size:.72rem;font-weight:600;color:#dcc0a5">Ajouter une charge fixe</div>
      </div>
      <div class="onboarding-conseil">${m.conseil}</div>`;
    setTimeout(renderOnbC,10);

  } else if(s.type==='enveloppes') {
    html=`
      <div class="onboarding-emoji">${m.emoji}</div>
      <div class="onboarding-title">${m.titre}</div>
      <div class="onboarding-sub">${m.sub}</div>
      <div id="onb-el" style="margin-bottom:10px"></div>
      <div onclick="onbAddE()" style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(167,210,191,0.08);border:1px dashed rgba(167,210,191,0.3);border-radius:14px;cursor:pointer;margin-bottom:14px">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(167,210,191,0.15);display:flex;align-items:center;justify-content:center;font-size:.9rem">➕</div>
        <div style="font-size:.72rem;font-weight:600;color:#a7d2bf">Ajouter une enveloppe</div>
      </div>
      <div class="onboarding-conseil">${m.conseil}</div>`;
    setTimeout(renderOnbE,10);

  } else if(s.type==='cagnottes') {
    html=`
      <div class="onboarding-emoji">${m.emoji}</div>
      <div class="onboarding-title" style="color:#a796e6">${m.titre}</div>
      <div class="onboarding-sub">${m.sub}</div>
      <div id="onb-pl" style="margin-bottom:10px"></div>
      <div onclick="onbAddP()" style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(167,150,230,0.08);border:1px dashed rgba(167,150,230,0.3);border-radius:14px;cursor:pointer;margin-bottom:14px">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(167,150,230,0.15);display:flex;align-items:center;justify-content:center;font-size:.9rem">➕</div>
        <div style="font-size:.72rem;font-weight:600;color:#a796e6">Créer une cagnotte</div>
      </div>
      <div class="onboarding-conseil">${m.conseil}</div>`;
    setTimeout(renderOnbP,10);

  } else if(s.type==='fin') {
    html=`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
        <div style="font-size:4rem;margin-bottom:16px">${m.emoji}</div>
        <div class="onboarding-title" style="text-align:center">${m.titre}</div>
        <div class="onboarding-sub" style="text-align:center">${m.sub}</div>
        <div id="onb-resume" style="margin-top:24px;width:100%"></div>
      </div>`;
    setTimeout(renderOnbResume,10);
  }

  const c=$('onboarding-steps'); if(c) c.innerHTML=`<div class="onboarding-step active">${html}</div>`;
  const f=$('onboarding-footer');
  if(f){
    const isLast=onbStep===nb-1, isFirst=onbStep===0;
    f.innerHTML=`
      ${!isFirst?`<div class="btn btn-secondary" style="flex:1" onclick="onbPrev()">← Retour</div>`:'<div style="flex:1"></div>'}
      <div class="btn btn-primary" style="flex:2" onclick="onbNext()">${isLast?'🚀 Démarrer':'Continuer →'}</div>`;
  }
}

/* ── Rendu des listes ── */
function _onbItem(nom, valeur, couleur, icone, onDelete) {
  return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--noir-card);border-radius:12px;border:1px solid var(--noir-border2);margin-bottom:6px">
    <span style="font-size:1rem">${icone}</span>
    <span style="flex:1;font-size:.78rem;font-weight:500;color:var(--text)">${h(nom)}</span>
    <span style="font-size:.75rem;font-weight:600;color:${couleur}">${valeur}</span>
    <span onclick="${onDelete}" style="cursor:pointer;color:var(--text3);padding:2px 6px;font-size:.8rem">✕</span>
  </div>`;
}

function renderOnbC() {
  const el=$('onb-cl'); if(!el)return;
  el.innerHTML=!onbData.charges.length
    ?`<div style="font-size:.65rem;color:var(--text3);text-align:center;padding:6px">Aucune charge — optionnel</div>`
    :onbData.charges.map((c,i)=>_onbItem(c.nom,fmt(c.montant),'#dcc0a5','📋',`onbData.charges.splice(${i},1);renderOnbC()`)).join('');
}
function renderOnbE() {
  const el=$('onb-el'); if(!el)return;
  el.innerHTML=!onbData.enveloppes.length
    ?`<div style="font-size:.65rem;color:var(--text3);text-align:center;padding:6px">Aucune enveloppe — optionnel</div>`
    :onbData.enveloppes.map((e,i)=>_onbItem(e.nom,fmt(e.montant)+'/mois','#a7d2bf',e.icone,`onbData.enveloppes.splice(${i},1);renderOnbE()`)).join('');
}
function renderOnbP() {
  const el=$('onb-pl'); if(!el)return;
  el.innerHTML=!onbData.epargne.length
    ?`<div style="font-size:.65rem;color:var(--text3);text-align:center;padding:6px">Aucune cagnotte — optionnel</div>`
    :onbData.epargne.map((e,i)=>_onbItem(e.nom,e.provisionMensuelle>0?'+'+fmt(e.provisionMensuelle)+'/mois':'Libre','#a796e6',e.icone,`onbData.epargne.splice(${i},1);renderOnbP()`)).join('');
}

/* ── Ajout via prompt ── */
function onbAddC() {
  const n=prompt('Nom de la charge fixe (ex: Loyer, EDF…)'); if(!n)return;
  const m=parseFloat(prompt(`Montant mensuel de "${n}" (€)`)); if(!m||m<=0)return;
  onbData.charges.push({nom:n.trim(),montant:m,categorie:'Charges fixes',actif:true});
  renderOnbC();
}
function onbAddE() {
  const n=prompt("Nom de l'enveloppe (ex: Alimentation, Loisirs…)"); if(!n)return;
  const m=parseFloat(prompt(`Budget mensuel pour "${n}" (€)`)); if(!m||m<=0)return;
  const icons={alimentation:'🛒',courses:'🛒',carburant:'🚗',essence:'🚗',loisirs:'🎭',restaurant:'🍽️',santé:'💊',imprévus:'🛡️',enfants:'👶',animaux:'🐾',vêtements:'👗',shopping:'🛍️'};
  const ic=icons[n.toLowerCase()]||'🎯';
  onbData.enveloppes.push({nom:n.trim(),montant:m,icone:ic,actif:true,cagnotte:0});
  renderOnbE();
}
function onbAddP() {
  const n=prompt('Nom de la cagnotte (ex: Vacances, Voiture, Noël…)'); if(!n)return;
  const m=parseFloat(prompt(`Provision mensuelle pour "${n}" (€)
(0 si vous préférez alimenter manuellement)`));
  if(m===null) return; // annulé
  const icons={vacances:'🏖️',voiture:'🚗',noël:'🎄',noel:'🎄',sécurité:'🛡️',securite:'🛡️',urgences:'🚨',maison:'🏠',voyage:'✈️',projet:'🎯',études:'🎓',etudes:'🎓'};
  const ic=icons[n.toLowerCase()]||'🏦';
  onbData.epargne.push({nom:n.trim(),provisionMensuelle:m>0?m:0,icone:ic,actif:true,solde:0});
  renderOnbP();
}

window.onbAddC=onbAddC; window.onbAddE=onbAddE; window.onbAddP=onbAddP;
window.renderOnbC=renderOnbC; window.renderOnbE=renderOnbE; window.renderOnbP=renderOnbP;

/* ── Résumé final ── */
async function renderOnbResume() {
  const el=$('onb-resume'); if(!el)return;
  let totalRev=0;
  for(const c of ONB_STEPS[1].champs){ totalRev+=(parseFloat(await D().getOnboarding(c.k,0))||0); }
  const tC = onbData.charges.reduce((s,c)=>s+(parseFloat(c.montant)||0),0);
  const tE = onbData.enveloppes.reduce((s,e)=>s+(parseFloat(e.montant)||0),0);
  const tP = onbData.epargne.reduce((s,e)=>s+(parseFloat(e.provisionMensuelle)||0),0);
  const dispo = Math.max(0, totalRev - tC - tE - tP);
  const alerte = (tC+tE+tP) > totalRev;

  el.innerHTML=`
    <div style="background:var(--noir-card);border-radius:var(--radius-lg);border:1px solid var(--noir-border2);overflow:hidden;text-align:left;margin-bottom:${alerte?'12px':'0'}">
      <div style="padding:12px 16px;border-bottom:1px solid var(--noir-border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.72rem;color:var(--text2)">💰 Revenus mensuels</span>
        <span style="font-size:.75rem;font-weight:700;color:var(--green-ok)">${fmt(totalRev)}</span>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--noir-border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.72rem;color:var(--text2)">📋 Charges fixes (${onbData.charges.length})</span>
        <span style="font-size:.72rem;font-weight:600;color:#dcc0a5">-${fmt(tC)}</span>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--noir-border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.72rem;color:var(--text2)">🎯 Enveloppes (${onbData.enveloppes.length})</span>
        <span style="font-size:.72rem;font-weight:600;color:#a7d2bf">-${fmt(tE)}</span>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--noir-border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.72rem;color:var(--text2)">🏦 Cagnottes (${onbData.epargne.length})</span>
        <span style="font-size:.72rem;font-weight:600;color:#a796e6">-${fmt(tP)}</span>
      </div>
      <div style="padding:14px 16px;background:${alerte?'rgba(220,185,165,0.08)':'var(--green-ultra)'};display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.78rem;font-weight:700;color:${alerte?'#dcc0a5':'var(--green-glow)'}">${alerte?'⚠️ Dépassement':'✅ Reste disponible'}</span>
        <span style="font-size:1rem;font-weight:800;color:${alerte?'#dcc0a5':'var(--green-glow)'}">${alerte?'-'+fmt(Math.abs(dispo)):fmt(dispo)}</span>
      </div>
    </div>
    ${alerte?`<div style="padding:10px 14px;background:rgba(220,185,165,0.08);border:1px solid rgba(220,185,165,0.2);border-radius:12px;font-size:.65rem;color:#dcc0a5;line-height:1.5">
      ⚠️ Votre budget dépasse vos revenus de ${fmt(Math.abs(dispo))}. Vous pourrez ajuster vos enveloppes depuis l'application.
    </div>`:''}`;
}

/* ── Navigation ── */
async function onbNext() {
  const s=ONB_STEPS[onbStep];
  if(s.type==='revenus') {
    let tot=0;
    for(const c of s.champs){ const v=parseFloat($(`onb-${c.k}`)?.value)||0; await D().setOnboarding(c.k,v); tot+=v; }
    if(tot===0){ Toast.warning('Indiquez au moins un revenu'); return; }
    await D().setOnboarding('totalRevenus',tot); await D().setSetting('revenus',tot);
  }
  if(s.type==='solde') {
    const sr=parseFloat($('onb-soldeReel')?.value)||0;
    const dc=Math.abs(parseFloat($('onb-decouvert')?.value)||0);
    await D().setSetting('soldeInitial',sr); await D().setSetting('soldeInitialDate',new Date().toISOString().split('T')[0]);
    if(dc>0){ await D().setSetting('decouvert',dc); await D().setSetting('decouvertInitial',dc); }
  }
  if(s.type==='fin'){ await saveOnboarding(); return; }
  onbStep=Math.min(onbStep+1,ONB_STEPS.length-1); renderOnb();
}
function onbPrev(){ onbStep=Math.max(0,onbStep-1); renderOnb(); }
window.onbNext=onbNext; window.onbPrev=onbPrev;

async function saveOnboarding() {
  for(const c of onbData.charges)    await D().addChargeFixes(c);
  for(const e of onbData.enveloppes) await D().addBudgetVirtuel(e);
  // Cagnottes → nouveau store
  for(const cag of onbData.epargne)  await D().addCagnotte(cag);
  await D().markOnboardingDone();
  const el=$('screen-onboarding');
  if(el){ el.style.opacity='0'; el.style.transition='opacity .4s'; setTimeout(()=>{ el.style.display='none'; el.style.opacity=''; },400); }
  Toast.success('Budget configuré ✓');
  await D().injecterChargesDuMois(MOIS);
  await D().provisionnerBudgetsDuMois(MOIS);
  startApp();
}

/* ==========================================
   ACCUEIL
   ========================================== */
// Fonction nommée pour pouvoir l'appeler directement en fallback
async function chargerAccueil() {
  const updateTime=()=>{ const n=new Date(); txt('accueil-time',n.getHours()+':'+(n.getMinutes()<10?'0':'')+n.getMinutes()); };
  updateTime();

  const foyer=await D().getSetting('nomFoyer','Mon Foyer');
  txt('accueil-foyer',foyer);
  txt('releve-mois',D().formatMoisLabel(MOIS));
  txt('stats-mois',D().formatMoisLabel(MOIS));

  const txMois=await D().getTransactionsByMois(MOIS);
  const sv=await D().calculerSoldeVirtuel(MOIS);
  const rec=txMois.filter(t=>t.typeOp==='credit').reduce((s,t)=>s+(parseFloat(t.montant)||0),0);
  const dep=txMois.filter(t=>t.typeOp==='debit'&&t.type!=='virtuel').reduce((s,t)=>s+(parseFloat(t.montant)||0),0);
  const revenus=parseFloat(await D().getSetting('revenus',0))||rec||1;

  txt('accueil-solde-virtuel',fmt(sv));

  const pctMois=Math.min(100,Math.round((dep/revenus)*100));
  const bar=$('accueil-prog-mois');
  if(bar) setTimeout(()=>bar.style.width=pctMois+'%',200);

  const joursDansMois=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate();
  const joursRestants=Math.max(1,joursDansMois-new Date().getDate()+1);
  const parJour=sv>0?sv/joursRestants:0;
  txt('accueil-par-jour',parJour>0?fmt(parJour).replace(',00 €','€'):'0 €');

  const charges=await D().getChargesFixes();
  const budgets=await D().getBudgetsVirtuelsActifs();
  const moisSec=charges.length>0&&budgets.length>0&&sv>0;
  const msEl=$('accueil-mois-securise');
  if(msEl){
    msEl.textContent=moisSec?'✅':'⚠️';
    msEl.style.borderColor=moisSec?'var(--green-ok)':'var(--orange)';
    msEl.style.background=moisSec?'var(--green-ok-bg)':'var(--orange-bg)';
  }

  const sd=await D().calculerScore(MOIS);
  const sl=D().getScoreLabel(sd.score);
  renderScoreRing(sd.score,sl);

  await D().calculerBadges(MOIS);

  const anomalies=txMois.filter(t=>t.statut==='anomalie').length;
  const alertDiv=$('accueil-alertes');
  if(alertDiv){
    alertDiv.style.display=anomalies>0?'flex':'none';
    txt('accueil-alertes-sub',`${anomalies} transaction(s) en anomalie · Voir le relevé`);
  }

  renderConseil();
  renderAccueilEnveloppes(budgets);
  switchOnglet('charges');
}
window.chargerAccueil = chargerAccueil;

Router.onEnter('accueil', chargerAccueil);

function renderAccueilEnveloppes(budgets) {
  const el=$('accueil-enveloppes'); if(!el)return;
  if(!budgets||!budgets.length){
    el.innerHTML=`<div style="padding:16px;background:var(--noir-card);border-radius:18px;border:1px solid var(--noir-border);text-align:center">
      <div style="font-size:.7rem;color:var(--text3)">Aucune enveloppe · <span onclick="Router.go('budgetsVirtuels')" style="color:var(--green-glow);cursor:pointer">Créer →</span></div>
    </div>`; return;
  }
  // Couleurs pastels pour les enveloppes
  const COLORS_ENV = [
    { bg:'rgba(167,210,191,0.12)', border:'rgba(167,210,191,0.25)', text:'#a7d2bf' },
    { bg:'rgba(167,195,230,0.12)', border:'rgba(167,195,230,0.25)', text:'#a7c3e6' },
    { bg:'rgba(220,185,165,0.12)', border:'rgba(220,185,165,0.25)', text:'#dcc0a5' },
    { bg:'rgba(195,185,230,0.12)', border:'rgba(195,185,230,0.25)', text:'#c3b9e6' },
  ];
  el.innerHTML=`<div class="card">${budgets.slice(0,4).map((b,i)=>{
    const cag=parseFloat(b.cagnotte)||0, mt=parseFloat(b.montant)||1;
    const pct=Math.min(100,Math.round((cag/mt)*100));
    const col=COLORS_ENV[i%COLORS_ENV.length];
    const barCol=pct>=100?'var(--green-ok)':pct>=60?col.text:pct>=30?'var(--orange)':'var(--red)';
    return `<div class="card-row" onclick="voirCagnotte(${b.id})" style="padding:12px 16px">
      <div class="row-icon" style="background:${col.bg};border:1px solid ${col.border};width:34px;height:34px;border-radius:10px">${b.icone||'⬜'}</div>
      <div class="row-info">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <div class="row-label" style="font-size:.75rem">${h(b.nom)}</div>
          <div style="font-size:.68rem;font-weight:600;color:${col.text}">${fmt(cag)} / ${fmt(mt)}</div>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${barCol}"></div></div>
        <div style="font-size:.55rem;color:var(--text3);margin-top:3px;text-align:right">${pct}%</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function afficherAlertes() { Router.go('releve'); }
window.afficherAlertes=afficherAlertes;

function renderScoreRing(score,label) {
  const el=$('score-ring-svg'); if(!el)return;
  const r=30,circ=2*Math.PI*r,off=circ-(score/100)*circ;
  el.innerHTML=`<svg width="80" height="80" viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="var(--noir-border2)" stroke-width="5"/>
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="${label.color}" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
      style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1s var(--ease-spring)"/>
  </svg>
  <div class="score-ring-text"><div class="score-value">${score}</div><div class="score-label">Score</div></div>`;
}

async function renderConseil() {
  const conseils=await D().genererConseils(MOIS);
  const el=$('accueil-conseils');
  if(!el||!conseils.length){ if(el)el.innerHTML=''; return; }
  const c=conseils[0];
  el.innerHTML=`<div class="conseil-card animate-in"><div class="conseil-icon">${c.icon}</div><div><div class="conseil-title">${h(c.titre)}</div><div class="conseil-text">${h(c.texte)}</div></div></div>`;
}

async function switchOnglet(tab) {
  ['charges','cagnottes'].forEach(t=>{ const el=$(`tab-${t}`); if(el)el.classList.toggle('active',t===tab); });
  const c=$('accueil-onglet-content'); if(!c)return;
  if(tab==='charges') await renderTabCharges(c);
  else await renderTabCagnottes(c);
}
window.switchOngletAccueil = switchOnglet;

async function renderTabCharges(c) {
  const charges=await D().getChargesFixes();
  const budgets=await D().getBudgetsVirtuelsActifs();
  let html='';
  if(charges.length) {
    html+=`<div class="section-title">Charges fixes</div><div style="padding:0 16px;margin-bottom:12px"><div class="card">`;
    charges.slice(0,5).forEach(cf=>{
      html+=`<div class="card-row" onclick="Router.go('chargesFixes')">
        <div class="row-icon" style="background:rgba(220,185,165,0.12);border:1px solid rgba(220,185,165,0.25)">📋</div>
        <div class="row-info"><div class="row-label">${h(cf.nom)}</div><div class="row-sub">${h(cf.categorie||'Charge fixe')}</div></div>
        <div class="row-value" style="color:#dcc0a5">${fmt(cf.montant)}</div>
      </div>`;
    });
    if(charges.length>5) html+=`<div class="card-row" onclick="Router.go('chargesFixes')" style="justify-content:center"><span style="font-size:.68rem;color:var(--text3)">+${charges.length-5} autres…</span></div>`;
    html+=`</div></div>`;
  }
  if(budgets.length) {
    html+=`<div class="section-title">Enveloppes</div><div style="padding:0 16px;margin-bottom:12px"><div class="card">`;
    const COLORS_ENV = [
      { bg:'rgba(167,210,191,0.12)', text:'#a7d2bf', bar:'#a7d2bf' },
      { bg:'rgba(167,195,230,0.12)', text:'#a7c3e6', bar:'#a7c3e6' },
      { bg:'rgba(220,185,165,0.12)', text:'#dcc0a5', bar:'#dcc0a5' },
      { bg:'rgba(195,185,230,0.12)', text:'#c3b9e6', bar:'#c3b9e6' },
    ];
    budgets.forEach((b,i)=>{
      const col=COLORS_ENV[i%COLORS_ENV.length];
      const cag=parseFloat(b.cagnotte)||0, mt=parseFloat(b.montant)||1;
      const pct=Math.min(100,((cag/mt)*100));
      html+=`<div class="card-row" onclick="voirCagnotte(${b.id})">
        <div class="row-icon" style="background:${col.bg}">${b.icone||'⬜'}</div>
        <div class="row-info"><div class="row-label">${h(b.nom)}</div>
          <div class="progress-bar" style="margin-top:5px"><div class="progress-fill" style="width:${pct}%;background:${col.bar}"></div></div>
        </div>
        <div class="row-value" style="color:${col.text}">${fmt(b.montant)}/mois</div>
      </div>`;
    });
    html+=`</div></div>`;
  }
  if(!charges.length&&!budgets.length) {
    html=`<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Aucune charge</div>
    <div class="empty-sub">Configurez vos charges dans Réglages</div>
    <div class="btn btn-primary" style="margin-top:16px;width:auto;padding:12px 24px" onclick="Router.go('parametres')">Configurer →</div></div>`;
  }
  c.innerHTML=html;
}

async function renderTabCagnottes(c) {
  const cagnottes=await D().getCagnottes();
  // Filtrer actives
  const actives = cagnottes.filter(c => c.actif !== false);
  const C_BG   = ['rgba(167,150,230,0.12)','rgba(140,120,220,0.12)','rgba(190,170,240,0.12)','rgba(120,100,200,0.12)'];
  const C_TEXT = ['#a796e6','#8c78dc','#baaaf0','#7864c8'];

  let html='';

  if(!actives.length){
    html=`<div style="padding:0 16px">
      <div style="background:rgba(167,150,230,0.06);border:1px solid rgba(167,150,230,0.2);border-radius:20px;padding:22px 18px;text-align:center;margin-bottom:12px">
        <div style="font-size:2rem;margin-bottom:10px">🏦</div>
        <div style="font-family:var(--font-head);font-size:.9rem;font-weight:700;color:#a796e6;margin-bottom:6px">Aucune cagnotte</div>
        <div style="font-size:.65rem;color:var(--text3);line-height:1.5;margin-bottom:16px">
          Une cagnotte cumule dans le temps et ne repart jamais à zéro.<br>
          Utilisez-la pour épargner ou payer une dépense importante.
        </div>
        <div class="btn btn-primary" style="width:auto;padding:12px 20px;display:inline-flex;background:rgba(167,150,230,0.15);border:1px solid rgba(167,150,230,0.3);color:#a796e6" onclick="Router.go('cagnottesList')">
          🏦 Créer ma première cagnotte
        </div>
      </div>
      <div style="font-size:.58rem;color:var(--text3);text-align:center;line-height:1.5;padding:0 8px">
        💡 Exemples : Vacances, Voiture, Sécurité, Noël, Travaux…
      </div>
    </div>`;
  } else {
    html+=`<div style="padding:0 16px;margin-bottom:12px"><div class="card">`;
    actives.forEach((cag,i)=>{
      const solde=parseFloat(cag.solde)||0, obj=parseFloat(cag.objectif)||0;
      const pct=obj>0?Math.min(100,(solde/obj)*100):0;
      const bg=C_BG[i%C_BG.length], tx=C_TEXT[i%C_TEXT.length];
      html+=`<div class="card-row" onclick="Router.go('cagnotteDetail',{params:{id:${cag.id}}})">
        <div class="row-icon" style="background:${bg};border:1px solid rgba(167,150,230,0.2)">${cag.icone||'🏦'}</div>
        <div class="row-info">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <div class="row-label">${h(cag.nom)}</div>
            <div style="font-size:.65rem;font-weight:700;color:${tx}">${fmt(solde)}</div>
          </div>
          <div class="row-sub" style="color:${tx};opacity:.7;margin-bottom:${obj>0?'4px':'0'}">${cag.provisionMensuelle>0?'+'+fmt(cag.provisionMensuelle)+'/mois':'Cagnotte libre'}${obj>0?' · Objectif : '+fmt(obj):''}</div>
          ${obj>0?`<div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${tx}"></div></div><div style="font-size:.5rem;color:${tx};opacity:.6;text-align:right;margin-top:2px">${Math.round(pct)}%</div>`:''}
        </div>
      </div>`;
    });
    html+=`</div></div>`;
    html+=`<div style="padding:0 16px;margin-bottom:12px">
      <div onclick="Router.go('cagnottesList')" style="display:flex;align-items:center;gap:12px;padding:13px 16px;background:rgba(167,150,230,0.06);border:1px solid rgba(167,150,230,0.15);border-radius:14px;cursor:pointer">
        <div style="width:32px;height:32px;border-radius:10px;background:rgba(167,150,230,0.12);border:1px solid rgba(167,150,230,0.2);display:flex;align-items:center;justify-content:center;font-size:1rem">➕</div>
        <div style="font-size:.72rem;font-weight:600;color:#a796e6">Gérer mes cagnottes</div>
        <div style="margin-left:auto;font-size:.7rem;color:var(--text3)">›</div>
      </div>
    </div>`;
  }
  c.innerHTML=html;
}

function ouvrirCreerCagnotte() { Router.go('cagnottesList'); }
window.ouvrirCreerCagnotte=ouvrirCreerCagnotte;

/* ==========================================
   RELEVÉ
   ========================================== */
let filtreCompte='Tous';
let filtreStatut='tous';
let MOIS_RELEVE=''; // mois affiché dans le relevé (peut être un mois passé)

Router.onEnter('releve', function(){
  MOIS_RELEVE = MOIS; // reset au mois courant à chaque entrée
  renderReleve();
});

async function renderReleve() {
  if(!MOIS_RELEVE) MOIS_RELEVE=MOIS;
  const txMois=await D().getTransactionsByMois(MOIS_RELEVE);
  const comptes=await D().getComptes();

  // Mettre à jour le label du mois + désactiver flèche suivante si mois courant
  txt('releve-mois', D().formatMoisLabel(MOIS_RELEVE));
  const nextBtn=$('releve-nav-next');
  if(nextBtn) nextBtn.style.opacity=MOIS_RELEVE>=MOIS?'0.3':'1';

  // Chips comptes
  const chips=$('releve-comptes-chips');
  if(chips) chips.innerHTML=['Tous',...comptes.map(c=>c.nom)].map(c=>`<div class="chip ${c===filtreCompte?'active':''}" onclick="filtreCompteReleve('${a(c)}')">${h(c)}</div>`).join('');

  // Filtre
  let txF=filtreCompte==='Tous'?txMois:txMois.filter(t=>t.compte===filtreCompte);
  if(filtreStatut!=='tous') txF=txF.filter(t=>t.statut===filtreStatut);

  // Alertes anomalies
  const ano=txMois.filter(t=>t.statut==='anomalie').length;
  const alertEl=$('releve-alerte');
  if(alertEl){ alertEl.style.display=ano>0?'flex':'none'; txt('releve-alerte-count',`${ano} anomalie(s)`); }

  txF.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  txt('releve-count',`${txF.length} opération${txF.length>1?'s':''}`);

  // Résumé rapprochement
  const rapprEl=$('releve-rapprochement');
  if(rapprEl){
    const ok=txMois.filter(t=>t.statut==='ok').length;
    const att=txMois.filter(t=>t.statut==='attente').length;
    const anoCnt=txMois.filter(t=>t.statut==='anomalie').length;
    rapprEl.innerHTML=`<div style="display:flex;gap:8px;padding:0 16px 12px;overflow-x:auto">
      <div onclick="filtreStatutReleve('tous')" class="chip ${filtreStatut==='tous'?'active':''}" style="flex-shrink:0">Toutes (${txMois.length})</div>
      <div onclick="filtreStatutReleve('ok')" class="chip ${filtreStatut==='ok'?'active':''}" style="flex-shrink:0;color:${filtreStatut==='ok'?'':' #a7d2bf'}">🟢 Pointées (${ok})</div>
      <div onclick="filtreStatutReleve('attente')" class="chip ${filtreStatut==='attente'?'active':''}" style="flex-shrink:0">🟡 En attente (${att})</div>
      <div onclick="filtreStatutReleve('anomalie')" class="chip ${filtreStatut==='anomalie'?'active':''}" style="flex-shrink:0">🔴 Anomalies (${anoCnt})</div>
    </div>`;
  }

  const listEl=$('releve-list'); if(!listEl)return;
  if(!txF.length){ listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Aucune opération</div><div class="empty-sub">Appuyez sur + pour ajouter</div></div>`; return; }

  const groupes={};
  txF.forEach(t=>{ const d=t.date||MOIS+'-01'; if(!groupes[d])groupes[d]=[]; groupes[d].push(t); });
  let html='';
  Object.entries(groupes).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([date,txs])=>{
    html+=`<div class="date-separator">${fmtD(date)}</div><div class="card" style="margin-bottom:8px">`;
    txs.forEach(t=>{
      const isC=t.typeOp==='credit';
      // Couleurs selon type
      let col;
      if(isC)             col='#a7d2bf';      // recette — vert pastel
      else if(t.type==='fixe') col='#dcc0a5'; // charge fixe — saumon pastel
      else                col='#a7c3e6';      // variable — bleu pastel
      const ico={ok:'🟢',attente:'🟡',anomalie:'🔴'}[t.statut]||'🟡';
      html+=`<div class="card-row" onclick="ouvrirTx(${t.id})">
        <div class="tx-stripe" style="background:${col}"></div>
        <div class="row-info"><div class="row-label">${h(t.libelle||t.categorie||'Transaction')}</div>
          <div class="row-sub">${h(t.categorie||'')}${t.compte?' · '+h(t.compte):''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.82rem;font-weight:700;color:${col}">${isC?'+':'-'}${fmt(t.montant)}</div>
          <div onclick="event.stopPropagation();cycleStatut(${t.id})" style="font-size:.9rem;cursor:pointer;margin-top:2px" title="Changer le statut">${ico}</div>
        </div>
      </div>`;
    });
    html+=`</div>`;
  });
  listEl.innerHTML=html;
}

async function filtreCompteReleve(c){ filtreCompte=c; await renderReleve(); }
async function filtreStatutReleve(s){ filtreStatut=s; await renderReleve(); }
window.filtreCompteReleve=filtreCompteReleve;
window.filtreStatutReleve=filtreStatutReleve;

// Navigation mois dans le relevé
function moisPrecedent() {
  const [y,m]=MOIS_RELEVE.split('-').map(Number);
  const d=new Date(y,m-2,1); // mois -1
  MOIS_RELEVE=d.toISOString().substring(0,7);
  filtreStatut='tous'; filtreCompte='Tous';
  renderReleve();
}
function moisSuivant() {
  if(MOIS_RELEVE>=MOIS) return; // pas au delà du mois courant
  const [y,m]=MOIS_RELEVE.split('-').map(Number);
  const d=new Date(y,m,1); // mois +1
  MOIS_RELEVE=d.toISOString().substring(0,7);
  filtreStatut='tous'; filtreCompte='Tous';
  renderReleve();
}
window.moisPrecedent=moisPrecedent;
window.moisSuivant=moisSuivant;

async function cycleStatut(id) {
  const all=await D().getAllTransactions();
  const tx=all.find(t=>t.id===id); if(!tx)return;
  const cyc={attente:'ok',ok:'anomalie',anomalie:'attente'};
  tx.statut=cyc[tx.statut]||'attente';
  await D().updateTransaction(tx); await renderReleve();
}
window.cycleStatut=cycleStatut;

async function ouvrirTx(id) {
  const all=await D().getAllTransactions();
  const tx=all.find(t=>t.id===id); if(!tx)return;
  const isC=tx.typeOp==='credit';
  let col;
  if(isC) col='#a7d2bf';
  else if(tx.type==='fixe') col='#dcc0a5';
  else col='#a7c3e6';
  const sLbl={ok:'🟢 Pointé',attente:'🟡 En attente',anomalie:'🔴 Anomalie'};
  txt('detail-libelle',tx.libelle||'Transaction');
  const mtEl=$('detail-montant');
  if(mtEl){ mtEl.textContent=(isC?'+':'-')+fmt(tx.montant); mtEl.style.color=col; }
  txt('detail-date',fmtD(tx.date));
  txt('detail-categorie',tx.categorie||'—');
  txt('detail-souscat',tx.souscat||'—');
  txt('detail-compte',tx.compte||'Compte Courant');
  txt('detail-statut',sLbl[tx.statut]||'🟡 En attente');
  const db=$('detail-delete-btn'); if(db) db.onclick=()=>suppTx(tx.id);
  Modal.open('detail');
}
window.ouvrirTx=ouvrirTx;

async function suppTx(id) {
  if(!confirm('Supprimer définitivement cette transaction ?'))return;
  await D().deleteTransaction(id); Modal.close('detail');
  Toast.success('Transaction supprimée'); await renderReleve();
}

/* ==========================================
   SAISIE — CORRIGÉE
   Choix : compte courant / enveloppe / cagnotte / imprévus
   ========================================== */
Router.onEnter('saisie', async function() {
  saisieType='debit'; saisieCat=''; saisieCompte='Compte Courant'; saisieBudget=null;
  const amEl=$('saisie-amount'), curEl=$('saisie-cursor');
  window.numpadSaisie=new Numpad(amEl,curEl,{maxDigits:7});
  window.numpadSaisie.reset();
  txt('saisie-date-val',fmtD(new Date().toISOString().split('T')[0]));
  setSaisieTypeUI('debit');
  const libEl=$('saisie-libelle-val');
  if(libEl){libEl.textContent='Saisir un libellé…';libEl.classList.add('empty');}
  const catEl=$('saisie-cat-val');
  if(catEl){catEl.textContent='Choisir…';catEl.classList.add('empty');}
  txt('saisie-compte-val','Compte Courant');
  txt('saisie-budget-val','Compte courant');
  updateBudgetRow();

  // Pré-remplir avec les charges variables existantes
  await renderChargesVariablesRapides();
});

async function renderChargesVariablesRapides() {
  const el=$('saisie-cv-rapides'); if(!el)return;
  const cvs=await D().getChargesVariables();
  if(!cvs.length){ el.style.display='none'; return; }
  el.style.display='flex';
  el.innerHTML=cvs.slice(0,6).map(cv=>`<div class="chip" onclick="pickChargeVariable(${cv.id})" style="font-size:.65rem">${cv.icone||'📦'} ${h(cv.nom)}</div>`).join('');
}

async function pickChargeVariable(id) {
  const cvs=await D().getChargesVariables();
  const cv=cvs.find(c=>c.id===id); if(!cv)return;
  saisieCat=cv.categorie||cv.nom;
  const catEl=$('saisie-cat-val');
  if(catEl){catEl.textContent=`${cv.icone||'📦'} ${cv.nom}`;catEl.classList.remove('empty');}
  if(cv.budgetVirtuelId){
    saisieBudget={type:'enveloppe',id:cv.budgetVirtuelId};
    const bs=await D().getBudgetsVirtuels();
    const bv=bs.find(b=>b.id===cv.budgetVirtuelId);
    if(bv) txt('saisie-budget-val',`${bv.icone||''} ${bv.nom}`);
    updateBudgetRow();
  }
}
window.pickChargeVariable=pickChargeVariable;

function updateBudgetRow() {
  const row=$('saisie-budget-row'); if(!row)return;
  row.style.display=saisieType==='debit'?'flex':'none';
}

function setSaisieTypeUI(type) {
  saisieType=type;
  const db=$('toggle-debit'),cb=$('toggle-credit'),am=$('saisie-amount'),cur=$('saisie-cursor');
  if(db){db.classList.toggle('active-debit',type==='debit');db.classList.toggle('active-credit',false);}
  if(cb){cb.classList.toggle('active-credit',type==='credit');cb.classList.toggle('active-debit',false);}
  // Recettes = vert pastel, Dépenses = bleu pastel
  const col=type==='credit'?'#a7d2bf':'#a7c3e6';
  if(am)am.style.color=col; if(cur)cur.style.background=col;
  updateBudgetRow();
}
window.updateSaisieType=setSaisieTypeUI;

function doPromptLibelle() {
  const el=$('saisie-libelle-val');
  const cur=el?.classList.contains('empty')?'':el?.textContent||'';
  const v=prompt('Libellé :',cur); if(v===null)return;
  if(el){el.textContent=v.trim()||'Saisir un libellé…';el.classList.toggle('empty',!v.trim());}
}
window.promptLibelle=doPromptLibelle;

async function openCatPicker() {
  const el=$('cat-list'); if(!el)return;
  // Charges variables en tête
  const cvs=await D().getChargesVariables();
  let html='';
  if(cvs.length){
    html+=`<div style="padding:0 16px 6px;font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text3)">Mes charges variables</div>`;
    html+=cvs.map(cv=>`<div class="card-row" onclick="pickCat('${a(cv.categorie||cv.nom)}','${cv.icone||'📦'}')">
      <div class="row-icon" style="background:rgba(167,195,230,0.12)">${cv.icone||'📦'}</div>
      <div class="row-label">${h(cv.nom)}</div></div>`).join('');
    html+=`<div style="height:1px;background:var(--noir-border);margin:8px 0"></div>`;
    html+=`<div style="padding:0 16px 6px;font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text3)">Catégories générales</div>`;
  }
  html+=CATS.map(c=>`<div class="card-row" onclick="pickCat('${a(c.nom)}','${c.e}')">
    <div class="row-icon" style="background:var(--green-ultra)">${c.e}</div>
    <div class="row-label">${h(c.nom)}</div><div class="row-arrow">›</div>
  </div>`).join('');
  el.innerHTML=html;
  Modal.open('catPicker');
}
window.openCatPicker=openCatPicker;

function pickCat(nom,emoji) {
  saisieCat=nom;
  const el=$('saisie-cat-val');
  if(el){el.textContent=`${emoji} ${nom}`;el.classList.remove('empty');}
  Modal.close('catPicker');
}
window.pickCat=pickCat; window.selectCat=pickCat;

async function openComptePicker() {
  const comptes=await D().getComptes();
  const el=$('compte-list'); if(!el)return;
  const opts=comptes.length?comptes:[{nom:'Compte Courant'}];
  el.innerHTML=opts.map(c=>`<div class="card-row" onclick="pickCompte('${a(c.nom)}')">
    <div class="row-icon" style="background:var(--green-ultra)">🏦</div>
    <div class="row-label">${h(c.nom)}</div>
    ${saisieCompte===c.nom?'<div style="color:var(--green-glow)">✓</div>':''}
  </div>`).join('');
  Modal.open('comptePicker');
}
window.openComptePicker=openComptePicker;

function pickCompte(nom){ saisieCompte=nom; txt('saisie-compte-val',nom); Modal.close('comptePicker'); }
window.pickCompte=pickCompte; window.selectCompte=pickCompte;

// ======= NOUVEAU : Picker budget de paiement =======
async function openBudgetPicker() {
  const bs=await D().getBudgetsVirtuelsActifs();
  const el=$('budget-picker-list'); if(!el)return;

  // Option 1 : Compte courant (par défaut)
  let html=`<div class="card-row" onclick="pickBudget('compte',null)">
    <div class="row-icon" style="background:rgba(220,185,165,0.12)">🏦</div>
    <div class="row-info"><div class="row-label">Compte courant</div><div class="row-sub">Paiement direct sur le compte</div></div>
    ${!saisieBudget?'<div style="color:var(--green-glow)">✓</div>':''}
  </div>`;

  // Option 2 : Enveloppes budget
  if(bs.length){
    html+=`<div style="padding:8px 16px 4px;font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text3)">Enveloppes budget</div>`;
    bs.forEach((b,i)=>{
      const COLORS=['rgba(167,210,191,0.12)','rgba(167,195,230,0.12)','rgba(220,185,165,0.12)','rgba(195,185,230,0.12)'];
      const TEXTS=['#a7d2bf','#a7c3e6','#dcc0a5','#c3b9e6'];
      const col=COLORS[i%COLORS.length];
      const txt2=TEXTS[i%TEXTS.length];
      const sel=saisieBudget?.type==='enveloppe'&&saisieBudget?.id===b.id;
      html+=`<div class="card-row" onclick="pickBudget('enveloppe',${b.id})">
        <div class="row-icon" style="background:${col}">${b.icone||'⬜'}</div>
        <div class="row-info">
          <div class="row-label">${h(b.nom)}</div>
          <div class="row-sub" style="color:${txt2}">Solde : ${fmt(b.cagnotte||0)}</div>
        </div>
        ${sel?'<div style="color:var(--green-glow)">✓</div>':''}
      </div>`;
    });
  }

  // Option 3 : Cagnottes (nouveau store)
  const cagnottes=await D().getCagnottes();
  const cagActives=cagnottes.filter(c=>c.actif!==false&&(parseFloat(c.solde)||0)>0);
  if(cagActives.length){
    html+=`<div style="padding:8px 16px 4px;font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#a796e6">Cagnottes</div>`;
    cagActives.forEach((cag,i)=>{
      const C_BG=['rgba(167,150,230,0.12)','rgba(140,120,220,0.12)','rgba(190,170,240,0.12)'];
      const C_TX=['#a796e6','#8c78dc','#baaaf0'];
      const sel=saisieBudget?.type==='cagnotte'&&saisieBudget?.id===cag.id;
      html+=`<div class="card-row" onclick="pickBudget('cagnotte',${cag.id})">
        <div class="row-icon" style="background:${C_BG[i%3]};border:1px solid rgba(167,150,230,0.2)">${cag.icone||'🏦'}</div>
        <div class="row-info">
          <div class="row-label">${h(cag.nom)}</div>
          <div class="row-sub" style="color:${C_TX[i%3]}">Solde : ${fmt(cag.solde||0)}</div>
        </div>
        ${sel?'<div style="color:#a796e6">✓</div>':''}
      </div>`;
    });
  }

  // Option 3 : Imprévus
  html+=`<div style="padding:8px 16px 4px;font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text3)">Autre</div>`;
  html+=`<div class="card-row" onclick="pickBudget('imprevus',null)">
    <div class="row-icon" style="background:rgba(195,185,230,0.12)">🛡️</div>
    <div class="row-info"><div class="row-label">Budget imprévus</div><div class="row-sub">Dépense hors enveloppes</div></div>
    ${saisieBudget?.type==='imprevus'?'<div style="color:var(--green-glow)">✓</div>':''}
  </div>`;

  el.innerHTML=html;
  Modal.open('budgetPicker');
}
window.openBudgetPicker=openBudgetPicker;

async function pickBudget(type, id) {
  if(type==='compte'){ saisieBudget=null; txt('saisie-budget-val','Compte courant'); }
  else if(type==='enveloppe'){
    saisieBudget={type:'enveloppe',id};
    const bs=await D().getBudgetsVirtuels(); const b=bs.find(x=>x.id===id);
    if(b) txt('saisie-budget-val',`${b.icone||''} ${b.nom}`);
  }
  else if(type==='cagnotte'){
    saisieBudget={type:'cagnotte',id};
    const cag=await D().getCagnotteById(id);
    if(cag) txt('saisie-budget-val',`${cag.icone||'🏦'} ${cag.nom}`);
  }
  else if(type==='imprevus'){ saisieBudget={type:'imprevus',id:null}; txt('saisie-budget-val','🛡️ Budget imprévus'); }
  Modal.close('budgetPicker');
}
window.pickBudget=pickBudget;

// Compatibilité ancienne API
async function openBVPicker() { await openBudgetPicker(); }
window.openBudgetVirtuelPicker=openBVPicker;
async function pickBV(id) { await pickBudget(id?'enveloppe':'compte', id); }
window.pickBV=pickBV; window.selectBV=pickBV;

async function doSave() {
  const montant=window.numpadSaisie?.getMontant()||0;
  if(montant<=0){ Toast.error('Indiquez un montant'); return; }
  const libEl=$('saisie-libelle-val');
  const libelle=(libEl?.classList.contains('empty')?'':libEl?.textContent||'').trim();
  if(!libelle){ Toast.error('Ajoutez un libellé'); return; }
  const today=new Date().toISOString().split('T')[0];
  const mois=today.substring(0,7);

  const tx={
    libelle,
    montant,
    categorie:  saisieCat||'Divers',
    compte:     saisieCompte||'Compte Courant',
    typeOp:     saisieType,
    type:       'variable',
    mois,
    date:       today,
    statut:     'attente',
    budgetType: saisieBudget?.type||'compte',
    budgetId:   saisieBudget?.id||null
  };

  const newId=await D().addTransaction(tx);

  // Déduire de l'enveloppe si applicable
  if(saisieBudget?.type==='enveloppe'&&saisieBudget.id&&saisieType==='debit'){
    const result=await D().deduireDeCagnotte(saisieBudget.id, montant, newId, mois);
    if(result.depasse){
      setTimeout(()=>ouvrirAlerteDepassement(result, saisieBudget.id, montant), 300);
      Toast.warning(`Enveloppe dépassée de ${fmt(result.depassement)}`);
      Router.back();
      return;
    }
  }
  // Déduire d'une cagnotte (nouveau store)
  if(saisieBudget?.type==='cagnotte'&&saisieBudget.id&&saisieType==='debit'){
    await D().retirerDeCagnotte(saisieBudget.id, montant, libelle, mois);
  }

  await detecterRecurrente(libelle,montant);
  Toast.success('Transaction enregistrée ✓');
  Router.back();
}
window.saveSaisie=doSave;

/* ==========================================
   ALERTE DÉPASSEMENT ENVELOPPE
   ========================================== */
async function ouvrirAlerteDepassement(result, budgetId, montant) {
  const budgets=await D().getBudgetsVirtuelsActifs();
  const autresBudgets=budgets.filter(b=>b.id!==budgetId&&(parseFloat(b.cagnotte)||0)>0);

  const el=$('depassement-content'); if(!el)return;
  el.innerHTML=`
    <div style="text-align:center;padding:8px 0 16px">
      <div style="font-size:2rem;margin-bottom:8px">⚠️</div>
      <div style="font-size:.88rem;font-weight:700;color:var(--text);margin-bottom:4px">Enveloppe dépassée</div>
      <div style="font-size:.72rem;color:var(--text2)">L'enveloppe <strong style="color:#dcc0a5">${h(result.nomEnveloppe)}</strong> est dépassée de <strong style="color:var(--red)">${fmt(result.depassement)}</strong></div>
    </div>

    <div style="padding:0 16px;margin-bottom:12px">
      <div style="font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);margin-bottom:8px">Comment couvrir le dépassement ?</div>
      <div class="card">

        <div class="card-row" onclick="couvreDepassement('compte')">
          <div class="row-icon" style="background:rgba(220,185,165,0.12)">🏦</div>
          <div class="row-info"><div class="row-label">Compte courant</div><div class="row-sub">Débiter directement du compte</div></div>
          <div class="row-arrow">›</div>
        </div>

        ${autresBudgets.length?`
        <div style="padding:8px 16px 4px;font-size:.6rem;color:var(--text3)">Depuis une autre enveloppe</div>
        ${autresBudgets.slice(0,3).map((b,i)=>{
          const COLORS=['rgba(167,210,191,0.12)','rgba(167,195,230,0.12)','rgba(195,185,230,0.12)'];
          const TEXTS=['#a7d2bf','#a7c3e6','#c3b9e6'];
          return `<div class="card-row" onclick="couvreDepassement('enveloppe',${b.id})">
            <div class="row-icon" style="background:${COLORS[i%COLORS.length]}">${b.icone||'⬜'}</div>
            <div class="row-info"><div class="row-label">${h(b.nom)}</div><div class="row-sub" style="color:${TEXTS[i%TEXTS.length]}">Disponible : ${fmt(b.cagnotte)}</div></div>
            <div class="row-arrow">›</div>
          </div>`;
        }).join('')}`:''}

        <div class="card-row" onclick="couvreDepassement('imprevus')" style="border-bottom:none">
          <div class="row-icon" style="background:rgba(195,185,230,0.12)">🛡️</div>
          <div class="row-info"><div class="row-label">Budget imprévus</div><div class="row-sub">Absorber sur l'enveloppe imprévus</div></div>
          <div class="row-arrow">›</div>
        </div>
      </div>
    </div>`;

  // Stocker le contexte pour la résolution
  window._depassementCtx = { result, budgetId, montant };
  Modal.open('depassement');
}
window.ouvrirAlerteDepassement=ouvrirAlerteDepassement;

async function couvreDepassement(solution, sourceId) {
  const ctx=window._depassementCtx; if(!ctx)return;
  const mois=new Date().toISOString().substring(0,7);

  if(solution==='compte'){
    Toast.success('Dépassement imputé sur le compte courant');
  } else if(solution==='enveloppe'&&sourceId){
    await D().transfererEntreEnveloppes(sourceId, ctx.budgetId, ctx.result.depassement, mois);
    const bs=await D().getBudgetsVirtuels();
    const src=bs.find(b=>b.id===sourceId);
    Toast.success(`Transféré depuis ${src?.nom||'enveloppe'} ✓`);
  } else if(solution==='imprevus'){
    // Chercher une enveloppe imprévus
    const bs=await D().getBudgetsVirtuelsActifs();
    const imp=bs.find(b=>b.nom.toLowerCase().includes('imprévu')||b.nom.toLowerCase().includes('urgence'));
    if(imp){
      await D().transfererEntreEnveloppes(imp.id, ctx.budgetId, ctx.result.depassement, mois);
      Toast.success('Imputé sur l\'enveloppe Imprévus ✓');
    } else {
      Toast.warning('Aucune enveloppe Imprévus trouvée');
    }
  }

  Modal.close('depassement');
  window._depassementCtx=null;
}
window.couvreDepassement=couvreDepassement;

async function detecterRecurrente(libelle,montant) {
  const mots=['netflix','spotify','amazon','essence','total','shell','bp','leclerc','auchan','carrefour','edf','orange','sfr','bouygues','canal'];
  const lb=libelle.toLowerCase();
  const match=mots.find(m=>lb.includes(m));
  if(!match)return;
  const charges=await D().getChargesFixes();
  const dejaFixe=charges.some(c=>c.nom.toLowerCase().includes(match));
  if(dejaFixe)return;
  setTimeout(()=>{
    if(confirm(`"${libelle}" revient souvent.\nVoulez-vous le transformer en charge fixe (${fmt(montant)}/mois) ?`)){
      D().addChargeFixes({nom:libelle,montant,categorie:'Abonnements',actif:true})
        .then(()=>Toast.success('Charge fixe créée ✓'));
    }
  },500);
}

/* ==========================================
   STATISTIQUES
   ========================================== */
Router.onEnter('stats', async function() {
  const txM=await D().getTransactionsByMois(MOIS);
  const rec=txM.filter(t=>t.typeOp==='credit').reduce((s,t)=>s+(parseFloat(t.montant)||0),0);
  const dep=txM.filter(t=>t.typeOp==='debit'&&t.type!=='virtuel').reduce((s,t)=>s+(parseFloat(t.montant)||0),0);
  const sol=rec-dep;
  txt('stats-total-rec','+'+fmt(rec));
  txt('stats-total-dep','-'+fmt(dep));
  const el=$('stats-solde-mois');
  if(el){el.textContent=(sol>=0?'+':'-')+fmt(Math.abs(sol));el.style.color=sol>=0?'#a7d2bf':'var(--red)';}
  await renderChart6Mois();
  renderStatsCat(txM);
  await renderBadgesMensuels();
  await renderAlertes();
  await renderCalendrierCharges();
});

async function renderChart6Mois() {
  const el=$('stats-chart'); if(!el)return;
  const m6=[];
  for(let i=5;i>=0;i--){ const d=new Date(); d.setMonth(d.getMonth()-i); m6.push(d.toISOString().substring(0,7)); }
  const data=await Promise.all(m6.map(async m=>{
    const tx=await D().getTransactionsByMois(m);
    const r=tx.filter(t=>t.typeOp==='credit').reduce((s,t)=>s+(parseFloat(t.montant)||0),0);
    const d=tx.filter(t=>t.typeOp==='debit'&&t.type!=='virtuel').reduce((s,t)=>s+(parseFloat(t.montant)||0),0);
    return{mois:m,rec:r,dep:d,sol:r-d};
  }));
  const mx=Math.max(...data.map(d=>Math.max(d.rec,d.dep)),100);
  const lbs=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const W=320,H=110,bW=(W-40)/6;
  let svg='';
  // Ligne de tendance dépenses
  const pts=data.map((d,i)=>{
    const x=20+i*bW+bW*.5;
    const y=H-15-(d.dep/mx)*(H-20);
    return `${x},${y}`;
  }).join(' ');
  svg+=`<polyline points="${pts}" fill="none" stroke="#a7c3e6" stroke-width="1.5" stroke-dasharray="3,2" opacity=".4"/>`;
  data.forEach((d,i)=>{
    const x=20+i*bW+bW*.08,bw=bW*.38;
    const hR=Math.max(2,(d.rec/mx)*(H-20));
    const hD=Math.max(2,(d.dep/mx)*(H-20));
    const mn=lbs[parseInt(d.mois.split('-')[1])-1];
    const isCurrent=d.mois===MOIS;
    // Fond mois courant
    if(isCurrent) svg+=`<rect x="${x-2}" y="0" width="${bw*2+6}" height="${H-10}" rx="4" fill="rgba(167,210,191,0.04)"/>`;
    svg+=`<rect x="${x}" y="${H-15-hR}" width="${bw}" height="${hR}" rx="3" fill="#a7d2bf" opacity="${isCurrent?'1':'.5'}"/>`;
    svg+=`<rect x="${x+bw+2}" y="${H-15-hD}" width="${bw}" height="${hD}" rx="3" fill="#a7c3e6" opacity="${isCurrent?'.9':'.45'}"/>`;
    svg+=`<text x="${x+bw}" y="${H+2}" text-anchor="middle" style="font-size:${isCurrent?'8.5':'8'}px;fill:${isCurrent?'#a7d2bf':'rgba(255,255,255,.3)'};font-weight:${isCurrent?'600':'400'}">${mn}</text>`;
  });
  el.innerHTML=`<svg width="100%" height="${H+8}" viewBox="0 0 ${W} ${H+8}">${svg}</svg>`;
}

function renderStatsCat(txM) {
  const el=$('stats-cat-list'); if(!el)return;
  const byCat={};
  txM.filter(t=>t.typeOp==='debit'&&t.type!=='virtuel').forEach(t=>{ const c=t.categorie||'Divers'; byCat[c]=(byCat[c]||0)+(parseFloat(t.montant)||0); });
  const sorted=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const total=sorted.reduce((s,[,v])=>s+v,0);
  if(!sorted.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-sub">Aucune dépense ce mois</div></div>`;return;}
  const CAT_COLORS=['#a7c3e6','#dcc0a5','#c3b9e6','#a7d2bf','#b8d4c8','#e6c9a7','#c8b8e6','#a7e6d4'];
  // Donut SVG simplifié
  const W=120,R=46,cx=60,cy=60;
  let offset=0;
  const circ=2*Math.PI*R;
  const arcs=sorted.map(([cat,mt],idx)=>{
    const pct=total>0?(mt/total):0;
    const dash=pct*circ;
    const arc=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${CAT_COLORS[idx%CAT_COLORS.length]}" stroke-width="14"
      stroke-dasharray="${dash.toFixed(1)} ${(circ-dash).toFixed(1)}"
      stroke-dashoffset="${(-offset*circ).toFixed(1)}"
      style="transform:rotate(-90deg);transform-origin:center" opacity=".85"/>`;
    offset+=pct;
    return arc;
  }).join('');
  const donut=$('stats-donut');
  if(donut) donut.innerHTML=`<svg width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="14"/>
    ${arcs}
    <text x="${cx}" y="${cy+4}" text-anchor="middle" style="font-size:11px;fill:rgba(255,255,255,.7);font-weight:700">${sorted.length}</text>
    <text x="${cx}" y="${cy+14}" text-anchor="middle" style="font-size:7px;fill:rgba(255,255,255,.35)">catégories</text>
  </svg>`;

  el.innerHTML=sorted.map(([cat,mt],idx)=>{
    const pct=total>0?(mt/total)*100:0;
    const cd=CATS.find(c=>c.nom===cat)||{e:'📦'};
    const col=CAT_COLORS[idx%CAT_COLORS.length];
    return `<div style="padding:0 16px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">
        <div style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0"></div>
        <span style="font-size:.75rem;font-weight:500;flex:1;color:var(--text)">${cd.e} ${h(cat)}</span>
        <span style="font-size:.73rem;font-weight:600;color:${col}">-${fmt(mt)}</span>
        <span style="font-size:.6rem;color:var(--text3);min-width:30px;text-align:right">${Math.round(pct)}%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${col};opacity:.75;transition:width .8s cubic-bezier(.34,1.56,.64,1)"></div></div>
    </div>`;
  }).join('');
}

async function renderBadgesMensuels() {
  const el=$('stats-badges'); if(!el)return;
  const bs=await D().getBadgesDuMois(MOIS);
  if(!bs.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="section-title">Badges du mois</div>
  <div style="display:flex;gap:8px;padding:0 16px;overflow-x:auto;padding-bottom:10px">
    ${bs.map(b=>`<div class="badge-mensuel earned"><div class="badge-mensuel-icon">${b.icon}</div><div class="badge-mensuel-label">${h(b.label)}</div></div>`).join('')}
  </div>`;
}

/* ── Alertes anticipées ── */
async function renderAlertes() {
  const el=$('stats-alertes'); if(!el)return;
  const alertes=[];
  const txM      = await D().getTransactionsByMois(MOIS);
  const budgets  = await D().getBudgetsVirtuelsActifs();
  const charges  = await D().getChargesFixes();
  const revenus  = parseFloat(await D().getSetting('revenus',0))||0;
  const sv       = await D().calculerSoldeVirtuel(MOIS);
  const today    = new Date();
  const jourMois = today.getDate();
  const totalJours = new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const dep      = txM.filter(t=>t.typeOp==='debit'&&t.type!=='virtuel').reduce((s,t)=>s+(parseFloat(t.montant)||0),0);
  const rythme   = jourMois>0 ? dep/jourMois : 0;
  const joursRest= totalJours-jourMois;
  const projFin  = sv - rythme*joursRest;

  // Alerte solde faible projeté
  if(projFin < 100 && revenus > 0)
    alertes.push({icon:'🔴',titre:'Solde critique fin de mois',texte:`Au rythme actuel, il vous restera ${fmt(Math.max(0,projFin))} fin de mois.`,couleur:'#f87171'});
  else if(projFin < 300 && revenus > 0)
    alertes.push({icon:'🟡',titre:'Solde faible prévu',texte:`Attention, il vous resterait ${fmt(Math.max(0,projFin))} fin de mois.`,couleur:'#dcc0a5'});

  // Enveloppes dépassées ou proches
  for(const bv of budgets){
    const cag=parseFloat(bv.cagnotte)||0, mt=parseFloat(bv.montant)||1;
    const pct=(cag/mt)*100;
    if(pct>=95) alertes.push({icon:'🔴',titre:`Enveloppe ${bv.nom} épuisée`,texte:`Il ne reste que ${fmt(cag)} sur ${fmt(mt)}.`,couleur:'#f87171'});
    else if(pct>=80) alertes.push({icon:'🟡',titre:`Enveloppe ${bv.nom} à surveiller`,texte:`${Math.round(pct)}% du budget consommé.`,couleur:'#dcc0a5'});
  }

  // Prélèvement imminent (dans les 3 prochains jours)
  const tomorrow = today.getDate();
  for(const cf of charges){
    const jour = parseInt(cf.jourPrelevement)||1;
    const diff = jour - tomorrow;
    if(diff>=0 && diff<=3)
      alertes.push({icon:'📅',titre:`Prélèvement imminent : ${cf.nom}`,texte:`${fmt(cf.montant)} prévu le ${jour} du mois.`,couleur:'#a7c3e6'});
  }

  // Pas d'épargne
  const cagnottes = await D().getCagnottes().catch(()=>[]);
  if(!cagnottes.length)
    alertes.push({icon:'💡',titre:'Aucune cagnotte créée',texte:'Commencez à épargner, même 50€/mois font une vraie différence.',couleur:'#a796e6'});

  if(!alertes.length){ el.style.display='none'; return; }
  el.style.display='block';
  el.innerHTML=`<div class="section-title">⚡ Alertes & recommandations</div>
  <div style="padding:0 16px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px">
    ${alertes.map(a=>`<div style="display:flex;gap:12px;padding:12px 14px;background:var(--noir-card);border:1px solid var(--noir-border2);border-left:3px solid ${a.couleur};border-radius:14px;align-items:flex-start">
      <div style="font-size:1rem;flex-shrink:0;margin-top:1px">${a.icon}</div>
      <div><div style="font-size:.72rem;font-weight:600;color:var(--text);margin-bottom:2px">${h(a.titre)}</div>
      <div style="font-size:.62rem;color:var(--text3);line-height:1.4">${h(a.texte)}</div></div>
    </div>`).join('')}
  </div>`;
}

/* ── Calendrier charges fixes ── */
async function renderCalendrierCharges() {
  const el=$('stats-calendrier'); if(!el)return;
  const charges=await D().getChargesFixes();
  if(!charges.length){ el.style.display='none'; return; }
  el.style.display='block';

  const today=new Date().getDate();
  const moisNom=D().formatMoisLabel(MOIS);

  // Trier par jour de prélèvement
  const sorted=[...charges].sort((a,b)=>(parseInt(a.jourPrelevement)||1)-(parseInt(b.jourPrelevement)||1));
  const total=sorted.reduce((s,c)=>s+(parseFloat(c.montant)||0),0);

  el.innerHTML=`<div class="section-title">📅 Prélèvements — ${moisNom}</div>
  <div style="padding:0 16px;margin-bottom:14px">
    <div style="background:var(--noir-card);border-radius:16px;border:1px solid var(--noir-border2);overflow:hidden">
      ${sorted.map((cf,i)=>{
        const jour=parseInt(cf.jourPrelevement)||1;
        const passe=jour<today;
        const today2=jour===today;
        const imminent=jour>today&&jour-today<=3;
        let dotColor='var(--text3)', dotBg='var(--noir-elevated)';
        let badge='';
        if(passe){ dotColor='#a7d2bf'; dotBg='rgba(167,210,191,0.15)'; badge='✓'; }
        else if(today2){ dotColor='#dcc0a5'; dotBg='rgba(220,185,165,0.2)'; badge='Auj.'; }
        else if(imminent){ dotColor='#f87171'; dotBg='rgba(248,113,113,0.12)'; badge='⚡'; }
        return `<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:${i<sorted.length-1?'1px solid var(--noir-border)':'none'};opacity:${passe?'.6':'1'}">
          <div style="width:36px;height:36px;border-radius:10px;background:${dotBg};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">
            <div style="font-size:.7rem;font-weight:700;color:${dotColor};line-height:1">${jour}</div>
            ${badge?`<div style="font-size:.45rem;color:${dotColor};margin-top:1px">${badge}</div>`:''}
          </div>
          <div style="flex:1">
            <div style="font-size:.72rem;font-weight:500;color:${passe?'var(--text3)':'var(--text)'}">${h(cf.nom)}</div>
            <div style="font-size:.58rem;color:var(--text3);margin-top:1px">${h(cf.categorie||'Charge fixe')}</div>
          </div>
          <div style="font-size:.75rem;font-weight:600;color:${today2?'#dcc0a5':imminent?'#f87171':passe?'var(--text3)':'var(--text)'}">${fmt(cf.montant)}</div>
        </div>`;
      }).join('')}
      <div style="padding:10px 14px;background:rgba(255,255,255,.02);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.65rem;color:var(--text3)">Total prélèvements</span>
        <span style="font-size:.75rem;font-weight:700;color:#dcc0a5">${fmt(total)}</span>
      </div>
    </div>
  </div>`;
}

/* ==========================================
   PARAMÈTRES
   ========================================== */
Router.onEnter('parametres', async function() {
  const sol=await D().getSetting('soldeInitial',0);
  const di=await D().getSetting('soldeInitialDate','');
  const f=await D().getSetting('nomFoyer','Mon Foyer');
  const sd=$('param-solde-val'); const dd=$('param-date-val');
  if(sd)sd.textContent=sol?fmt(sol):'Non défini — touchez pour saisir';
  if(dd)dd.textContent=di?'Saisi le '+fmtD(di):'';
  txt('param-foyer-val',f);
  const key=localStorage.getItem('horizon_licence_key');
  txt('param-licence-val',key?key+' · Active':'Non activée');
  for(const[k,tid]of[['alerteBudget','param-toggle-budget'],['alerteChargesFixes','param-toggle-cf'],['alerteIA','param-toggle-ia']]){
    const v=await D().getSetting(k,true); const el=$(tid); if(el)el.classList.toggle('off',!v);
  }
  if(sol){ const g=$('guide-num-1'); if(g){g.textContent='✓';g.classList.add('done');} }
  const cfs=await D().getChargesFixes();
  if(cfs.length){ const g=$('guide-num-2'); if(g){g.textContent='✓';g.classList.add('done');} }
  const bvs=await D().getBudgetsVirtuelsActifs();
  if(bvs.length){ const g=$('guide-num-3'); if(g){g.textContent='✓';g.classList.add('done');} }

  // Afficher le mois courant dans le bouton de clôture
  txt('cloture-mois-label', D().formatMoisLabel(MOIS));
});

window.promptSoldeInit=async function(){
  const cur=await D().getSetting('soldeInitial','');
  const v=prompt('Solde bancaire actuel (€) :',cur||''); if(v===null)return;
  const n=parseFloat(v.replace(',','.')); if(isNaN(n)){Toast.error('Montant invalide');return;}
  await D().setSetting('soldeInitial',n); await D().setSetting('soldeInitialDate',new Date().toISOString().split('T')[0]);
  Toast.success('Solde mis à jour ✓'); Router.go('parametres',{force:true});
};

window.promptNomFoyer=async function(){
  const cur=await D().getSetting('nomFoyer','Mon Foyer');
  const v=prompt('Nom du foyer :',cur); if(!v||!v.trim())return;
  await D().setSetting('nomFoyer',v.trim()); Toast.success('Nom mis à jour ✓');
  Router.go('parametres',{force:true}); setTimeout(()=>txt('accueil-foyer',v.trim()),200);
};

window.toggleAlerte=async function(k,tid){
  const cur=await D().getSetting(k,true); await D().setSetting(k,!cur);
  const el=$(tid); if(el)el.classList.toggle('off',cur);
};

/* ==========================================
   CLÔTURE DE MOIS
   ========================================== */
window.ouvrirCloture=async function(){
  txt('cloture-mois-label',  D().formatMoisLabel(MOIS));
  txt('cloture-mois-label2', D().formatMoisLabel(MOIS));
  // Pré-charger le bilan avant d'ouvrir
  await _renderBilanCloture();
  Modal.open('cloture');
};

async function _renderBilanCloture() {
  const el=$('cloture-bilan'); if(!el)return;
  const txM    = await D().getTransactionsByMois(MOIS);
  const charges= await D().getChargesFixes();
  const budgets= await D().getBudgetsVirtuelsActifs();
  const sv     = await D().calculerSoldeVirtuel(MOIS);
  const revenus= parseFloat(await D().getSetting('revenus',0))||0;
  const rec    = txM.filter(t=>t.typeOp==='credit').reduce((s,t)=>s+(parseFloat(t.montant)||0),0);
  const dep    = txM.filter(t=>t.typeOp==='debit'&&t.type!=='virtuel').reduce((s,t)=>s+(parseFloat(t.montant)||0),0);
  const tCharges=charges.reduce((s,c)=>s+(parseFloat(c.montant)||0),0);
  const tVar   =dep-tCharges;

  // Coaching
  const coachings=[];
  if(sv>0) coachings.push({icon:'✅',txt:`Bilan positif — vous terminez avec ${fmt(sv)} disponible.`,col:'#a7d2bf'});
  else coachings.push({icon:'⚠️',txt:`Mois tendu — attention à l'équilibre budgétaire.`,col:'#dcc0a5'});
  if(revenus>0){
    const tauxCharges=tCharges/revenus;
    if(tauxCharges>0.5) coachings.push({icon:'📋',txt:`Vos charges fixes représentent ${Math.round(tauxCharges*100)}% de vos revenus. Au-delà de 50%, c'est risqué.`,col:'#dcc0a5'});
  }
  const nbRappr=txM.filter(t=>t.statut==='ok').length;
  const nbTotal=txM.filter(t=>t.typeOp==='debit').length;
  if(nbTotal>0&&nbRappr/nbTotal<0.5) coachings.push({icon:'📋',txt:`Seulement ${nbRappr}/${nbTotal} transactions pointées. Pensez à rapprocher votre relevé.`,col:'#a7c3e6'});
  const reliquats=budgets.filter(b=>(parseFloat(b.cagnotte)||0)>0);
  if(reliquats.length) coachings.push({icon:'🎯',txt:`${reliquats.length} enveloppe${reliquats.length>1?'s':''} avec solde restant à réaffecter.`,col:'#a796e6'});

  el.innerHTML=`
    <!-- Synthèse financière -->
    <div style="background:var(--noir-card);border-radius:14px;border:1px solid var(--noir-border2);overflow:hidden;margin-bottom:12px">
      <div style="padding:10px 14px;border-bottom:1px solid var(--noir-border);display:flex;justify-content:space-between">
        <span style="font-size:.68rem;color:var(--text2)">💰 Revenus</span>
        <span style="font-size:.7rem;font-weight:600;color:#a7d2bf">${fmt(rec||revenus)}</span>
      </div>
      <div style="padding:10px 14px;border-bottom:1px solid var(--noir-border);display:flex;justify-content:space-between">
        <span style="font-size:.68rem;color:var(--text2)">📋 Charges fixes</span>
        <span style="font-size:.7rem;font-weight:600;color:#dcc0a5">-${fmt(tCharges)}</span>
      </div>
      <div style="padding:10px 14px;border-bottom:1px solid var(--noir-border);display:flex;justify-content:space-between">
        <span style="font-size:.68rem;color:var(--text2)">🎯 Dépenses variables</span>
        <span style="font-size:.7rem;font-weight:600;color:#a7c3e6">-${fmt(Math.max(0,tVar))}</span>
      </div>
      <div style="padding:10px 14px;display:flex;justify-content:space-between">
        <span style="font-size:.72rem;font-weight:700;color:var(--text)">Solde final</span>
        <span style="font-size:.78rem;font-weight:800;color:${sv>=0?'#a7d2bf':'#f87171'}">${fmt(sv)}</span>
      </div>
    </div>
    <!-- Coaching -->
    ${coachings.length?`<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
      ${coachings.map(c=>`<div style="display:flex;gap:10px;padding:10px 12px;background:var(--noir-card);border:1px solid var(--noir-border2);border-left:3px solid ${c.col};border-radius:12px;align-items:flex-start">
        <span style="font-size:.85rem;flex-shrink:0">${c.icon}</span>
        <span style="font-size:.65rem;color:var(--text2);line-height:1.45">${h(c.txt)}</span>
      </div>`).join('')}
    </div>`:''}`;
}

window.confirmerCloture=async function(){
  const btn=$('cloture-btn');
  if(btn){btn.textContent='⏳ Clôture en cours…';btn.style.opacity='.7';}
  try{
    const result=await D().cloturerMois(MOIS);
    if(result.success){
      // Mémoriser le mois clôturé pour la réaffectation
      window._moisClos = MOIS;
      MOIS=result.moisSuivant;
      Modal.close('cloture');

      if(result.reliquats && result.reliquats.length > 0){
        // Il y a des reliquats à réaffecter — ouvrir la modale de réaffectation
        setTimeout(()=>ouvrirReaffectation(result.reliquats), 400);
      } else {
        Toast.success(`Mois clôturé ✓ Nouveau mois : ${D().formatMoisLabel(MOIS)}`);
        setTimeout(()=>Router.go('accueil',{force:true}),500);
      }
    }
  } catch(e){
    Toast.error('Erreur lors de la clôture');
    console.error(e);
  }
  if(btn){btn.textContent='✅ Confirmer la clôture';btn.style.opacity='1';}
};

/* ==========================================
   RÉAFFECTATION DES RELIQUATS
   ========================================== */
async function ouvrirReaffectation(reliquats) {
  window._reliquats     = reliquats;
  window._reliquatIndex = 0;
  await afficherEtapeReaffectation();
}
window.ouvrirReaffectation = ouvrirReaffectation;

async function afficherEtapeReaffectation() {
  const reliquats = window._reliquats || [];
  const idx       = window._reliquatIndex || 0;

  if(idx >= reliquats.length){
    // Toutes les enveloppes traitées
    Modal.close('reaffectation');
    Toast.success(`Mois clôturé ✓ Nouveau mois : ${D().formatMoisLabel(MOIS)}`);
    setTimeout(()=>Router.go('accueil',{force:true}),500);
    return;
  }

  const item = reliquats[idx];
  const budgets = await D().getBudgetsVirtuelsActifs();
  // Cagnottes disponibles (pas la source elle-même)
  const cagnottes = budgets.filter(b => b.id !== item.id);

  const el = $('reaffectation-content'); if(!el) return;

  const COLORS = ['rgba(167,210,191,0.12)','rgba(167,195,230,0.12)','rgba(195,185,230,0.12)','rgba(220,185,165,0.12)'];
  const TEXTS  = ['#a7d2bf','#a7c3e6','#c3b9e6','#dcc0a5'];

  el.innerHTML = `
    <div style="text-align:center;padding:8px 20px 16px">
      <div style="font-size:2rem;margin-bottom:8px">${item.icone}</div>
      <div style="font-size:.88rem;font-weight:700;color:var(--text);margin-bottom:4px">${h(item.nom)}</div>
      <div style="font-size:.72rem;color:var(--text2)">
        Il reste <strong style="color:#a7d2bf">${fmt(item.soldeRestant)}</strong> non dépensés.<br>
        Où souhaitez-vous les affecter ?
      </div>
      ${reliquats.length > 1 ? `<div style="font-size:.6rem;color:var(--text3);margin-top:6px">${idx+1} / ${reliquats.length}</div>` : ''}
    </div>

    <div style="padding:0 16px 16px">
      <div class="card">

        <!-- Option : compte courant -->
        <div class="card-row" onclick="choisirReaffectation('compte', null)">
          <div class="row-icon" style="background:rgba(220,185,165,0.12)">🏦</div>
          <div class="row-info">
            <div class="row-label">Compte courant</div>
            <div class="row-sub">Récupérer ${fmt(item.soldeRestant)} sur le compte</div>
          </div>
          <div class="row-arrow">›</div>
        </div>

        ${cagnottes.length ? `
        <div style="padding:8px 16px 4px;font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text3)">Vers une cagnotte</div>
        ${cagnottes.map((b,i) => `
          <div class="card-row" onclick="choisirReaffectation('cagnotte', ${b.id})">
            <div class="row-icon" style="background:${COLORS[i%COLORS.length]}">${b.icone||'⬜'}</div>
            <div class="row-info">
              <div class="row-label">${h(b.nom)}</div>
              <div class="row-sub" style="color:${TEXTS[i%TEXTS.length]}">Solde actuel : ${fmt(b.cagnotte||0)}</div>
            </div>
            <div class="row-arrow">›</div>
          </div>`).join('')}
        ` : ''}

      </div>
    </div>`;

  Modal.open('reaffectation');
}
window.afficherEtapeReaffectation = afficherEtapeReaffectation;

async function choisirReaffectation(type, cagnotteId) {
  const reliquats = window._reliquats || [];
  const idx       = window._reliquatIndex || 0;
  const item      = reliquats[idx];
  const moisClos  = window._moisClos || MOIS;

  await D().affecterReliquat(
    item.id,
    item.soldeRestant,
    { type: type === 'cagnotte' ? 'cagnotte' : 'compte', id: cagnotteId },
    moisClos
  );

  const dest = type === 'cagnotte'
    ? (await D().getBudgetsVirtuels()).find(b=>b.id===cagnotteId)
    : null;
  const destLabel = dest ? `→ ${dest.nom}` : '→ Compte courant';
  Toast.success(`${h(item.nom)} : ${fmt(item.soldeRestant)} affecté ${destLabel} ✓`);

  // Passer à l'enveloppe suivante
  window._reliquatIndex = idx + 1;
  await afficherEtapeReaffectation();
}
window.choisirReaffectation = choisirReaffectation;

/* ==========================================
   CHARGES FIXES
   ========================================== */
Router.onEnter('chargesFixes', renderCF);
async function renderCF() {
  const cs=await D().getChargesFixes(); const el=$('cf-list'); if(!el)return;
  if(!cs.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Aucune charge fixe</div><div class="empty-sub">Ajoutez vos charges récurrentes</div></div>`;return;}
  el.innerHTML=`<div class="card">${cs.map(c=>`
    <div class="card-row" onclick="openEditCF(${c.id})">
      <div class="row-icon" style="background:rgba(220,185,165,0.12);border:1px solid rgba(220,185,165,0.2)">📋</div>
      <div class="row-info"><div class="row-label">${h(c.nom)}</div><div class="row-sub">${h(c.categorie||'Charge fixe')}${c.souscat?' · '+h(c.souscat):''}</div></div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:.8rem;font-weight:600;color:#dcc0a5">${fmt(c.montant)}</span>
        <span onclick="event.stopPropagation();suppCF(${c.id})" style="cursor:pointer;padding:4px;color:var(--text3)" title="Supprimer">🗑️</span>
      </div>
    </div>`).join('')}</div>`;
}

window.ajouterChargeFixes=async function(){
  const nom=$('cf-nom')?.value.trim(); const mt=parseFloat($('cf-montant')?.value);
  const cat=$('cf-categorie')?.value.trim()||'Charges fixes'; const sub=$('cf-souscat')?.value.trim()||'';
  const freq=$('cf-frequence')?.value||'mensuelle';
  if(!nom){Toast.error('Saisissez un nom');return;} if(!mt||mt<=0){Toast.error('Montant invalide');return;}
  await D().addChargeFixes({nom,montant:mt,categorie:cat,souscat:sub,frequence:freq,actif:true});
  ['cf-nom','cf-montant','cf-categorie','cf-souscat'].forEach(id=>{const e=$(id);if(e)e.value='';});
  Modal.close('newCF'); Toast.success('Charge fixe ajoutée ✓'); await renderCF();
};

async function openEditCF(id) {
  const cs=await D().getChargesFixes(); const c=cs.find(x=>x.id===id); if(!c)return;
  const ni=$('edit-cf-id'),nn=$('edit-cf-nom'),nm=$('edit-cf-montant'),nc=$('edit-cf-categorie'),ns=$('edit-cf-souscat');
  if(ni)ni.value=id; if(nn)nn.value=c.nom; if(nm)nm.value=c.montant;
  if(nc)nc.value=c.categorie||''; if(ns)ns.value=c.souscat||'';
  Modal.open('editCF');
}
window.openEditCF=openEditCF;

window.sauvegarderEditCF=async function(){
  const id=parseInt($('edit-cf-id')?.value); const nom=$('edit-cf-nom')?.value.trim();
  const mt=parseFloat($('edit-cf-montant')?.value);
  if(!nom){Toast.error('Nom obligatoire');return;} if(!mt||mt<=0){Toast.error('Montant invalide');return;}
  const cs=await D().getChargesFixes(); const c=cs.find(x=>x.id===id);
  if(c){
    c.nom=nom; c.montant=mt;
    const cat=$('edit-cf-categorie')?.value.trim(); if(cat)c.categorie=cat;
    const sub=$('edit-cf-souscat')?.value.trim(); if(sub!==undefined)c.souscat=sub;
    await D().updateChargeFixes(c);
  }
  Modal.close('editCF'); Toast.success('Charge mise à jour ✓'); await renderCF();
};

async function suppCF(id){
  if(!confirm('Supprimer cette charge fixe ?'))return;
  await D().deleteChargeFixes(id); Toast.success('Charge supprimée'); await renderCF();
}
window.suppCF=suppCF;

/* ==========================================
   CHARGES VARIABLES
   ========================================== */
Router.onEnter('chargesVariables', renderCV);
async function renderCV() {
  const cs=await D().getChargesVariables();
  const el=$('cv-list'); if(!el)return;
  if(!cs.length){
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">💳</div><div class="empty-title">Aucune charge variable</div><div class="empty-sub">Créez vos catégories de dépenses habituelles</div></div>`;
    return;
  }
  const COLORS=['rgba(167,195,230,0.12)','rgba(167,210,191,0.12)','rgba(195,185,230,0.12)','rgba(220,185,165,0.12)'];
  const TEXTS=['#a7c3e6','#a7d2bf','#c3b9e6','#dcc0a5'];
  el.innerHTML=`<div class="card">${cs.map((c,i)=>`
    <div class="card-row" onclick="openEditCV(${c.id})">
      <div class="row-icon" style="background:${COLORS[i%COLORS.length]}">${c.icone||'📦'}</div>
      <div class="row-info">
        <div class="row-label">${h(c.nom)}</div>
        <div class="row-sub">${h(c.categorie||'')}${c.souscat?' · '+h(c.souscat):''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${c.plafond?`<span style="font-size:.7rem;color:${TEXTS[i%TEXTS.length]}">max ${fmt(c.plafond)}</span>`:''}
        <span onclick="event.stopPropagation();suppCV(${c.id})" style="cursor:pointer;padding:4px;color:var(--text3)">🗑️</span>
      </div>
    </div>`).join('')}</div>`;
}

window.ajouterChargeVariable=async function(){
  const nom=$('cv-nom')?.value.trim();
  const cat=$('cv-categorie')?.value.trim()||'Charges variables';
  const sub=$('cv-souscat')?.value.trim()||'';
  const plafond=parseFloat($('cv-plafond')?.value)||0;
  const icone=$('cv-icone')?.value.trim()||'📦';
  if(!nom){Toast.error('Saisissez un nom');return;}
  // Budget virtuel lié
  const bvId=parseInt($('cv-budget')?.value)||null;
  await D().addChargeVariable({nom,categorie:cat,souscat:sub,plafond,icone,budgetVirtuelId:bvId});
  ['cv-nom','cv-categorie','cv-souscat','cv-plafond','cv-icone'].forEach(id=>{const e=$(id);if(e)e.value='';});
  Modal.close('newCV'); Toast.success('Charge variable ajoutée ✓'); await renderCV();
};

async function openEditCV(id) {
  const cs=await D().getChargesVariables(); const c=cs.find(x=>x.id===id); if(!c)return;
  if($('edit-cv-id'))  $('edit-cv-id').value=id;
  if($('edit-cv-nom')) $('edit-cv-nom').value=c.nom;
  if($('edit-cv-categorie')) $('edit-cv-categorie').value=c.categorie||'';
  if($('edit-cv-souscat'))   $('edit-cv-souscat').value=c.souscat||'';
  if($('edit-cv-plafond'))   $('edit-cv-plafond').value=c.plafond||'';
  if($('edit-cv-icone'))     $('edit-cv-icone').value=c.icone||'';
  Modal.open('editCV');
}
window.openEditCV=openEditCV;

window.sauvegarderEditCV=async function(){
  const id=parseInt($('edit-cv-id')?.value); const nom=$('edit-cv-nom')?.value.trim();
  if(!nom){Toast.error('Nom obligatoire');return;}
  const cs=await D().getChargesVariables(); const c=cs.find(x=>x.id===id);
  if(c){
    c.nom=nom;
    const cat=$('edit-cv-categorie')?.value.trim(); if(cat)c.categorie=cat;
    const sub=$('edit-cv-souscat')?.value.trim(); if(sub!==undefined)c.souscat=sub;
    c.plafond=parseFloat($('edit-cv-plafond')?.value)||0;
    const ico=$('edit-cv-icone')?.value.trim(); if(ico)c.icone=ico;
    await D().updateChargeVariable(c);
  }
  Modal.close('editCV'); Toast.success('Charge mise à jour ✓'); await renderCV();
};

async function suppCV(id){
  if(!confirm('Supprimer cette charge variable ?'))return;
  await D().deleteChargeVariable(id); Toast.success('Supprimée'); await renderCV();
}
window.suppCV=suppCV;

/* ==========================================
   BUDGETS VIRTUELS
   ========================================== */
Router.onEnter('budgetsVirtuels', renderBV);
async function renderBV() {
  const bs=await D().getBudgetsVirtuels();
  const ac=bs.filter(b=>b.actif!==false);
  const tot=ac.reduce((s,b)=>s+(parseFloat(b.montant)||0),0);
  txt('bv-total',fmt(tot)); txt('bv-count',`${ac.length} budget${ac.length>1?'s':''} actif${ac.length>1?'s':''}`);
  const el=$('bv-list'); if(!el)return;
  if(!bs.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">⬜</div><div class="empty-title">Aucun budget virtuel</div><div class="empty-sub">Créez vos enveloppes budgétaires</div></div>`;return;}
  const COLORS=['rgba(167,210,191,0.12)','rgba(167,195,230,0.12)','rgba(195,185,230,0.12)','rgba(220,185,165,0.12)'];
  const TEXTS=['#a7d2bf','#a7c3e6','#c3b9e6','#dcc0a5'];
  el.innerHTML=`<div class="card">${bs.map((b,i)=>{
    const cag=parseFloat(b.cagnotte)||0,obj=parseFloat(b.objectif)||0;
    const pct=obj>0?Math.min(100,(cag/obj)*100):0;
    const col=COLORS[i%COLORS.length], txt2=TEXTS[i%TEXTS.length];
    return `<div class="card-row" onclick="voirCagnotte(${b.id})">
      <div class="row-icon" style="background:${col}">${b.icone||'⬜'}</div>
      <div class="row-info"><div class="row-label">${h(b.nom)}</div>
        <div class="row-sub" style="color:${txt2}">+${fmt(b.montant)}/mois · Cagnotte : ${fmt(cag)}</div>
        ${obj>0?`<div class="progress-bar" style="margin-top:4px"><div class="progress-fill" style="width:${pct}%;background:${txt2}"></div></div>`:''}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span onclick="event.stopPropagation();openEditBV(${b.id})" style="cursor:pointer;padding:4px;color:var(--text3)">✏️</span>
        <span onclick="event.stopPropagation();suppBV(${b.id})" style="cursor:pointer;padding:4px;color:var(--text3)">🗑️</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

window.selectEmojiiBV=function(e,el){ bvEmoji=e; document.querySelectorAll('.emoji-btn').forEach(b=>b.classList.remove('sel')); if(el)el.classList.add('sel'); };

window.ajouterBudgetVirtuel=async function(){
  const nom=$('bv-nom')?.value.trim(); const mt=parseFloat($('bv-montant')?.value);
  const obj=parseFloat($('bv-objectif')?.value)||0; const ech=$('bv-echeance')?.value||'';
  const estEpargne=$('bv-epargne')?.checked||false;
  if(!nom){Toast.error('Saisissez un nom');return;} if(!mt||mt<=0){Toast.error('Montant invalide');return;}
  await D().addBudgetVirtuel({nom,montant:mt,icone:bvEmoji,objectif:obj,echeance:ech,actif:true,cagnotte:0,estEpargne});
  ['bv-nom','bv-montant','bv-objectif','bv-echeance'].forEach(id=>{const e=$(id);if(e)e.value='';});
  Modal.close('newBV'); Toast.success('Budget virtuel créé ✓'); await renderBV();
};

async function openEditBV(id) {
  const bs=await D().getBudgetsVirtuels(); const b=bs.find(x=>x.id===id); if(!b)return;
  const ni=$('edit-bv-id'),nn=$('edit-bv-nom'),nm=$('edit-bv-montant');
  if(ni)ni.value=id; if(nn)nn.value=b.nom; if(nm)nm.value=b.montant;
  Modal.open('editBV');
}
window.openEditBV=openEditBV;

window.sauvegarderEditBV=async function(){
  const id=parseInt($('edit-bv-id')?.value); const nom=$('edit-bv-nom')?.value.trim();
  const mt=parseFloat($('edit-bv-montant')?.value);
  if(!nom){Toast.error('Nom obligatoire');return;} if(!mt||mt<=0){Toast.error('Montant invalide');return;}
  const bs=await D().getBudgetsVirtuels(); const b=bs.find(x=>x.id===id);
  if(b){b.nom=nom;b.montant=mt;await D().updateBudgetVirtuel(b);}
  Modal.close('editBV'); Toast.success('Budget mis à jour ✓'); await renderBV();
};

async function suppBV(id){
  if(!confirm('Supprimer ce budget et sa cagnotte ?'))return;
  await D().deleteBudgetVirtuel(id); Toast.success('Budget supprimé'); await renderBV();
}
window.suppBV=suppBV;

/* ==========================================
   CAGNOTTE — CORRIGÉE + FONCTIONNELLE
   ========================================== */
Router.onEnter('cagnotte', async function(p){ if(p&&p.budgetId)await voirCagnotte(p.budgetId); });

/* ==========================================
   ÉCRAN LISTE CAGNOTTES (nouveau store)
   ========================================== */
Router.onEnter('cagnottesList', renderCagnottesList);

async function renderCagnottesList() {
  const cagnottes = await D().getCagnottes();
  const actives   = cagnottes.filter(c => c.actif !== false);
  const el = $('cagnottes-list-content'); if(!el) return;

  const C_BG   = ['rgba(167,150,230,0.12)','rgba(140,120,220,0.12)','rgba(190,170,240,0.12)','rgba(120,100,200,0.12)'];
  const C_TEXT = ['#a796e6','#8c78dc','#baaaf0','#7864c8'];

  const totalSolde = actives.reduce((s,c)=>(s+parseFloat(c.solde)||0),0);
  const totalObj   = actives.reduce((s,c)=>(s+parseFloat(c.objectif)||0),0);
  txt('cagnottes-total-solde', fmt(totalSolde));
  txt('cagnottes-total-obj',   totalObj>0?`sur ${fmt(totalObj)} visés`:`${actives.length} cagnotte${actives.length>1?'s':''}`);

  if(!actives.length){
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-title">Aucune cagnotte</div>
      <div class="empty-sub">Créez votre première cagnotte pour commencer à épargner</div></div>`;
    return;
  }

  el.innerHTML=`<div class="card">${actives.map((cag,i)=>{
    const solde=parseFloat(cag.solde)||0, obj=parseFloat(cag.objectif)||0;
    const pct=obj>0?Math.min(100,(solde/obj)*100):0;
    const bg=C_BG[i%C_BG.length], tx=C_TEXT[i%C_TEXT.length];
    return `<div class="card-row" onclick="Router.go('cagnotteDetail',{params:{id:${cag.id}}})">
      <div class="row-icon" style="background:${bg};border:1px solid rgba(167,150,230,0.25)">${cag.icone||'🏦'}</div>
      <div class="row-info">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <div class="row-label">${h(cag.nom)}</div>
          <div style="font-size:.72rem;font-weight:700;color:${tx}">${fmt(solde)}</div>
        </div>
        <div class="row-sub" style="color:${tx};opacity:.7;margin-bottom:${obj>0?'4px':'0'}">${cag.provisionMensuelle>0?'+'+fmt(cag.provisionMensuelle)+'/mois':'Libre'}${obj>0?' · Objectif '+fmt(obj):''}</div>
        ${obj>0?`<div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${tx}"></div></div>
        <div style="font-size:.5rem;color:${tx};opacity:.6;text-align:right;margin-top:2px">${Math.round(pct)}%</div>`:''}
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-left:4px">
        <span onclick="event.stopPropagation();ouvrirEditCagnotte(${cag.id})" style="cursor:pointer;padding:4px;color:var(--text3)">✏️</span>
        <span onclick="event.stopPropagation();supprimerCagnotte(${cag.id})" style="cursor:pointer;padding:4px;color:var(--text3)">🗑️</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/* ==========================================
   ÉCRAN DÉTAIL CAGNOTTE (nouveau store)
   ========================================== */
Router.onEnter('cagnotteDetail', async function(p){
  if(!p?.id) return;
  await afficherDetailCagnotte(p.id);
});

async function afficherDetailCagnotte(id) {
  const cag = await D().getCagnotteById(id);
  if(!cag){ Toast.error('Cagnotte introuvable'); return; }

  window._cagnotteDetailId = id;
  const C_BG   = ['rgba(167,150,230,0.12)','rgba(140,120,220,0.12)','rgba(190,170,240,0.12)','rgba(120,100,200,0.12)'];
  const C_TEXT = ['#a796e6','#8c78dc','#baaaf0','#7864c8'];
  const tx = C_TEXT[0];

  txt('cagnotte-detail-icon',   cag.icone||'🏦');
  txt('cagnotte-detail-nom',    cag.nom);
  txt('cagnotte-detail-solde',  fmt(cag.solde||0));
  txt('cagnotte-detail-mensuel', cag.provisionMensuelle>0?`+${fmt(cag.provisionMensuelle)}/mois`:'Cagnotte libre');

  // Barre objectif
  const progEl = $('cagnotte-detail-progress');
  const obj = parseFloat(cag.objectif)||0;
  const solde = parseFloat(cag.solde)||0;
  if(progEl && obj>0){
    const pct=Math.min(100,(solde/obj)*100);
    progEl.style.display='block';
    progEl.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:.6rem;color:var(--text3)">
      <span>Objectif : ${fmt(obj)}</span><span>${Math.round(pct)}%</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:#a796e6"></div></div>`;
  } else if(progEl){ progEl.style.display='none'; }

  // Historique
  const mvts = await D().getMouvementsCagnotte(id);
  const listEl = $('cagnotte-detail-liste'); if(!listEl) return;
  if(!mvts.length){
    listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-sub">Aucun mouvement</div></div>`;
    return;
  }
  mvts.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  listEl.innerHTML=`<div class="card">${mvts.map(m=>{
    const isPlus=m.type==='credit';
    const icon=isPlus?'📥':'📤';
    const col=isPlus?'#a796e6':'#dcc0a5';
    const bg=isPlus?'rgba(167,150,230,0.1)':'rgba(220,185,165,0.1)';
    return `<div class="card-row" style="cursor:default">
      <div class="row-icon" style="background:${bg}">${icon}</div>
      <div class="row-info">
        <div class="row-label">${h(m.libelle||'Mouvement')}</div>
        <div class="row-sub">${m.date?fmtD(m.date):m.mois||''}</div>
      </div>
      <div class="row-value" style="color:${col}">${isPlus?'+':'-'}${fmt(m.montant)}</div>
    </div>`;
  }).join('')}</div>`;
}
window.afficherDetailCagnotte = afficherDetailCagnotte;

// Ajout manuel depuis détail
window.ouvrirAjoutCagnotteDetail=function(){
  window._cagnotteAction='ajout';
  const el=$('cagnotte-action-title'); if(el)el.textContent="Ajouter de l'argent";
  const btn=$('cagnotte-action-btn'); if(btn){btn.textContent='✅ Ajouter';btn.style.background='linear-gradient(145deg,rgba(167,150,230,0.3),rgba(167,150,230,0.15))';}
  Modal.open('cagnotteAction');
};
window.ouvrirRetraitCagnotteDetail=function(){
  window._cagnotteAction='retrait';
  const el=$('cagnotte-action-title'); if(el)el.textContent="Retirer de l'argent";
  const btn=$('cagnotte-action-btn'); if(btn){btn.textContent='✅ Retirer';btn.style.background='linear-gradient(145deg,rgba(220,185,165,0.3),rgba(220,185,165,0.15))';}
  Modal.open('cagnotteAction');
};
window.confirmerActionCagnotteDetail=async function(){
  const montant=parseFloat($('cagnotte-action-montant')?.value);
  const libelle=$('cagnotte-action-libelle')?.value.trim()||'';
  if(!montant||montant<=0){Toast.error('Montant invalide');return;}
  const id=window._cagnotteDetailId; if(!id)return;
  const mois=new Date().toISOString().substring(0,7);
  if(window._cagnotteAction==='ajout'){
    await D().alimenterCagnotte(id,montant,libelle||'Ajout manuel',mois);
    Toast.success('Montant ajouté ✓');
  } else {
    await D().retirerDeCagnotte(id,montant,libelle||'Retrait manuel',mois);
    Toast.success('Montant retiré ✓');
  }
  Modal.close('cagnotteAction');
  const inp=$('cagnotte-action-montant'); if(inp)inp.value='';
  const lib=$('cagnotte-action-libelle'); if(lib)lib.value='';
  await afficherDetailCagnotte(id);
};

// Créer une cagnotte
window.ajouterCagnotte=async function(){
  const nom=$('new-cag-nom')?.value.trim();
  const prov=parseFloat($('new-cag-provision')?.value)||0;
  const obj=parseFloat($('new-cag-objectif')?.value)||0;
  const icone=$('new-cag-icone')?.value.trim()||'🏦';
  if(!nom){Toast.error('Saisissez un nom');return;}
  await D().addCagnotte({nom,provisionMensuelle:prov,objectif:obj,icone,solde:0,actif:true});
  ['new-cag-nom','new-cag-provision','new-cag-objectif','new-cag-icone'].forEach(id=>{const e=$(id);if(e)e.value='';});
  Modal.close('newCagnotte');
  Toast.success('Cagnotte créée ✓');
  await renderCagnottesList();
};

// Éditer une cagnotte
async function ouvrirEditCagnotte(id){
  const cag=await D().getCagnotteById(id); if(!cag)return;
  if($('edit-cag-id'))  $('edit-cag-id').value=id;
  if($('edit-cag-nom')) $('edit-cag-nom').value=cag.nom;
  if($('edit-cag-provision')) $('edit-cag-provision').value=cag.provisionMensuelle||'';
  if($('edit-cag-objectif'))  $('edit-cag-objectif').value=cag.objectif||'';
  if($('edit-cag-icone'))     $('edit-cag-icone').value=cag.icone||'';
  Modal.open('editCagnotte');
}
window.ouvrirEditCagnotte=ouvrirEditCagnotte;

window.sauvegarderEditCagnotte=async function(){
  const id=parseInt($('edit-cag-id')?.value);
  const nom=$('edit-cag-nom')?.value.trim();
  if(!nom){Toast.error('Nom obligatoire');return;}
  const cag=await D().getCagnotteById(id); if(!cag)return;
  cag.nom=$('edit-cag-nom').value.trim();
  cag.provisionMensuelle=parseFloat($('edit-cag-provision')?.value)||0;
  cag.objectif=parseFloat($('edit-cag-objectif')?.value)||0;
  const ico=$('edit-cag-icone')?.value.trim(); if(ico)cag.icone=ico;
  await D().updateCagnotte(cag);
  Modal.close('editCagnotte');
  Toast.success('Cagnotte mise à jour ✓');
  await renderCagnottesList();
};

async function supprimerCagnotte(id){
  if(!confirm('Supprimer cette cagnotte et tout son historique ?'))return;
  await D().deleteCagnotte(id);
  Toast.success('Cagnotte supprimée');
  await renderCagnottesList();
}
window.supprimerCagnotte=supprimerCagnotte;

async function voirCagnotte(budgetId) {
  const bs=await D().getBudgetsVirtuels();
  const bv=bs.find(b=>b.id===budgetId);
  if(!bv){ Toast.error('Enveloppe introuvable'); return; }

  // Stocker l'id courant pour les actions
  window._cagnotteId=budgetId;

  txt('cagnotte-icon',bv.icone||'💰');
  txt('cagnotte-nom',bv.nom);
  txt('cagnotte-solde',fmt(bv.cagnotte||0));
  txt('cagnotte-mensuel',`+${fmt(bv.montant)}/mois`);

  // Barre de progression objectif
  const obj=parseFloat(bv.objectif)||0;
  const cag=parseFloat(bv.cagnotte)||0;
  const progEl=$('cagnotte-progress');
  if(progEl){
    if(obj>0){
      const pct=Math.min(100,(cag/obj)*100);
      progEl.style.display='block';
      progEl.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:.6rem;color:var(--text3)"><span>Objectif : ${fmt(obj)}</span><span>${Math.round(pct)}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:#a7d2bf"></div></div>`;
    } else {
      progEl.style.display='none';
    }
  }

  // Historique
  const mvts=await D().getMouvementsBV(budgetId);
  const el=$('cagnotte-liste');
  if(!el){
    Router.go('cagnotte',{params:{budgetId}});
    return;
  }
  if(!mvts.length){
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-sub">Aucun mouvement</div></div>`;
  } else {
    mvts.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const typeCols={
      provision:        {icon:'📥',col:'#a7d2bf'},
      depense:          {icon:'📤',col:'#a7c3e6'},
      ajout_manuel:     {icon:'➕',col:'#a7d2bf'},
      retrait_manuel:   {icon:'➖',col:'#dcc0a5'},
      transfert_entrant:{icon:'↙️',col:'#a7d2bf'},
      transfert_sortant:{icon:'↗️',col:'#dcc0a5'},
    };
    el.innerHTML=`<div class="card">${mvts.map(m=>{
      const tc=typeCols[m.type]||{icon:'🔄',col:'var(--text2)'};
      const isPlus=['provision','ajout_manuel','transfert_entrant'].includes(m.type);
      return `<div class="card-row" style="cursor:default">
        <div class="row-icon" style="background:${isPlus?'rgba(167,210,191,0.12)':'rgba(220,185,165,0.12)'}">${tc.icon}</div>
        <div class="row-info"><div class="row-label">${h(m.libelle||(isPlus?'Crédit':'Débit'))}</div><div class="row-sub">${m.date?fmtD(m.date):m.mois||''}</div></div>
        <div class="row-value" style="color:${tc.col}">${isPlus?'+':'-'}${fmt(m.montant)}</div>
      </div>`;
    }).join('')}</div>`;
  }

  // Naviguer vers l'écran cagnotte
  if(Router.current()!=='cagnotte'){
    Router.go('cagnotte',{params:{budgetId}});
  }
}
window.voirCagnotte=voirCagnotte; window.afficherCagnotte=voirCagnotte;

// Ajout manuel sur cagnotte
window.ouvrirAjoutCagnotte=function(){
  window._cagnotteAction='ajout';
  const el=$('cagnotte-action-title'); if(el)el.textContent='Ajouter de l\'argent';
  const el2=$('cagnotte-action-btn'); if(el2){el2.textContent='✅ Ajouter';el2.style.background='linear-gradient(145deg,#3d8b65,#1e4d35)';}
  Modal.open('cagnotteAction');
};

// Retrait manuel
window.ouvrirRetraitCagnotte=function(){
  window._cagnotteAction='retrait';
  const el=$('cagnotte-action-title'); if(el)el.textContent='Retirer de l\'argent';
  const el2=$('cagnotte-action-btn'); if(el2){el2.textContent='✅ Retirer';el2.style.background='linear-gradient(145deg,#b55a1a,#8b3a0a)';}
  Modal.open('cagnotteAction');
};

window.confirmerActionCagnotte=async function(){
  const montantStr=$('cagnotte-action-montant')?.value;
  const libelle=$('cagnotte-action-libelle')?.value.trim()||'';
  const montant=parseFloat(montantStr);
  if(!montant||montant<=0){Toast.error('Montant invalide');return;}
  const id=window._cagnotteId; if(!id)return;
  const updated=await D().mouvementManuelCagnotte(id,montant,window._cagnotteAction,libelle);
  if(updated){
    txt('cagnotte-solde',fmt(updated.cagnotte||0));
    Modal.close('cagnotteAction');
    const inp=$('cagnotte-action-montant'); if(inp)inp.value='';
    const lib=$('cagnotte-action-libelle'); if(lib)lib.value='';
    Toast.success(window._cagnotteAction==='ajout'?'Montant ajouté ✓':'Montant retiré ✓');
    await voirCagnotte(id);
  }
};

/* ==========================================
   SIMULATION DÉPENSE
   ========================================== */
// ── Simulation dépense — modale premium ──
let _simMontant = 0;
let _simStr     = '0';

function ouvrirSimulation() {
  _simMontant = 0;
  _simStr     = '0';
  renderSimInput();
  const res = $('sim-resultat'); if(res) res.innerHTML='';
  Modal.open('simulation');
}
window.ouvrirSimulation = ouvrirSimulation;

function renderSimInput() {
  const el = $('sim-amount-display'); if(!el) return;
  const num = parseFloat(_simStr) || 0;
  el.textContent = num > 0
    ? num.toLocaleString('fr-FR',{minimumFractionDigits:_simStr.includes('.')?Math.min((_simStr.split('.')[1]||'').length,2):0}) + ' €'
    : '0 €';
}

function simPress(k) {
  if(k==='del'){
    _simStr = _simStr.length>1 ? _simStr.slice(0,-1) : '0';
  } else if(k==='.'){
    if(!_simStr.includes('.')) _simStr += '.';
  } else {
    if(_simStr==='0' && k!=='.') _simStr=k;
    else if(_simStr.length < 8) _simStr+=k;
  }
  _simMontant = parseFloat(_simStr)||0;
  renderSimInput();
}
window.simPress = simPress;

async function lancerSimulation() {
  if(_simMontant<=0){ Toast.error('Saisissez un montant'); return; }
  const r = await D().simulerDepense(_simMontant, MOIS);

  const C = {
    confortable: { bg:'rgba(167,210,191,0.1)',  border:'rgba(167,210,191,0.25)', text:'#a7d2bf',  label:'Achat confortable' },
    possible:    { bg:'rgba(220,185,165,0.1)',  border:'rgba(220,185,165,0.25)', text:'#dcc0a5',  label:'Achat possible' },
    risque:      { bg:'rgba(248,113,113,0.1)',  border:'rgba(248,113,113,0.25)', text:'#f87171',  label:'Budget risqué' },
    danger:      { bg:'rgba(248,113,113,0.12)', border:'rgba(248,113,113,0.3)',  text:'#f87171',  label:'Budget dépassé' },
  };
  const c = C[r.statut] || C.possible;

  // Barre impact visuelle — % du solde consommé
  const pctAvant = 100;
  const pctApres = r.soldeAvant > 0 ? Math.max(0, Math.min(100, (r.soldeApres/r.soldeAvant)*100)) : 0;

  let html = `
    <!-- Statut principal -->
    <div style="background:${c.bg};border:1px solid ${c.border};border-radius:16px;padding:14px 16px;margin-bottom:12px;text-align:center">
      <div style="font-size:1.5rem;margin-bottom:4px">${r.emoji}</div>
      <div style="font-size:.85rem;font-weight:700;color:${c.text};margin-bottom:2px">${c.label}</div>
      <div style="font-size:.62rem;color:var(--text3)">Dépense de ${fmt(r.montant)}</div>
    </div>

    <!-- Solde avant / après -->
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <div style="flex:1;background:var(--noir-card);border:1px solid var(--noir-border2);border-radius:14px;padding:12px;text-align:center">
        <div style="font-size:.55rem;color:var(--text3);margin-bottom:4px">Solde avant</div>
        <div style="font-size:.9rem;font-weight:700;color:var(--text)">${fmt(r.soldeAvant)}</div>
      </div>
      <div style="width:24px;display:flex;align-items:center;justify-content:center;font-size:1rem;color:var(--text3)">→</div>
      <div style="flex:1;background:${c.bg};border:1px solid ${c.border};border-radius:14px;padding:12px;text-align:center">
        <div style="font-size:.55rem;color:var(--text3);margin-bottom:4px">Solde après</div>
        <div style="font-size:.9rem;font-weight:700;color:${c.text}">${fmt(r.soldeApres)}</div>
      </div>
    </div>

    <!-- Barre impact -->
    <div style="margin-bottom:12px;padding:0 2px">
      <div style="display:flex;justify-content:space-between;font-size:.55rem;color:var(--text3);margin-bottom:4px">
        <span>Impact sur votre budget</span>
        <span style="color:${c.text}">-${Math.round(100-pctApres)}%</span>
      </div>
      <div style="height:6px;background:var(--noir-border2);border-radius:100px;overflow:hidden">
        <div style="height:100%;width:${pctApres}%;background:${c.text};border-radius:100px;transition:width .6s cubic-bezier(.34,1.56,.64,1)"></div>
      </div>
    </div>

    <!-- Projection fin de mois -->
    <div style="background:var(--noir-card);border:1px solid var(--noir-border2);border-radius:14px;padding:12px 14px;margin-bottom:12px">
      <div style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);margin-bottom:10px">📅 Projection fin de mois</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
        <span style="font-size:.68rem;color:var(--text2)">Reste à vivre / jour</span>
        <span style="font-size:.72rem;font-weight:600;color:${r.resteParJour>20?'#a7d2bf':'#dcc0a5'}">${fmt(r.resteParJour).replace(',00 €','€')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
        <span style="font-size:.68rem;color:var(--text2)">Jours restants</span>
        <span style="font-size:.72rem;font-weight:600;color:var(--text)">${r.joursRestants} j</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
        <span style="font-size:.68rem;color:var(--text2)">Rythme actuel</span>
        <span style="font-size:.72rem;font-weight:600;color:var(--text)">${fmt(r.rythmJour).replace(',00 €','€')}/j</span>
      </div>
      <div style="height:1px;background:var(--noir-border);margin:8px 0"></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.68rem;color:var(--text2)">Estimé fin de mois</span>
        <span style="font-size:.78rem;font-weight:700;color:${r.soldeFinMois>0?'#a7d2bf':'#f87171'}">${fmt(r.soldeFinMois)}</span>
      </div>
    </div>`;

  // Sources alternatives si risque
  const sources = [...(r.enveloppesOk||[]), ...(r.cagnottesOk||[])];
  if(sources.length && (r.statut==='risque'||r.statut==='danger'||r.statut==='possible')){
    html+=`<div style="background:var(--noir-card);border:1px solid var(--noir-border2);border-radius:14px;padding:12px 14px;margin-bottom:4px">
      <div style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);margin-bottom:8px">💳 Payer depuis…</div>
      ${sources.map(s=>{
        const isEnv=s.type==='enveloppe';
        const col=isEnv?'#a7d2bf':'#a796e6';
        const bg=isEnv?'rgba(167,210,191,0.1)':'rgba(167,150,230,0.1)';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--noir-border)">
          <div style="width:28px;height:28px;border-radius:8px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:.85rem">${s.icone}</div>
          <div style="flex:1"><div style="font-size:.68rem;font-weight:500;color:var(--text)">${h(s.nom)}</div><div style="font-size:.55rem;color:${col}">${isEnv?'Enveloppe':'Cagnotte'} · ${fmt(s.solde)}</div></div>
          <div style="font-size:.55rem;color:${col}">✓ Suffisant</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  const res = $('sim-resultat');
  if(res){ res.innerHTML=html; }
}
window.lancerSimulation = lancerSimulation;

/* ==========================================
   LICENCE
   ========================================== */
window.afficherInfoLicence=function(){
  const key=localStorage.getItem('horizon_licence_key');
  const date=localStorage.getItem('horizon_licence_date');
  if(!key){alert('Aucune licence activée');return;}
  const d=date?new Date(date).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'Inconnue';
  if(confirm(`Clé : ${key}\nActivée le : ${d}\n\nCopier la clé ?`))
    navigator.clipboard?.writeText(key).then(()=>Toast.success('Clé copiée !'));
};

/* ==========================================
   PWA
   ========================================== */
function initPWA() {
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); installPrompt=e;
    const btn=$('btn-install-android'); if(btn)btn.style.display='flex';
  });
  if(window.matchMedia('(display-mode: standalone)').matches){
    const s=$('install-section'); if(s)s.style.display='none';
  }
}

window.installerAndroid=async function(){
  if(!installPrompt){Toast.warning('Utilisez Chrome pour installer');return;}
  installPrompt.prompt();
  const r=await installPrompt.userChoice;
  if(r.outcome==='accepted'){ Toast.success('Application installée !'); installPrompt=null; }
};
window.afficherGuideIOS=function(){ Modal.open('installModal'); switchPlatTab('ios'); };
window.switchPlatformTab=function(p){ switchPlatTab(p); };
function switchPlatTab(p){
  document.querySelectorAll('.platform-tab').forEach(t=>t.classList.toggle('active',t.dataset.platform===p));
  const io=$('install-ios-content'),an=$('install-android-content');
  if(io)io.style.display=p==='ios'?'block':'none';
  if(an)an.style.display=p==='android'?'block':'none';
}

/* ==========================================
   SERVICE WORKER
   ========================================== */
async function registerSW() {
  if(!('serviceWorker' in navigator))return;
  try {
    const reg=await navigator.serviceWorker.register('/application/sw.js',{scope:'/application/',updateViaCache:'none'});
    reg.addEventListener('updatefound',()=>{
      reg.installing?.addEventListener('statechange',function(){
        if(this.state==='installed'&&navigator.serviceWorker.controller) showUpdateBar();
      });
    });
  } catch(e){}
}

function showUpdateBar() {
  let bar=$('update-bar');
  if(!bar){
    bar=document.createElement('div');
    bar.id='update-bar';
    bar.style.cssText='position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:var(--green-dark);color:white;display:flex;align-items:center;justify-content:space-between;padding:12px 18px;z-index:999;font-size:.78rem;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.4)';
    bar.innerHTML='🔄 Mise à jour disponible <button onclick="appliquerMaj()" style="background:white;color:var(--green-dark);border:none;padding:6px 14px;border-radius:8px;font-weight:700;font-size:.75rem;cursor:pointer">Mettre à jour</button>';
    document.body.appendChild(bar);
  }
}

window.appliquerMaj=function(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistration().then(reg=>{
      if(reg?.waiting){ reg.waiting.postMessage({type:'SKIP_WAITING'}); window.location.reload(); }
      else window.location.reload();
    });
  } else window.location.reload();
};

/* ==========================================
   DÉMARRAGE
   ========================================== */
window.addEventListener('DOMContentLoaded',async()=>{
  await registerSW();
  let ok=false;
  try{ ok=await LICENCE.isActivated(); }catch(e){}
  if(ok){
    $('screen-activation').style.display='none';
    $('app').style.display='block';
    // Laisser le DOM se peindre avant d'initialiser (résout le bug d'accueil vide)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await appInit();
  }
});

/* ==========================================
   MODAL CONNEXION / LICENCE
   ========================================== */
window.fmtConnexionInput=function(input){
  let v=input.value.replace(/[^A-Z0-9]/gi,'').toUpperCase();
  if(v.length>4)  v=v.slice(0,4)+'-'+v.slice(4);
  if(v.length>9)  v=v.slice(0,9)+'-'+v.slice(9);
  if(v.length>14) v=v.slice(0,14)+'-'+v.slice(14);
  if(v.length>19) v=v.slice(0,19);
  input.value=v;
  input.style.borderColor='var(--noir-border2)';
  const msg=$('connexion-msg'); if(msg)msg.style.display='none';
};

window.ouvrirConnexion=function(){
  const input=$('connexion-input'), msg=$('connexion-msg'), btn=$('connexion-btn');
  if(input){input.value='';input.style.borderColor='var(--noir-border2)';}
  if(msg)msg.style.display='none';
  if(btn)btn.textContent='🔐 Valider ma clé';
  Modal.open('connexion');
  setTimeout(()=>input?.focus(),300);
};

window.doConnexion=async function(){
  const input=$('connexion-input'), msg=$('connexion-msg'), btn=$('connexion-btn');
  const key=input?.value.trim();
  if(!key||key.length<19){showConnexionMsg('error','Clé incomplète — format HRZN-XXXX-XXXX-XXXX');return;}
  btn.textContent='⏳ Vérification…'; btn.style.opacity='.7';
  let result;
  try{ result=await LICENCE.activate(key); }catch(e){ result={success:false,error:'Erreur de validation'}; }
  btn.style.opacity='1';
  if(result.success){
    input.style.borderColor='var(--green-ok)';
    showConnexionMsg('success','✅ Connexion réussie ! Chargement…');
    btn.textContent='✅ Connecté';
    setTimeout(()=>{
      Modal.close('connexion');
      const actEl=$('screen-activation'), appEl=$('app');
      if(actEl&&actEl.style.display!=='none'){ actEl.style.display='none'; if(appEl)appEl.style.display='block'; appInit(); }
      else{ txt('param-licence-val',key+' · Active'); Toast.success('Licence mise à jour ✓'); }
    },1200);
  } else {
    input.style.borderColor='var(--red)'; input.style.color='var(--red)';
    showConnexionMsg('error','❌ '+(result.error||'Clé invalide'));
    btn.textContent='🔐 Valider ma clé';
  }
};

function showConnexionMsg(type,text){
  const el=$('connexion-msg'); if(!el)return;
  el.textContent=text; el.style.display='block';
  if(type==='error'){ el.style.background='var(--red-bg)'; el.style.border='1px solid var(--red-border)'; el.style.color='var(--red)'; }
  else { el.style.background='var(--green-ok-bg)'; el.style.border='1px solid var(--green-ok-border)'; el.style.color='var(--green-ok)'; }
}

window.ouvrirMaLicence=function(){
  const key=localStorage.getItem('horizon_licence_key');
  const date=localStorage.getItem('horizon_licence_date');
  if(!key){ ouvrirConnexion(); return; }
  const keyEl=$('ma-licence-key'), dateEl=$('ma-licence-date');
  if(keyEl)keyEl.textContent=key;
  if(dateEl){ const d=date?new Date(date).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'—'; dateEl.textContent='Activée le '+d; }
  Modal.open('maLicence');
};

window.copierLicence=function(){
  const key=localStorage.getItem('horizon_licence_key'); if(!key)return;
  if(navigator.clipboard){ navigator.clipboard.writeText(key).then(()=>{ Toast.success('Clé copiée ✓'); Modal.close('maLicence'); }); }
  else{ const el=document.createElement('textarea'); el.value=key; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); Toast.success('Clé copiée ✓'); Modal.close('maLicence'); }
};

window.afficherInfoLicence=window.ouvrirMaLicence;
