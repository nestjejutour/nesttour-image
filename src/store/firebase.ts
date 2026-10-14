import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signInWithPopup, signOut,
  GoogleAuthProvider, type Auth, type User,
} from "firebase/auth";
import {
  collection, doc, getDocs, getFirestore, writeBatch,
  type Firestore,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadString, type FirebaseStorage } from "firebase/storage";
import type { Backend } from "./backend";
import type { DB } from "./db";

/**
 * 회사 서버 (Firebase)
 *
 * 설정값이 없으면 null 을 돌려준다. 그러면 프로그램은 브라우저 저장으로 돈다.
 * 설정값은 비밀이 아니다 (원래 브라우저에 노출되는 값).
 * 진짜 비밀인 AI 열쇠는 Cloud Functions 안에만 둔다.
 */

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** 이 프로그램의 자료가 사는 곳. 워크보드와 섞이지 않게 한 칸 아래에 둔다. */
const ROOT = import.meta.env.VITE_FIREBASE_ROOT || "designStudio";

export const firebaseReady = Boolean(cfg.apiKey && cfg.projectId);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

function boot() {
  if (app) return;
  app = initializeApp(cfg as Record<string, string>);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

/* ───────────── 로그인 ───────────── */

export function watchUser(fn: (u: User | null) => void): () => void {
  if (!firebaseReady) { fn(null); return () => {}; }
  boot();
  return onAuthStateChanged(auth!, fn);
}

export async function login(): Promise<void> {
  boot();
  await signInWithPopup(auth!, new GoogleAuthProvider());
}

export async function logout(): Promise<void> {
  boot();
  await signOut(auth!);
}

/** 지금 로그인한 사람의 신분증. AI 창구가 이걸 확인한다. */
export async function idToken(): Promise<string | null> {
  if (!firebaseReady) return null;
  boot();
  const u = auth!.currentUser;
  return u ? await u.getIdToken() : null;
}

/** AI 창구 주소 (Cloud Functions) */
export const functionsBase =
  import.meta.env.VITE_FUNCTIONS_BASE ||
  (cfg.projectId ? `https://asia-northeast3-${cfg.projectId}.cloudfunctions.net` : "");

/* ───────────── 저장소 ───────────── */

/** 창고 하나 = Firestore 묶음 하나 */
const SETS = ["projects", "rules", "categories", "styles", "history"] as const;
type SetName = (typeof SETS)[number];

export function firebaseBackend(): Backend {
  return {
    name: "회사 서버",
    needsLogin: true,

    async load(): Promise<Partial<DB>> {
      boot();
      const out: Partial<DB> = {};
      for (const s of SETS) {
        const snap = await getDocs(collection(db!, ROOT, "data", s));
        const rows = snap.docs.map((d) => d.data() as any);
        if (rows.length) (out as any)[s] = rows;
      }
      const chatSnap = await getDocs(collection(db!, ROOT, "data", "chats"));
      if (!chatSnap.empty) {
        out.chats = Object.fromEntries(
          chatSnap.docs.map((d) => [decodeKey(d.id), (d.data() as any).turns ?? []]),
        );
      }
      return out;
    },

    async save(all: DB): Promise<void> {
      boot();
      // 한 번에 묶어 쓴다. 쓰다 만 상태가 남지 않는다.
      let batch = writeBatch(db!);
      let n = 0;
      const flush = async () => { await batch.commit(); batch = writeBatch(db!); n = 0; };

      const put = async (set: string, id: string, data: unknown) => {
        batch.set(doc(db!, ROOT, "data", set, id), data as any);
        if (++n >= 400) await flush();
      };

      for (const s of SETS) {
        const rows: any[] = (all as any)[s] ?? [];
        for (const row of rows) await put(s, row.id, row);
      }
      for (const [k, turns] of Object.entries(all.chats ?? {})) {
        if (turns.length) await put("chats", encodeKey(k), { turns });
      }
      if (n) await batch.commit();
    },

    /** 사진은 Storage 로. Firestore 문서는 1MB 한도라 사진을 못 담는다. */
    async putFile(key: string, dataUrl: string): Promise<string> {
      boot();
      const r = ref(storage!, `${ROOT}/assets/${key}`);
      await uploadString(r, dataUrl, "data_url");
      return await getDownloadURL(r);
    },
  };
}

/* Firestore 문서 이름에 / 를 못 쓴다 */
const encodeKey = (k: string) => k.replace(/\//g, "__");
const decodeKey = (k: string) => k.replace(/__/g, "/");
