export type OrderStatus =
  | 'CHỜ DUYỆT'
  | 'ĐỢI GỬI HÀNG'
  | 'ĐANG GIAO'
  | 'ĐÃ GỬI THÀNH CÔNG';

export const ORDER_STATUS_STEPS: readonly OrderStatus[] = [
  'CHỜ DUYỆT',
  'ĐỢI GỬI HÀNG',
  'ĐANG GIAO',
  'ĐÃ GỬI THÀNH CÔNG',
] as const;

export const ADMIN_SECRET_PASSWORD = 'chillguy';

export const ALLOWED_ADMIN_EMAILS: readonly string[] = [
  'dmhtahtth@gmail.com',
  'trananhhuy09032012@gmail.com',
  'nguyendinhtiantinh126@gmail.com',
] as const;

export const UNIFIED_SHOP_NAME = 'SHOP TAH';

export const SHOP_WORKING_HOURS_NOTICE =
  'Thông báo giờ làm việc: Tối 6h - 8h (T2 - T6) , 8h (sáng) - 22h (tối) (Cuối tuần)';

export function canOrderSubmitReview(existingReviewsCount: number): boolean {
  return existingReviewsCount === 0;
}

export const TRACKING_CODE_REGEX = /^[a-zA-Z0-9_-]+$/;
export const IMAGE_DATA_URL_REGEX =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=]+$/;

export interface OrderRecord {
  orderCode: string;
  productName: string;
  productCategory: string;
  customerLabel: string;
  status: OrderStatus;
  confirmed: boolean;
  shopName: 'SHOP TAH';
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  orderCode: string;
  senderRole: 'BUYER' | 'ADMIN';
  senderName: string;
  text: string;
  imageUrl: string;
  createdAt: string;
}

export interface ProductReviewRecord {
  id: string;
  orderCode: string;
  productName: string;
  buyerAlias: string;
  rating: number;
  comment: string;
  imageUrl: string;
  shopReply: string;
  createdAt: string;
  updatedAt: string;
}

export function normalizeTrackingCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidTrackingCodeFormat(code: string): boolean {
  const normalized = normalizeTrackingCode(code);
  return (
    normalized.length >= 3 &&
    normalized.length <= 64 &&
    TRACKING_CODE_REGEX.test(normalized)
  );
}

export function maskTrackingCodeForPublic(code: string): string {
  const clean = normalizeTrackingCode(code);
  if (clean.length <= 4) {
    return '****';
  }
  const prefix = clean.slice(0, 2);
  const suffix = clean.slice(-2);
  return `${prefix}••••${suffix}`;
}

export function isValidOrderStatus(status: string): status is OrderStatus {
  return (ORDER_STATUS_STEPS as readonly string[]).includes(status);
}

export function getOrderStatusStepIndex(status: OrderStatus): number {
  const idx = ORDER_STATUS_STEPS.indexOf(status);
  return idx === -1 ? 0 : idx;
}

export function verifyAdminPasswordGate(inputPassword: string): boolean {
  return inputPassword.trim() === ADMIN_SECRET_PASSWORD;
}

export function isAllowedAdminEmail(
  email: string | null | undefined,
  emailVerified = true
): boolean {
  if (!email || !emailVerified) return false;
  const normalized = email.trim().toLowerCase();
  return ALLOWED_ADMIN_EMAILS.includes(normalized);
}

export function getUnifiedAdminDisplayName(
  email: string | null | undefined
): string {
  return isAllowedAdminEmail(email, true) ? UNIFIED_SHOP_NAME : '';
}

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
}

export function validateMediaFileMetadata(
  mimeType: string,
  fileName: string,
  byteSize: number
): MediaValidationResult {
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (fileName || '').toLowerCase();

  const isVideoClip =
    lowerMime.startsWith('video/') ||
    /\.(mp4|mov|webm|avi|mkv|flv|wmv|m4v)$/i.test(lowerName);

  if (isVideoClip) {
    return {
      valid: false,
      error:
        'Hệ thống chỉ cho phép gửi hình ảnh minh họa (JPG, PNG, WEBP, GIF), tuyệt đối không hỗ trợ gửi video/clip.',
    };
  }

  const isAllowedImage =
    /^image\/(png|jpeg|jpg|webp|gif)$/i.test(lowerMime) ||
    /\.(png|jpe?g|webp|gif)$/i.test(lowerName);

  if (!isAllowedImage) {
    return {
      valid: false,
      error: 'Định dạng tệp không hợp lệ. Vui lòng chỉ chọn tệp hình ảnh.',
    };
  }

  if (byteSize > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Dung lượng ảnh gốc tối đa 10MB.',
    };
  }

  return { valid: true };
}

export function validateImageDataUrl(dataUrl: string): MediaValidationResult {
  if (!dataUrl) {
    return { valid: true };
  }
  if (dataUrl.startsWith('data:video/')) {
    return {
      valid: false,
      error:
        'Hệ thống chỉ cho phép gửi hình ảnh minh họa, không hỗ trợ gửi video/clip.',
    };
  }
  if (dataUrl.length > 350000) {
    return {
      valid: false,
      error: 'Dữ liệu hình ảnh vượt quá giới hạn tối ưu (350KB sau nén).',
    };
  }
  if (!IMAGE_DATA_URL_REGEX.test(dataUrl)) {
    return {
      valid: false,
      error: 'Chuỗi dữ liệu hình ảnh không đúng chuẩn Base64 Image.',
    };
  }
  return { valid: true };
}

export function generateTrackingCode(prefix = 'TAH'): string {
  const cleanPrefix = prefix
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') || 'TAH';
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${cleanPrefix}-${suffix}`;
}

/**
 * Pure simulation of Firestore Security Rules for Phase 0 / Phase 5 TDD verification
 */
export interface SimulatedRuleContext {
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  requestTimeIso: string;
  existingOrders: Record<string, OrderRecord>;
}

export function evaluateFirestoreRuleOperation(
  ctx: SimulatedRuleContext,
  operation: 'get' | 'list' | 'create' | 'update' | 'delete',
  collectionType: 'orders' | 'messages' | 'reviews',
  pathIds: { orderCode: string; subId?: string },
  incomingData?: Record<string, unknown>,
  existingData?: Record<string, unknown>
): 'ALLOWED' | 'PERMISSION_DENIED' {
  const isTokenAdmin =
    ctx.auth !== null &&
    ctx.auth.email_verified === true &&
    ALLOWED_ADMIN_EMAILS.includes(ctx.auth.email.toLowerCase());

  const hasValidAdminPayloadGate = (data?: Record<string, unknown>) =>
    Boolean(
      data &&
        typeof data.adminEmail === 'string' &&
        ALLOWED_ADMIN_EMAILS.includes(data.adminEmail) &&
        data.adminGateKey === ADMIN_SECRET_PASSWORD
    );

  const isOptionalAdminFieldsValid = (data: Record<string, unknown>) => {
    if (
      'adminEmail' in data &&
      (typeof data.adminEmail !== 'string' ||
        !ALLOWED_ADMIN_EMAILS.includes(data.adminEmail))
    ) {
      return false;
    }
    if ('adminGateKey' in data && data.adminGateKey !== ADMIN_SECRET_PASSWORD) {
      return false;
    }
    return true;
  };

  const isAuthorizedAdminWrite =
    isTokenAdmin || hasValidAdminPayloadGate(incomingData);

  if (!isValidTrackingCodeFormat(pathIds.orderCode)) {
    return 'PERMISSION_DENIED';
  }

  if (collectionType === 'orders') {
    if (operation === 'get') {
      return 'ALLOWED';
    }
    if (operation === 'list') {
      return isTokenAdmin ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (operation === 'delete') {
      return isTokenAdmin ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (!isAuthorizedAdminWrite || !incomingData) {
      return 'PERMISSION_DENIED';
    }

    const requiredKeys = [
      'orderCode',
      'productName',
      'productCategory',
      'customerLabel',
      'status',
      'confirmed',
      'shopName',
      'createdAt',
      'updatedAt',
    ];
    const allowedKeys = [...requiredKeys, 'adminEmail', 'adminGateKey'];
    const keys = Object.keys(incomingData);
    if (
      !requiredKeys.every((k) => keys.includes(k)) ||
      !keys.every((k) => allowedKeys.includes(k)) ||
      !isOptionalAdminFieldsValid(incomingData)
    ) {
      return 'PERMISSION_DENIED';
    }

    if (
      incomingData.orderCode !== pathIds.orderCode ||
      typeof incomingData.productName !== 'string' ||
      incomingData.productName.length < 2 ||
      incomingData.productName.length > 160 ||
      typeof incomingData.productCategory !== 'string' ||
      incomingData.productCategory.length < 2 ||
      incomingData.productCategory.length > 80 ||
      typeof incomingData.customerLabel !== 'string' ||
      incomingData.customerLabel.length < 1 ||
      incomingData.customerLabel.length > 120 ||
      typeof incomingData.status !== 'string' ||
      !isValidOrderStatus(incomingData.status) ||
      typeof incomingData.confirmed !== 'boolean' ||
      incomingData.shopName !== UNIFIED_SHOP_NAME
    ) {
      return 'PERMISSION_DENIED';
    }

    if (operation === 'create') {
      if (
        incomingData.createdAt !== ctx.requestTimeIso ||
        incomingData.updatedAt !== ctx.requestTimeIso
      ) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }

    if (operation === 'update') {
      if (!existingData) return 'PERMISSION_DENIED';
      if (
        incomingData.orderCode !== existingData.orderCode ||
        incomingData.shopName !== existingData.shopName ||
        incomingData.createdAt !== existingData.createdAt ||
        incomingData.updatedAt !== ctx.requestTimeIso
      ) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }
  }

  const parentOrder = ctx.existingOrders[pathIds.orderCode];
  const isConfirmedParent = Boolean(parentOrder && parentOrder.confirmed);

  if (collectionType === 'messages') {
    if (operation === 'list') {
      return 'ALLOWED';
    }
    if (!pathIds.subId || !isValidTrackingCodeFormat(pathIds.subId)) {
      return 'PERMISSION_DENIED';
    }
    if (operation === 'get') {
      return isConfirmedParent ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (operation === 'update') {
      return 'PERMISSION_DENIED';
    }
    if (operation === 'delete') {
      return isTokenAdmin ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (operation === 'create') {
      if (!incomingData || !isConfirmedParent) return 'PERMISSION_DENIED';
      const requiredKeys = [
        'orderCode',
        'senderRole',
        'senderName',
        'text',
        'imageUrl',
        'createdAt',
      ];
      const allowedKeys = [...requiredKeys, 'adminEmail', 'adminGateKey'];
      const keys = Object.keys(incomingData);
      if (
        !requiredKeys.every((k) => keys.includes(k)) ||
        !keys.every((k) => allowedKeys.includes(k)) ||
        !isOptionalAdminFieldsValid(incomingData)
      ) {
        return 'PERMISSION_DENIED';
      }

      const text = incomingData.text;
      const imageUrl = incomingData.imageUrl;
      if (
        incomingData.orderCode !== pathIds.orderCode ||
        (incomingData.senderRole !== 'BUYER' &&
          incomingData.senderRole !== 'ADMIN') ||
        typeof incomingData.senderName !== 'string' ||
        incomingData.senderName.length < 2 ||
        incomingData.senderName.length > 80 ||
        typeof text !== 'string' ||
        text.length > 1000 ||
        typeof imageUrl !== 'string' ||
        (text.length === 0 && imageUrl.length === 0) ||
        !validateImageDataUrl(imageUrl).valid ||
        incomingData.createdAt !== ctx.requestTimeIso
      ) {
        return 'PERMISSION_DENIED';
      }

      if (incomingData.senderRole === 'ADMIN') {
        if (
          !isAuthorizedAdminWrite ||
          incomingData.senderName !== UNIFIED_SHOP_NAME
        ) {
          return 'PERMISSION_DENIED';
        }
      } else {
        if (
          incomingData.senderName === UNIFIED_SHOP_NAME ||
          'adminGateKey' in incomingData
        ) {
          return 'PERMISSION_DENIED';
        }
      }

      return 'ALLOWED';
    }
  }

  if (collectionType === 'reviews') {
    if (operation === 'list') return 'ALLOWED';
    if (!pathIds.subId || !isValidTrackingCodeFormat(pathIds.subId)) {
      return 'PERMISSION_DENIED';
    }
    if (operation === 'get') {
      return isConfirmedParent ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (operation === 'delete') {
      return isTokenAdmin ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (!incomingData || !isConfirmedParent) return 'PERMISSION_DENIED';

    const requiredKeys = [
      'orderCode',
      'productName',
      'buyerAlias',
      'rating',
      'comment',
      'imageUrl',
      'shopReply',
      'createdAt',
      'updatedAt',
    ];
    const allowedKeys = [...requiredKeys, 'adminEmail', 'adminGateKey'];
    const keys = Object.keys(incomingData);
    if (
      !requiredKeys.every((k) => keys.includes(k)) ||
      !keys.every((k) => allowedKeys.includes(k)) ||
      !isOptionalAdminFieldsValid(incomingData)
    ) {
      return 'PERMISSION_DENIED';
    }

    if (
      incomingData.orderCode !== pathIds.orderCode ||
      typeof incomingData.productName !== 'string' ||
      incomingData.productName.length < 2 ||
      incomingData.productName.length > 160 ||
      typeof incomingData.buyerAlias !== 'string' ||
      incomingData.buyerAlias.length < 2 ||
      incomingData.buyerAlias.length > 60 ||
      typeof incomingData.rating !== 'number' ||
      !Number.isInteger(incomingData.rating) ||
      incomingData.rating < 1 ||
      incomingData.rating > 5 ||
      typeof incomingData.comment !== 'string' ||
      incomingData.comment.length < 3 ||
      incomingData.comment.length > 1000 ||
      typeof incomingData.imageUrl !== 'string' ||
      !validateImageDataUrl(incomingData.imageUrl).valid ||
      typeof incomingData.shopReply !== 'string' ||
      incomingData.shopReply.length > 600
    ) {
      return 'PERMISSION_DENIED';
    }

    if (operation === 'create') {
      if (
        pathIds.subId !== pathIds.orderCode ||
        incomingData.shopReply !== '' ||
        'adminGateKey' in incomingData ||
        incomingData.createdAt !== ctx.requestTimeIso ||
        incomingData.updatedAt !== ctx.requestTimeIso
      ) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }

    if (operation === 'update') {
      if (!isAuthorizedAdminWrite || !existingData) return 'PERMISSION_DENIED';
      if (
        incomingData.orderCode !== existingData.orderCode ||
        incomingData.productName !== existingData.productName ||
        incomingData.buyerAlias !== existingData.buyerAlias ||
        incomingData.rating !== existingData.rating ||
        incomingData.comment !== existingData.comment ||
        incomingData.imageUrl !== existingData.imageUrl ||
        incomingData.createdAt !== existingData.createdAt ||
        incomingData.updatedAt !== ctx.requestTimeIso
      ) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }
  }

  return 'PERMISSION_DENIED';
}
