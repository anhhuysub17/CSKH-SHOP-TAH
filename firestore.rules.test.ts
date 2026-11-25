import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateFirestoreRuleOperation,
  OrderRecord,
  SimulatedRuleContext,
} from './src/utils/cubingDomain';

const NOW = '2026-11-23T19:40:00.000Z';

const CONFIRMED_ORDER: OrderRecord = {
  orderCode: 'TAH-GAN15-889',
  productName: 'GAN 15 MagLev UV Coated 3x3',
  productCategory: '3x3 Flagship MagLev',
  customerLabel: 'Cuber Minh Khôi',
  status: 'ĐANG GIAO',
  confirmed: true,
  shopName: 'SHOP TAH',
  createdAt: NOW,
  updatedAt: NOW,
};

const baseCtx: SimulatedRuleContext = {
  auth: null,
  requestTimeIso: NOW,
  existingOrders: {
    'TAH-GAN15-889': CONFIRMED_ORDER,
  },
};

const adminCtx: SimulatedRuleContext = {
  ...baseCtx,
  auth: {
    uid: 'admin-1',
    email: 'dmhtahtth@gmail.com',
    email_verified: true,
  },
};

test('Dirty Dozen 1: Unauthenticated user cannot create an order tracking code', () => {
  const res = evaluateFirestoreRuleOperation(
    baseCtx,
    'create',
    'orders',
    { orderCode: 'TAH-HACK-01' },
    { ...CONFIRMED_ORDER, orderCode: 'TAH-HACK-01' }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 2: Authenticated user with unverified admin email cannot create order', () => {
  const spoofCtx: SimulatedRuleContext = {
    ...baseCtx,
    auth: {
      uid: 'spoof-1',
      email: 'dmhtahtth@gmail.com',
      email_verified: false,
    },
  };
  const res = evaluateFirestoreRuleOperation(
    spoofCtx,
    'create',
    'orders',
    { orderCode: 'TAH-SPOOF-02' },
    { ...CONFIRMED_ORDER, orderCode: 'TAH-SPOOF-02' }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 3: Unauthenticated buyer cannot list/scrape all orders', () => {
  const res = evaluateFirestoreRuleOperation(baseCtx, 'list', 'orders', {
    orderCode: 'TAH-GAN15-889',
  });
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 4: Shadow field injection on Order creation is rejected', () => {
  const res = evaluateFirestoreRuleOperation(
    adminCtx,
    'create',
    'orders',
    { orderCode: 'TAH-GAN15-889' },
    { ...CONFIRMED_ORDER, isSuperAdmin: true }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 5: Invalid order status enum is rejected', () => {
  const res = evaluateFirestoreRuleOperation(
    adminCtx,
    'update',
    'orders',
    { orderCode: 'TAH-GAN15-889' },
    { ...CONFIRMED_ORDER, status: 'HỦY ĐƠN TÙY Ý' },
    { ...CONFIRMED_ORDER }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 6: Mutating immortal createdAt field on Order update is rejected', () => {
  const res = evaluateFirestoreRuleOperation(
    adminCtx,
    'update',
    'orders',
    { orderCode: 'TAH-GAN15-889' },
    { ...CONFIRMED_ORDER, createdAt: '2020-01-01T00:00:00.000Z' },
    { ...CONFIRMED_ORDER }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 7: Orphaned chat message under non-existent tracking code is rejected', () => {
  const res = evaluateFirestoreRuleOperation(
    baseCtx,
    'create',
    'messages',
    { orderCode: 'TAH-FAKE-999', subId: 'msg-01' },
    {
      orderCode: 'TAH-FAKE-999',
      senderRole: 'BUYER',
      senderName: 'Khách mua Rubik',
      text: 'Shop ơi kiểm tra giúp em',
      imageUrl: '',
      createdAt: NOW,
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 8: Buyer spoofing SHOP TAH Admin in chat is rejected', () => {
  const res = evaluateFirestoreRuleOperation(
    baseCtx,
    'create',
    'messages',
    { orderCode: 'TAH-GAN15-889', subId: 'msg-02' },
    {
      orderCode: 'TAH-GAN15-889',
      senderRole: 'ADMIN',
      senderName: 'SHOP TAH',
      text: 'Giả mạo chủ shop',
      imageUrl: '',
      createdAt: NOW,
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 9: Video clip upload in chat message is rejected', () => {
  const res = evaluateFirestoreRuleOperation(
    baseCtx,
    'create',
    'messages',
    { orderCode: 'TAH-GAN15-889', subId: 'msg-03' },
    {
      orderCode: 'TAH-GAN15-889',
      senderRole: 'BUYER',
      senderName: 'Khách mua Rubik',
      text: 'Gửi clip quay rubik',
      imageUrl: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
      createdAt: NOW,
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 10: Oversized message text (> 1000 chars) is rejected', () => {
  const res = evaluateFirestoreRuleOperation(
    baseCtx,
    'create',
    'messages',
    { orderCode: 'TAH-GAN15-889', subId: 'msg-04' },
    {
      orderCode: 'TAH-GAN15-889',
      senderRole: 'BUYER',
      senderName: 'Khách mua Rubik',
      text: 'A'.repeat(1005),
      imageUrl: '',
      createdAt: NOW,
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 11: Out-of-range star rating on product review is rejected', () => {
  const res = evaluateFirestoreRuleOperation(
    baseCtx,
    'create',
    'reviews',
    { orderCode: 'TAH-GAN15-889', subId: 'TAH-GAN15-889' },
    {
      orderCode: 'TAH-GAN15-889',
      productName: 'GAN 15 MagLev UV Coated 3x3',
      buyerAlias: 'Cuber Minh Khôi',
      rating: 10,
      comment: 'Rubik xoay rất mượt',
      imageUrl: '',
      shopReply: '',
      createdAt: NOW,
      updatedAt: NOW,
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen 12: Buyer spoofing official SHOP TAH reply or creating a 2nd review ID is rejected', () => {
  const res = evaluateFirestoreRuleOperation(
    baseCtx,
    'create',
    'reviews',
    { orderCode: 'TAH-GAN15-889', subId: 'TAH-GAN15-889' },
    {
      orderCode: 'TAH-GAN15-889',
      productName: 'GAN 15 MagLev UV Coated 3x3',
      buyerAlias: 'Cuber Minh Khôi',
      rating: 5,
      comment: 'Rubik xoay rất mượt',
      imageUrl: '',
      shopReply: 'Shop tặng miễn phí 100%',
      createdAt: NOW,
      updatedAt: NOW,
    }
  );
  assert.equal(res, 'PERMISSION_DENIED');

  const secondReviewRes = evaluateFirestoreRuleOperation(
    baseCtx,
    'create',
    'reviews',
    { orderCode: 'TAH-GAN15-889', subId: 'rev-02-duplicate' },
    {
      orderCode: 'TAH-GAN15-889',
      productName: 'GAN 15 MagLev UV Coated 3x3',
      buyerAlias: 'Cuber Minh Khôi',
      rating: 5,
      comment: 'Nhận xét lần 2 cho cùng 1 mã vận đơn',
      imageUrl: '',
      shopReply: '',
      createdAt: NOW,
      updatedAt: NOW,
    }
  );
  assert.equal(secondReviewRes, 'PERMISSION_DENIED');
});
