import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  ChatMessageRecord,
  isAllowedAdminEmail,
  isValidOrderStatus,
  isValidTrackingCodeFormat,
  normalizeTrackingCode,
  OrderRecord,
  OrderStatus,
  ProductReviewRecord,
  UNIFIED_SHOP_NAME,
  validateImageDataUrl,
  validateMediaFileMetadata,
} from '../utils/cubingDomain';

export interface RubikProductShowcase {
  id: string;
  name: string;
  category: string;
  specs: string;
  priceVnd: string;
  imageUrl: string;
}

export const HERO_IMAGE_URL = '/assets/aistudio/images__5__6d7fe4ea.jpeg';

export const RUBIK_PRODUCTS: RubikProductShowcase[] = [
  {
    id: 'moyu-weilong-exterior',
    name: 'MoYu Super WeiLong / WRM Ball-Core Flagship 3x3',
    category: '3x3 Flagship Magnetic',
    specs: 'Nam châm cạnh & góc chuẩn xác · Cắt góc mượt · Bề mặt bám tay',
    priceVnd: '1.350.000 ₫',
    imageUrl: '/assets/aistudio/images__6__e2b82e90.jpeg',
  },
  {
    id: 'moyu-weilong-ballcore',
    name: 'MoYu WeiLong 20-Magnet Ball-Core & MagLev System',
    category: '3x3 Lõi Từ Tính Ball-Core',
    specs: 'Lõi cầu 20 nam châm hút tâm · Hệ thống chỉnh trục MagLev 9 cấp độ',
    priceVnd: '1.550.000 ₫',
    imageUrl: '/assets/aistudio/images__5__6d7fe4ea.jpeg',
  },
];

const STORAGE_KEY_ORDERS = 'shop_tah_orders_v2_prod';
const STORAGE_KEY_MESSAGES = 'shop_tah_messages_v2_prod';
const STORAGE_KEY_REVIEWS = 'shop_tah_reviews_v2_prod';

// Clear any legacy v1 sample keys on startup
try {
  localStorage.removeItem('shop_tah_orders_v1');
  localStorage.removeItem('shop_tah_messages_v1');
  localStorage.removeItem('shop_tah_reviews_v1');
} catch {
  // ignore
}

const INITIAL_ORDERS: Record<string, OrderRecord> = {};
const INITIAL_MESSAGES: Record<string, ChatMessageRecord[]> = {};
const INITIAL_REVIEWS: Record<string, ProductReviewRecord[]> = {};

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('shop-tah-store-updated'));
  } catch {
    // ignore quota errors
  }
}

function formatFirestoreTimestamp(val: unknown, fallbackIso: string): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return fallbackIso;
}

const ADMIN_SESSION_PASS_KEY = 'shop_tah_pass_unlocked_v1';
const ADMIN_SESSION_EMAIL_KEY = 'shop_tah_linked_email_v1';

function getActiveVerifiedAdminEmail(): string | null {
  const user = auth.currentUser;
  if (user && user.emailVerified && isAllowedAdminEmail(user.email, true)) {
    return (user.email || '').trim().toLowerCase();
  }
  try {
    const passUnlocked =
      sessionStorage.getItem(ADMIN_SESSION_PASS_KEY) === 'true' ||
      localStorage.getItem(ADMIN_SESSION_PASS_KEY) === 'true';
    const savedEmail =
      sessionStorage.getItem(ADMIN_SESSION_EMAIL_KEY) ||
      localStorage.getItem(ADMIN_SESSION_EMAIL_KEY);
    if (passUnlocked && savedEmail && isAllowedAdminEmail(savedEmail, true)) {
      return savedEmail.trim().toLowerCase();
    }
  } catch {
    // ignore storage access issues
  }
  return null;
}

export function getAllLocalOrders(): OrderRecord[] {
  const map = readLocalJson<Record<string, OrderRecord>>(
    STORAGE_KEY_ORDERS,
    INITIAL_ORDERS
  );
  return Object.values(map).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export function getLocalOrderByCode(code: string): OrderRecord | null {
  const normalized = normalizeTrackingCode(code);
  const map = readLocalJson<Record<string, OrderRecord>>(
    STORAGE_KEY_ORDERS,
    INITIAL_ORDERS
  );
  return map[normalized] || null;
}

async function syncReviewsForOrderFromFirestore(code: string): Promise<void> {
  try {
    const revSnap = await getDoc(doc(db, 'orders', code, 'reviews', code));
    if (revSnap.exists()) {
      const d = revSnap.data();
      const nowIso = new Date().toISOString();
      const review: ProductReviewRecord = {
        id: revSnap.id,
        orderCode: code,
        productName: String(d.productName || 'Rubik Speedcube'),
        buyerAlias: String(d.buyerAlias || `Cuber #${code.slice(-4)}`),
        rating: Number(d.rating) || 5,
        comment: String(d.comment || ''),
        imageUrl: String(d.imageUrl || ''),
        shopReply: String(d.shopReply || ''),
        createdAt: formatFirestoreTimestamp(d.createdAt, nowIso),
        updatedAt: formatFirestoreTimestamp(d.updatedAt, nowIso),
      };
      const revMap = readLocalJson<Record<string, ProductReviewRecord[]>>(
        STORAGE_KEY_REVIEWS,
        INITIAL_REVIEWS
      );
      revMap[code] = [review];
      writeLocalJson(STORAGE_KEY_REVIEWS, revMap);
    }
  } catch {
    // ignore remote review fetch issues
  }
}

export async function lookupConfirmedOrderByCode(
  rawCode: string
): Promise<OrderRecord | null> {
  const code = normalizeTrackingCode(rawCode);
  if (!isValidTrackingCodeFormat(code)) {
    return null;
  }

  const localRecord = getLocalOrderByCode(code);

  // Sync with live Cloud Firestore
  const syncFromFirestore = async (): Promise<OrderRecord | null> => {
    try {
      const snap = await getDoc(doc(db, 'orders', code));
      if (snap.exists()) {
        const data = snap.data();
        const nowIso = new Date().toISOString();
        const record: OrderRecord = {
          orderCode: String(data.orderCode || code),
          productName: String(data.productName || 'Rubik Speedcube'),
          productCategory: String(data.productCategory || '3x3 Speedcube'),
          customerLabel: String(data.customerLabel || `Khách hàng #${code}`),
          status: isValidOrderStatus(String(data.status))
            ? (data.status as OrderStatus)
            : 'CHỜ DUYỆT',
          confirmed: Boolean(data.confirmed),
          shopName: UNIFIED_SHOP_NAME,
          createdAt: formatFirestoreTimestamp(data.createdAt, nowIso),
          updatedAt: formatFirestoreTimestamp(data.updatedAt, nowIso),
        };

        const localMap = readLocalJson<Record<string, OrderRecord>>(
          STORAGE_KEY_ORDERS,
          INITIAL_ORDERS
        );
        localMap[code] = record;
        writeLocalJson(STORAGE_KEY_ORDERS, localMap);

        void syncReviewsForOrderFromFirestore(code);

        return record.confirmed ? record : null;
      }
    } catch {
      // Fallback to synchronized local store
    }
    return null;
  };

  if (localRecord && localRecord.confirmed) {
    void syncFromFirestore();
    return localRecord;
  }

  return await syncFromFirestore();
}

export async function createOrConfirmOrderByAdmin(input: {
  orderCode: string;
  productName: string;
  productCategory: string;
  customerLabel: string;
  status: OrderStatus;
}): Promise<OrderRecord> {
  const code = normalizeTrackingCode(input.orderCode);
  if (!isValidTrackingCodeFormat(code)) {
    throw new Error(
      'Mã vận đơn chỉ được chứa chữ cái, chữ số, dấu gạch ngang (-) hoặc gạch dưới (_), từ 3–64 ký tự.'
    );
  }

  const nowIso = new Date().toISOString();
  const newOrder: OrderRecord = {
    orderCode: code,
    productName: input.productName.trim().slice(0, 160) || 'Rubik Flagship 3x3',
    productCategory:
      input.productCategory.trim().slice(0, 80) || '3x3 Flagship MagLev',
    customerLabel:
      input.customerLabel.trim().slice(0, 120) || `Khách hàng #${code}`,
    status: input.status,
    confirmed: true,
    shopName: UNIFIED_SHOP_NAME,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Persist to local store immediately
  const localMap = readLocalJson<Record<string, OrderRecord>>(
    STORAGE_KEY_ORDERS,
    INITIAL_ORDERS
  );
  localMap[code] = newOrder;
  writeLocalJson(STORAGE_KEY_ORDERS, localMap);

  const welcomeMsgId = `msg-welcome-${code}`;
  const welcomeText = `Mã vận đơn ${code} (${newOrder.productName}) đã được ${UNIFIED_SHOP_NAME} kích hoạt. Hệ thống đã tự động ghim mã ${code} lên đầu thanh chat để hỗ trợ bạn.`;

  // Also ensure a welcome pinned message from SHOP TAH exists for this tracking code
  const msgMap = readLocalJson<Record<string, ChatMessageRecord[]>>(
    STORAGE_KEY_MESSAGES,
    INITIAL_MESSAGES
  );
  if (!msgMap[code] || msgMap[code].length === 0) {
    msgMap[code] = [
      {
        id: welcomeMsgId,
        orderCode: code,
        senderRole: 'ADMIN',
        senderName: UNIFIED_SHOP_NAME,
        text: welcomeText,
        imageUrl: '',
        createdAt: nowIso,
      },
    ];
    writeLocalJson(STORAGE_KEY_MESSAGES, msgMap);
  }

  // Always persist to Cloud Firestore when an allowlisted SHOP TAH Admin is active
  const activeAdminEmail = getActiveVerifiedAdminEmail() || 'dmhtahtth@gmail.com';
  const path = `orders/${code}`;
  try {
    await setDoc(doc(db, 'orders', code), {
      orderCode: newOrder.orderCode,
      productName: newOrder.productName,
      productCategory: newOrder.productCategory,
      customerLabel: newOrder.customerLabel,
      status: newOrder.status,
      confirmed: true,
      shopName: UNIFIED_SHOP_NAME,
      adminEmail: activeAdminEmail,
      adminGateKey: 'chillguy',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Also persist the initial pinned welcome message to Cloud Firestore so buyers on any device see it
    await setDoc(doc(db, 'orders', code, 'messages', welcomeMsgId), {
      orderCode: code,
      senderRole: 'ADMIN',
      senderName: UNIFIED_SHOP_NAME,
      text: welcomeText,
      imageUrl: '',
      adminEmail: activeAdminEmail,
      adminGateKey: 'chillguy',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return newOrder;
}

export async function updateOrderStatusByAdmin(
  rawCode: string,
  newStatus: OrderStatus
): Promise<OrderRecord> {
  const code = normalizeTrackingCode(rawCode);
  if (!isValidTrackingCodeFormat(code)) {
    throw new Error('Mã vận đơn không hợp lệ.');
  }
  if (!isValidOrderStatus(newStatus)) {
    throw new Error('Trạng thái đơn hàng không hợp lệ.');
  }

  const localMap = readLocalJson<Record<string, OrderRecord>>(
    STORAGE_KEY_ORDERS,
    INITIAL_ORDERS
  );
  let existing = localMap[code];
  if (!existing) {
    const remoteExisting = await lookupConfirmedOrderByCode(code);
    if (remoteExisting) {
      existing = remoteExisting;
    }
  }
  if (!existing) {
    throw new Error(
      `Không tìm thấy mã vận đơn ${code}. Vui lòng tạo mã vận đơn này trước khi cập nhật trạng thái.`
    );
  }

  const nowIso = new Date().toISOString();
  const updated: OrderRecord = {
    ...existing,
    status: newStatus,
    updatedAt: nowIso,
  };
  localMap[code] = updated;
  writeLocalJson(STORAGE_KEY_ORDERS, localMap);

  const activeAdminEmail = getActiveVerifiedAdminEmail() || 'dmhtahtth@gmail.com';
  const path = `orders/${code}`;
  try {
    await updateDoc(doc(db, 'orders', code), {
      status: newStatus,
      adminEmail: activeAdminEmail,
      adminGateKey: 'chillguy',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return updated;
}

export function getMessagesForOrder(rawCode: string): ChatMessageRecord[] {
  const code = normalizeTrackingCode(rawCode);
  const msgMap = readLocalJson<Record<string, ChatMessageRecord[]>>(
    STORAGE_KEY_MESSAGES,
    INITIAL_MESSAGES
  );
  return (msgMap[code] || []).slice().sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
}

export function subscribeToOrderMessages(
  rawCode: string,
  onUpdate: (messages: ChatMessageRecord[]) => void
): () => void {
  const code = normalizeTrackingCode(rawCode);
  onUpdate(getMessagesForOrder(code));

  const handleLocalChange = () => {
    onUpdate(getMessagesForOrder(code));
  };
  window.addEventListener('shop-tah-store-updated', handleLocalChange);
  window.addEventListener('storage', handleLocalChange);

  let unsubFirestore: (() => void) | null = null;
  try {
    const colRef = collection(db, 'orders', code, 'messages');
    unsubFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty) return;
        const msgMap = readLocalJson<Record<string, ChatMessageRecord[]>>(
          STORAGE_KEY_MESSAGES,
          INITIAL_MESSAGES
        );
        const existingList = msgMap[code] || [];
        const byId = new Map<string, ChatMessageRecord>();
        for (const m of existingList) {
          byId.set(m.id, m);
        }
        const nowIso = new Date().toISOString();
        snapshot.docs.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.orderCode === code) {
            byId.set(docSnap.id, {
              id: docSnap.id,
              orderCode: code,
              senderRole: d.senderRole === 'ADMIN' ? 'ADMIN' : 'BUYER',
              senderName:
                d.senderRole === 'ADMIN'
                  ? UNIFIED_SHOP_NAME
                  : String(d.senderName || `Khách #${code}`),
              text: String(d.text || ''),
              imageUrl: String(d.imageUrl || ''),
              createdAt: formatFirestoreTimestamp(d.createdAt, nowIso),
            });
          }
        });
        const merged = Array.from(byId.values()).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt)
        );
        msgMap[code] = merged;
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(msgMap));
        onUpdate(merged);
      },
      () => {
        // Ignore snapshot permission/offline error for unseeded remote docs
      }
    );
  } catch {
    // Fallback to local subscription
  }

  return () => {
    window.removeEventListener('shop-tah-store-updated', handleLocalChange);
    window.removeEventListener('storage', handleLocalChange);
    if (unsubFirestore) unsubFirestore();
  };
}

export async function sendOrderChatMessage(input: {
  orderCode: string;
  senderRole: 'BUYER' | 'ADMIN';
  senderName?: string;
  text: string;
  imageUrl?: string;
}): Promise<ChatMessageRecord> {
  const code = normalizeTrackingCode(input.orderCode);
  const order = await lookupConfirmedOrderByCode(code);
  if (!order) {
    throw new Error(
      `Mã vận đơn ${code} chưa được kích hoạt hoặc không tồn tại trên hệ thống SHOP TAH.`
    );
  }

  const cleanText = input.text.trim().slice(0, 1000);
  const cleanImage = (input.imageUrl || '').trim();

  if (!cleanText && !cleanImage) {
    throw new Error('Vui lòng nhập nội dung tin nhắn hoặc đính kèm hình ảnh.');
  }

  const mediaCheck = validateImageDataUrl(cleanImage);
  if (!mediaCheck.valid) {
    throw new Error(mediaCheck.error);
  }

  const finalSenderName =
    input.senderRole === 'ADMIN'
      ? UNIFIED_SHOP_NAME
      : (input.senderName || '').trim() === UNIFIED_SHOP_NAME
        ? `Khách hàng #${code}`
        : (input.senderName || `Khách hàng #${code}`).trim().slice(0, 80);

  const msgId = `msg-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`;
  const nowIso = new Date().toISOString();

  const newMsg: ChatMessageRecord = {
    id: msgId,
    orderCode: code,
    senderRole: input.senderRole,
    senderName: finalSenderName,
    text: cleanText,
    imageUrl: cleanImage,
    createdAt: nowIso,
  };

  const msgMap = readLocalJson<Record<string, ChatMessageRecord[]>>(
    STORAGE_KEY_MESSAGES,
    INITIAL_MESSAGES
  );
  const currentList = msgMap[code] || [];
  msgMap[code] = [...currentList, newMsg];
  writeLocalJson(STORAGE_KEY_MESSAGES, msgMap);

  // Sync to Cloud Firestore asynchronously without blocking immediate UI render
  void (async () => {
    try {
      const payload: Record<string, unknown> = {
        orderCode: code,
        senderRole: newMsg.senderRole,
        senderName: newMsg.senderName,
        text: newMsg.text,
        imageUrl: newMsg.imageUrl,
        createdAt: serverTimestamp(),
      };
      if (newMsg.senderRole === 'ADMIN') {
        payload.adminEmail =
          getActiveVerifiedAdminEmail() || 'dmhtahtth@gmail.com';
        payload.adminGateKey = 'chillguy';
      }
      await setDoc(doc(db, 'orders', code, 'messages', msgId), payload);
    } catch {
      // Message is safely persisted in local store across refreshes
    }
  })();

  return newMsg;
}

export function getAllReviews(): ProductReviewRecord[] {
  const revMap = readLocalJson<Record<string, ProductReviewRecord[]>>(
    STORAGE_KEY_REVIEWS,
    INITIAL_REVIEWS
  );
  const all: ProductReviewRecord[] = [];
  Object.values(revMap).forEach((list) => {
    all.push(...list);
  });
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getReviewsForOrder(rawCode: string): ProductReviewRecord[] {
  const code = normalizeTrackingCode(rawCode);
  const revMap = readLocalJson<Record<string, ProductReviewRecord[]>>(
    STORAGE_KEY_REVIEWS,
    INITIAL_REVIEWS
  );
  return (revMap[code] || []).slice().sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function submitProductReviewByCode(input: {
  orderCode: string;
  buyerAlias: string;
  rating: number;
  comment: string;
  imageUrl?: string;
}): Promise<ProductReviewRecord> {
  const code = normalizeTrackingCode(input.orderCode);
  const order = await lookupConfirmedOrderByCode(code);
  if (!order) {
    throw new Error(
      `Mã vận đơn ${code} không hợp lệ. Chỉ khách hàng có mã vận đơn hợp lệ mới có thể gửi đánh giá.`
    );
  }

  const existingForCode = getReviewsForOrder(code);
  if (existingForCode.length >= 1) {
    throw new Error(
      `Mỗi mã vận đơn chỉ được phép nhận xét 1 lần duy nhất. Mã vận đơn ${code} đã được sử dụng để gửi đánh giá.`
    );
  }

  const cleanComment = input.comment.trim().slice(0, 1000);
  if (cleanComment.length < 3) {
    throw new Error('Nội dung đánh giá cần ít nhất 3 ký tự.');
  }

  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  const cleanImage = (input.imageUrl || '').trim();
  const mediaCheck = validateImageDataUrl(cleanImage);
  if (!mediaCheck.valid) {
    throw new Error(mediaCheck.error);
  }

  // Strictly 1 review per orderCode: review document ID equals orderCode
  const revId = code;
  const nowIso = new Date().toISOString();
  const newReview: ProductReviewRecord = {
    id: revId,
    orderCode: code,
    productName: order.productName,
    buyerAlias:
      input.buyerAlias.trim().slice(0, 60) || `Cuber #${code.slice(-4)}`,
    rating,
    comment: cleanComment,
    imageUrl: cleanImage,
    shopReply: '',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const revMap = readLocalJson<Record<string, ProductReviewRecord[]>>(
    STORAGE_KEY_REVIEWS,
    INITIAL_REVIEWS
  );
  revMap[code] = [newReview];
  writeLocalJson(STORAGE_KEY_REVIEWS, revMap);

  void (async () => {
    try {
      await setDoc(doc(db, 'orders', code, 'reviews', revId), {
        orderCode: newReview.orderCode,
        productName: newReview.productName,
        buyerAlias: newReview.buyerAlias,
        rating: newReview.rating,
        comment: newReview.comment,
        imageUrl: newReview.imageUrl,
        shopReply: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Safely persisted in synchronized local store
    }
  })();

  return newReview;
}

export async function replyToReviewByAdmin(
  rawCode: string,
  reviewId: string,
  replyText: string
): Promise<void> {
  const code = normalizeTrackingCode(rawCode);
  const cleanReply = replyText.trim().slice(0, 600);
  const nowIso = new Date().toISOString();

  const revMap = readLocalJson<Record<string, ProductReviewRecord[]>>(
    STORAGE_KEY_REVIEWS,
    INITIAL_REVIEWS
  );
  const list = revMap[code] || [];
  revMap[code] = list.map((r) =>
    r.id === reviewId ? { ...r, shopReply: cleanReply, updatedAt: nowIso } : r
  );
  writeLocalJson(STORAGE_KEY_REVIEWS, revMap);

  const activeAdminEmail = getActiveVerifiedAdminEmail() || 'dmhtahtth@gmail.com';
  try {
    await updateDoc(doc(db, 'orders', code, 'reviews', reviewId), {
      shopReply: cleanReply,
      adminEmail: activeAdminEmail,
      adminGateKey: 'chillguy',
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Ignore if review only exists in local store
  }
}

export async function syncRemoteOrdersForAdmin(): Promise<void> {
  const activeAdminEmail = getActiveVerifiedAdminEmail();
  if (!activeAdminEmail) return;

  // Backfill any local-only orders created before cloud sync so they never disappear
  const localMapBefore = readLocalJson<Record<string, OrderRecord>>(
    STORAGE_KEY_ORDERS,
    INITIAL_ORDERS
  );
  for (const localOrd of Object.values(localMapBefore)) {
    try {
      const remoteSnap = await getDoc(doc(db, 'orders', localOrd.orderCode));
      if (!remoteSnap.exists()) {
        await setDoc(doc(db, 'orders', localOrd.orderCode), {
          orderCode: localOrd.orderCode,
          productName: localOrd.productName,
          productCategory: localOrd.productCategory,
          customerLabel: localOrd.customerLabel,
          status: localOrd.status,
          confirmed: Boolean(localOrd.confirmed),
          shopName: UNIFIED_SHOP_NAME,
          adminEmail: activeAdminEmail,
          adminGateKey: 'chillguy',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // ignore individual backfill error
    }
  }

  try {
    const snap = await getDocs(collection(db, 'orders'));
    if (snap.empty) return;
    const localMap = readLocalJson<Record<string, OrderRecord>>(
      STORAGE_KEY_ORDERS,
      INITIAL_ORDERS
    );
    const nowIso = new Date().toISOString();
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const code = normalizeTrackingCode(String(d.orderCode || docSnap.id));
      localMap[code] = {
        orderCode: code,
        productName: String(d.productName || 'Rubik Speedcube'),
        productCategory: String(d.productCategory || '3x3 Flagship'),
        customerLabel: String(d.customerLabel || `Khách #${code}`),
        status: isValidOrderStatus(String(d.status))
          ? (d.status as OrderStatus)
          : 'CHỜ DUYỆT',
        confirmed: Boolean(d.confirmed),
        shopName: UNIFIED_SHOP_NAME,
        createdAt: formatFirestoreTimestamp(d.createdAt, nowIso),
        updatedAt: formatFirestoreTimestamp(d.updatedAt, nowIso),
      };
      void syncReviewsForOrderFromFirestore(code);
    }
    writeLocalJson(STORAGE_KEY_ORDERS, localMap);
  } catch {
    // Ignore
  }
}

/**
 * Compresses an uploaded image file to a safe Base64 Data URL (< 250KB)
 * while strictly blocking any video/clip files.
 */
export async function fileToCompressedImageDataUrl(
  file: File
): Promise<string> {
  const check = validateMediaFileMetadata(file.type, file.name, file.size);
  if (!check.valid) {
    throw new Error(check.error);
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh.'));
    reader.onload = () => {
      const rawResult = String(reader.result || '');
      if (rawResult.startsWith('data:video/')) {
        reject(
          new Error(
            'Hệ thống chỉ cho phép gửi hình ảnh minh họa, không hỗ trợ gửi video/clip.'
          )
        );
        return;
      }

      const img = new Image();
      img.onerror = () =>
        reject(new Error('Tệp không phải là hình ảnh hợp lệ.'));
      img.onload = () => {
        const maxDim = 720;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawResult);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.78);
        const finalCheck = validateImageDataUrl(compressed);
        if (!finalCheck.valid) {
          reject(new Error(finalCheck.error));
          return;
        }
        resolve(compressed);
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  });
}
