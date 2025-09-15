const firestore = require('@google-cloud/firestore');
import * as overlay from './overlay';

const db  = new firestore.Firestore();
let stop = () => {};           // unsubscribe placeholder

/** watch /entitlements/<email> and fire overlay on new IDs */
export async function watch(email: string) {
  // stop previous listener (if any)
  stop();

  stop = db.collection('entitlements')
           .doc(email)
           .onSnapshot((snap: any) => {
              if (!snap.exists) return;
              const data = snap.data();
              const ids = (data?.ids && Array.isArray(data.ids)) ? data.ids : [];
              ids.forEach((id: string) => {
                // url rule: you already store SKU → image somewhere ↓
                const url = `https://cdn.my‑stickers.com/${id}.png`;
                overlay.createOverlay('auto-'+id, url);
              });
           },
           (err: Error) => console.error('🔥 Firestore watch error', err));
}

export function unwatch() { stop(); }
