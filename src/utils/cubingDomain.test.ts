import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTrackingCode,
  isValidTrackingCodeFormat,
  maskTrackingCodeForPublic,
  isValidOrderStatus,
  getOrderStatusStepIndex,
  verifyAdminPasswordGate,
  isAllowedAdminEmail,
  getUnifiedAdminDisplayName,
  validateMediaFileMetadata,
  validateImageDataUrl,
  UNIFIED_SHOP_NAME,
  canOrderSubmitReview,
  SHOP_WORKING_HOURS_NOTICE,
} from './cubingDomain';

test('Each tracking code is only allowed 1 review and working hours notice is accurate', () => {
  assert.equal(canOrderSubmitReview(0), true);
  assert.equal(canOrderSubmitReview(1), false);
  assert.equal(canOrderSubmitReview(2), false);
  assert.equal(SHOP_WORKING_HOURS_NOTICE.includes('6h - 8h'), true);
  assert.equal(SHOP_WORKING_HOURS_NOTICE.includes('8h (sáng) - 22h (tối)'), true);
});

test('Tracking code normalization, format validation, and public masking', () => {
  assert.equal(normalizeTrackingCode('  tah-gan15-889 '), 'TAH-GAN15-889');
  assert.equal(isValidTrackingCodeFormat('TAH-GAN15-889'), true);
  assert.equal(isValidTrackingCodeFormat('ab'), false);
  assert.equal(isValidTrackingCodeFormat('TAH INVALID SPACE'), false);
  assert.equal(maskTrackingCodeForPublic('TAH-GAN15-889'), 'TA••••89');
  assert.equal(maskTrackingCodeForPublic('AB12'), '****');
});

test('Order status steps validation and index mapping', () => {
  assert.equal(isValidOrderStatus('CHỜ DUYỆT'), true);
  assert.equal(isValidOrderStatus('ĐỢI GỬI HÀNG'), true);
  assert.equal(isValidOrderStatus('ĐANG GIAO'), true);
  assert.equal(isValidOrderStatus('ĐÃ GỬI THÀNH CÔNG'), true);
  assert.equal(isValidOrderStatus('ĐÃ HỦY'), false);

  assert.equal(getOrderStatusStepIndex('CHỜ DUYỆT'), 0);
  assert.equal(getOrderStatusStepIndex('ĐỢI GỬI HÀNG'), 1);
  assert.equal(getOrderStatusStepIndex('ĐANG GIAO'), 2);
  assert.equal(getOrderStatusStepIndex('ĐÃ GỬI THÀNH CÔNG'), 3);
});

test('Admin password gate (pass: chillguy) and 3 Google accounts unified as SHOP TAH', () => {
  assert.equal(verifyAdminPasswordGate('chillguy'), true);
  assert.equal(verifyAdminPasswordGate('  chillguy  '), true);
  assert.equal(verifyAdminPasswordGate('wrongpass'), false);

  assert.equal(isAllowedAdminEmail('dmhtahtth@gmail.com', true), true);
  assert.equal(isAllowedAdminEmail('trananhhuy09032012@gmail.com', true), true);
  assert.equal(isAllowedAdminEmail('nguyendinhtiantinh126@gmail.com', true), true);
  assert.equal(isAllowedAdminEmail('dmhtahtth@gmail.com', false), false);
  assert.equal(isAllowedAdminEmail('stranger@gmail.com', true), false);

  assert.equal(getUnifiedAdminDisplayName('dmhtahtth@gmail.com'), UNIFIED_SHOP_NAME);
  assert.equal(getUnifiedAdminDisplayName('trananhhuy09032012@gmail.com'), UNIFIED_SHOP_NAME);
  assert.equal(getUnifiedAdminDisplayName('nguyendinhtiantinh126@gmail.com'), UNIFIED_SHOP_NAME);
});

test('Media validation allows images and strictly blocks video clips', () => {
  const imgCheck = validateMediaFileMetadata('image/png', 'gan15.png', 150000);
  assert.equal(imgCheck.valid, true);

  const mp4Check = validateMediaFileMetadata('video/mp4', 'solve_clip.mp4', 500000);
  assert.equal(mp4Check.valid, false);

  const movCheck = validateMediaFileMetadata('application/octet-stream', 'unbox.mov', 500000);
  assert.equal(movCheck.valid, false);

  const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
  assert.equal(validateImageDataUrl(validDataUrl).valid, true);

  const videoDataUrl = 'data:video/mp4;base64,AAAAIGZ0eXBpc29t';
  assert.equal(validateImageDataUrl(videoDataUrl).valid, false);
});
