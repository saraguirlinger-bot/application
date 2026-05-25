/* ============================================
   HORIZON BUDGET — Système de licences
   Gestion des clés d'activation
   v1.0
   ============================================ */

const LICENCE = {

  // ---- CONFIGURATION ----
  // Préfixe des clés valides
  PREFIX: 'HRZN',

  // Sel secret pour la validation (NE PAS DIVULGUER)
  // Changez cette valeur avant mise en production !
  SECRET: 'HorizonPME2026Budget',

  // Clé de stockage local
  STORAGE_KEY: 'horizon_licence',

  /* ==========================================
     VÉRIFICATION D'UNE CLÉ
     ========================================== */
  async verify(key) {
    if (!key || typeof key !== 'string') return false;

    // Nettoyage et mise en majuscules
    const clean = key.trim().toUpperCase().replace(/\s/g, '');

    // Format attendu : HRZN-XXXX-XXXX-XXXX
    const regex = /^HRZN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!regex.test(clean)) return false;

    // Extraction des segments
    const parts    = clean.split('-');
    const segment1 = parts[1]; // ex: A1B2
    const segment2 = parts[2]; // ex: C3D4
    const segment3 = parts[3]; // ex: E5F6

    // Vérification : le segment3 doit correspondre
    // au hash des deux premiers segments + secret
    const expected = await this._hash(segment1 + segment2 + this.SECRET);
    const checksum = expected.substring(0, 4).toUpperCase();

    return segment3 === checksum;
  },

  /* ==========================================
     ACTIVATION
     ========================================== */
  async activate(key) {
    const valid = await this.verify(key);
    if (!valid) return { success: false, error: 'Clé invalide ou incorrecte.' };

    const clean = key.trim().toUpperCase().replace(/\s/g, '');

    // Vérifier si déjà utilisée (stockage local)
    const existing = localStorage.getItem(this.STORAGE_KEY);
    if (existing) {
      const data = JSON.parse(existing);
      if (data.key !== clean) {
        return { success: false, error: 'Une autre licence est déjà activée sur cet appareil.' };
      }
    }

    // Enregistrement de la licence
    const licenceData = {
      key:         clean,
      activatedAt: new Date().toISOString(),
      device:      navigator.userAgent.substring(0, 50)
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(licenceData));
    return { success: true, data: licenceData };
  },

  /* ==========================================
     VÉRIFICATION SI ACTIVÉE
     ========================================== */
  async isActivated() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return false;
      const data  = JSON.parse(stored);
      if (!data.key) return false;
      // Re-vérifier la clé stockée
      return await this.verify(data.key);
    } catch {
      return false;
    }
  },

  /* ==========================================
     INFOS LICENCE
     ========================================== */
  getInfo() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  /* ==========================================
     RÉINITIALISATION (admin uniquement)
     ========================================== */
  reset() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  /* ==========================================
     HASH SHA-256 (interne)
     ========================================== */
  async _hash(str) {
    const encoder = new TextEncoder();
    const data    = encoder.encode(str);
    const buffer  = await crypto.subtle.digest('SHA-256', data);
    const bytes   = Array.from(new Uint8Array(buffer));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
};

/* ==========================================
   GÉNÉRATEUR DE CLÉS
   À utiliser côté admin/vendeur uniquement
   ========================================== */
const LicenceGenerator = {

  async generate(quantity = 1) {
    const keys = [];
    for (let i = 0; i < quantity; i++) {
      const s1 = this._randomSegment();
      const s2 = this._randomSegment();
      const hash = await LICENCE._hash(s1 + s2 + LICENCE.SECRET);
      const s3 = hash.substring(0, 4).toUpperCase();
      keys.push(`HRZN-${s1}-${s2}-${s3}`);
    }
    return keys;
  },

  _randomSegment() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result  = '';
    for (let i = 0; i < 4; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
};
