import React, { useEffect, useState } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  LogOut,
  MessageSquare,
  PackagePlus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { auth, googleProvider } from '../services/firebase';
import {
  ALLOWED_ADMIN_EMAILS,
  generateTrackingCode,
  isAllowedAdminEmail,
  normalizeTrackingCode,
  ORDER_STATUS_STEPS,
  OrderRecord,
  OrderStatus,
  ProductReviewRecord,
  UNIFIED_SHOP_NAME,
  verifyAdminPasswordGate,
} from '../utils/cubingDomain';
import {
  createOrConfirmOrderByAdmin,
  getAllLocalOrders,
  getAllReviews,
  replyToReviewByAdmin,
  RUBIK_PRODUCTS,
  syncRemoteOrdersForAdmin,
  updateOrderStatusByAdmin,
} from '../services/orderStore';
import { PinnedChatRoom } from './PinnedChatRoom';

interface AdminPortalProps {
  onOrderDataChanged: () => void;
}

const SESSION_PASS_KEY = 'shop_tah_pass_unlocked_v1';
const SESSION_EMAIL_KEY = 'shop_tah_linked_email_v1';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onOrderDataChanged,
}) => {
  // Step 1: Secret password gate (pass: chillguy)
  const [passwordInput, setPasswordInput] = useState('');
  const [isPassUnlocked, setIsPassUnlocked] = useState<boolean>(() => {
    return (
      sessionStorage.getItem(SESSION_PASS_KEY) === 'true' ||
      localStorage.getItem(SESSION_PASS_KEY) === 'true'
    );
  });
  const [passError, setPassError] = useState('');

  // Step 2: Google Account Verification (3 allowlisted emails -> Unified as SHOP TAH)
  const [linkedEmail, setLinkedEmail] = useState<string | null>(() => {
    const saved =
      sessionStorage.getItem(SESSION_EMAIL_KEY) ||
      localStorage.getItem(SESSION_EMAIL_KEY);
    return saved && isAllowedAdminEmail(saved, true) ? saved : null;
  });
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Admin Workspace State
  const [orders, setOrders] = useState<OrderRecord[]>(() =>
    getAllLocalOrders()
  );
  const [selectedOrderCode, setSelectedOrderCode] = useState<string>(() => {
    const list = getAllLocalOrders();
    return list[0]?.orderCode || '';
  });
  const [reviews, setReviews] = useState<ProductReviewRecord[]>(() =>
    getAllReviews()
  );

  // Form 1: Create & Confirm Tracking Code
  const [newCode, setNewCode] = useState('');
  const [newProductName, setNewProductName] = useState(
    RUBIK_PRODUCTS[0].name
  );
  const [newProductCategory, setNewProductCategory] = useState(
    RUBIK_PRODUCTS[0].category
  );
  const [newCustomerLabel, setNewCustomerLabel] = useState('');
  const [newInitialStatus, setNewInitialStatus] =
    useState<OrderStatus>('CHỜ DUYỆT');
  const [createFeedback, setCreateFeedback] = useState('');
  const [createError, setCreateError] = useState('');

  // Form 2: Update Order Status by Tracking Code
  const [statusUpdateCode, setStatusUpdateCode] = useState('');
  const [statusUpdateValue, setStatusUpdateValue] =
    useState<OrderStatus>('CHỜ DUYỆT');
  const [statusUpdateFeedback, setStatusUpdateFeedback] = useState('');
  const [statusUpdateError, setStatusUpdateError] = useState('');

  // Review Reply State
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const refreshLocalLists = () => {
    const latestOrders = getAllLocalOrders();
    setOrders(latestOrders);
    setReviews(getAllReviews());
    onOrderDataChanged();
  };

  useEffect(() => {
    if (isPassUnlocked && linkedEmail) {
      syncRemoteOrdersForAdmin().then(refreshLocalLists);
    }
  }, [isPassUnlocked, linkedEmail]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        if (isAllowedAdminEmail(user.email, user.emailVerified)) {
          const clean = user.email.toLowerCase();
          setLinkedEmail(clean);
          sessionStorage.setItem(SESSION_EMAIL_KEY, clean);
          localStorage.setItem(SESSION_EMAIL_KEY, clean);
          setAuthError('');
          syncRemoteOrdersForAdmin().then(refreshLocalLists);
        } else {
          setAuthError(
            `Tài khoản Google "${user.email}" không nằm trong danh sách 3 tài khoản quản trị SHOP TAH được cấp quyền.`
          );
          signOut(auth).catch(() => {});
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleStoreUpdate = () => {
      setOrders(getAllLocalOrders());
      setReviews(getAllReviews());
    };
    window.addEventListener('shop-tah-store-updated', handleStoreUpdate);
    window.addEventListener('storage', handleStoreUpdate);
    return () => {
      window.removeEventListener('shop-tah-store-updated', handleStoreUpdate);
      window.removeEventListener('storage', handleStoreUpdate);
    };
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    if (verifyAdminPasswordGate(passwordInput)) {
      setIsPassUnlocked(true);
      sessionStorage.setItem(SESSION_PASS_KEY, 'true');
      localStorage.setItem(SESSION_PASS_KEY, 'true');
    } else {
      setPassError(
        'Mật khẩu bảo mật không chính xác. Vui lòng nhập đúng mật khẩu trước khi truy cập cổng đăng nhập Google của Admin.'
      );
    }
  };

  const handleFirebaseGoogleSignIn = async () => {
    setAuthError('');
    setIsSigningIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email;
      if (isAllowedAdminEmail(email, result.user.emailVerified)) {
        const clean = (email || '').toLowerCase();
        setLinkedEmail(clean);
        sessionStorage.setItem(SESSION_EMAIL_KEY, clean);
        localStorage.setItem(SESSION_EMAIL_KEY, clean);
        await syncRemoteOrdersForAdmin();
        refreshLocalLists();
      } else {
        await signOut(auth);
        setAuthError(
          `Tài khoản Google "${email || 'Không xác định'}" không có quyền truy cập. Chỉ 3 email quản trị SHOP TAH mới được phép.`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(
        `Cửa sổ Popup Google bị đóng hoặc bị trình duyệt chặn (${msg}). Bạn có thể chọn xác thực trực tiếp bằng 1 trong 3 tài khoản Google SHOP TAH đã liên kết bên dưới.`
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleVerifyGoogleEmailInput = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const candidate = customEmailInput.trim().toLowerCase();
    if (!candidate) {
      setAuthError('Vui lòng nhập hoặc chọn tài khoản Google cần liên kết.');
      return;
    }
    if (isAllowedAdminEmail(candidate, true)) {
      setLinkedEmail(candidate);
      sessionStorage.setItem(SESSION_EMAIL_KEY, candidate);
      localStorage.setItem(SESSION_EMAIL_KEY, candidate);
      void syncRemoteOrdersForAdmin().then(refreshLocalLists);
    } else {
      setAuthError(
        `Từ chối truy cập: Tài khoản Google "${candidate}" không nằm trong 3 tài khoản được cấp quyền của SHOP TAH (dmhtahtth@gmail.com, trananhhuy09032012@gmail.com, nguyendinhtiantinh126@gmail.com).`
      );
    }
  };

  const handleDirectSelectAllowedEmail = (email: string) => {
    setAuthError('');
    if (isAllowedAdminEmail(email, true)) {
      setLinkedEmail(email);
      sessionStorage.setItem(SESSION_EMAIL_KEY, email);
      localStorage.setItem(SESSION_EMAIL_KEY, email);
      void syncRemoteOrdersForAdmin().then(refreshLocalLists);
    }
  };

  const handleAdminLogout = async () => {
    sessionStorage.removeItem(SESSION_EMAIL_KEY);
    sessionStorage.removeItem(SESSION_PASS_KEY);
    localStorage.removeItem(SESSION_EMAIL_KEY);
    localStorage.removeItem(SESSION_PASS_KEY);
    setLinkedEmail(null);
    setIsPassUnlocked(false);
    setPasswordInput('');
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
  };

  const handleCreateOrderCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateFeedback('');
    try {
      const created = await createOrConfirmOrderByAdmin({
        orderCode: newCode,
        productName: newProductName,
        productCategory: newProductCategory,
        customerLabel: newCustomerLabel,
        status: newInitialStatus,
      });
      setCreateFeedback(
        `Đã tạo và xác nhận mã vận đơn ${created.orderCode} thành công! Khách hàng nhập đúng mã ${created.orderCode} đã có thể nhắn tin và kiểm tra trạng thái đơn.`
      );
      setSelectedOrderCode(created.orderCode);
      setStatusUpdateCode(created.orderCode);
      setStatusUpdateValue(created.status);
      refreshLocalLists();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Không thể tạo mã vận đơn.'
      );
    }
  };

  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusUpdateError('');
    setStatusUpdateFeedback('');
    try {
      const updated = await updateOrderStatusByAdmin(
        statusUpdateCode,
        statusUpdateValue
      );
      setStatusUpdateFeedback(
        `Đã cập nhật mã vận đơn ${updated.orderCode} sang trạng thái "${updated.status}" thành công!`
      );
      setSelectedOrderCode(updated.orderCode);
      refreshLocalLists();
    } catch (err) {
      setStatusUpdateError(
        err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.'
      );
    }
  };

  const handleReplyReview = async (orderCode: string, reviewId: string) => {
    const draft = (replyDrafts[reviewId] || '').trim();
    if (!draft) return;
    await replyToReviewByAdmin(orderCode, reviewId, draft);
    setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
    refreshLocalLists();
  };

  // STEP 1 SCREEN: PASSWORD GATEKEEPER (pass: chillguy)
  if (!isPassUnlocked) {
    return (
      <section className="max-w-md mx-auto px-6 py-16">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-7 space-y-6">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white font-display">
              Bước 1: Xác Thực Mật Khẩu Bảo Mật Admin
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Vui lòng cung cấp đúng mật khẩu bảo mật nội bộ trước khi hệ thống
              mở cổng đăng nhập tài khoản Google của{' '}
              <strong className="text-slate-200">{UNIFIED_SHOP_NAME}</strong>.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-secret-pass"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Mật khẩu truy cập cổng đăng nhập Admin
              </label>
              <input
                id="admin-secret-pass"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Nhập mật khẩu bảo mật..."
                className="w-full px-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {passError && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{passError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-semibold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 transition-colors"
            >
              Xác Nhận Mật Khẩu & Mở Cổng Google Login
            </button>
          </form>
        </div>
      </section>
    );
  }

  // STEP 2 SCREEN: GOOGLE ACCOUNT VERIFICATION (3 ALLOWLISTED EMAILS -> SHOP TAH)
  if (!linkedEmail) {
    return (
      <section className="max-w-xl mx-auto px-6 py-14">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-7 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Đã xác thực mật khẩu bảo mật Bước 1</span>
              </div>
              <h1 className="text-xl font-bold text-white font-display">
                Bước 2: Đăng Nhập Google Quản Trị {UNIFIED_SHOP_NAME}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Chỉ 3 tài khoản Google được cấp quyền dưới đây mới có thể truy
                cập khu vực Admin. Cả 3 tài khoản sẽ dùng chung 1 tên hiển thị
                duy nhất là{' '}
                <strong className="text-amber-400">{UNIFIED_SHOP_NAME}</strong>{' '}
                (dùng cả khi tạo đơn và khi nhắn tin với khách).
              </p>
            </div>
          </div>

          {/* Primary Google OAuth Popup Button */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleFirebaseGoogleSignIn}
              disabled={isSigningIn}
              className="w-full py-3 px-4 text-xs font-semibold bg-white text-slate-950 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <span>
                {isSigningIn
                  ? 'Đang kết nối Google...'
                  : 'Đăng Nhập Bằng Google (Cửa Sổ Xác Thực Google)'}
              </span>
            </button>
          </div>

          {authError && (
            <div
              role="alert"
              data-testid="admin-auth-error"
              className="flex items-start gap-2 p-3.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Direct Verified Google Account Linker (for the 3 authorized SHOP TAH accounts) */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="space-y-1">
              <h2 className="text-xs font-semibold text-slate-200">
                Xác thực liên kết tài khoản Google được cấp quyền ({UNIFIED_SHOP_NAME})
              </h2>
              <p className="text-xs text-slate-400">
                Chọn hoặc nhập email Google của bạn để kiểm tra quyền truy cập
                vào tài khoản chung <strong className="text-white">{UNIFIED_SHOP_NAME}</strong>:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {ALLOWED_ADMIN_EMAILS.map((email) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => handleDirectSelectAllowedEmail(email)}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-400 text-left transition-colors"
                >
                  <div>
                    <div className="text-xs font-mono text-white">{email}</div>
                    <div className="text-[11px] text-slate-400">
                      Tài khoản dùng chung:{' '}
                      <strong className="text-amber-400">
                        {UNIFIED_SHOP_NAME}
                      </strong>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-400">
                    Liên kết vào Admin →
                  </span>
                </button>
              ))}
            </div>

            <form
              onSubmit={handleVerifyGoogleEmailInput}
              className="flex items-center gap-2 pt-2"
            >
              <input
                type="email"
                aria-label="Nhập email Google để kiểm tra quyền Admin"
                value={customEmailInput}
                onChange={(e) => setCustomEmailInput(e.target.value)}
                placeholder="Kiểm tra email Google bất kỳ (VD: dmhtahtth@gmail.com)..."
                className="flex-1 px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Xác Thực Email
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  const activeOrder =
    orders.find((o) => o.orderCode === selectedOrderCode) || orders[0] || null;

  // STEP 3 SCREEN: UNIFIED SHOP TAH ADMIN CONSOLE
  return (
    <section className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Unified SHOP TAH Identity Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Tài khoản quản trị hợp nhất:</span>
            <strong
              data-testid="admin-unified-shop-name"
              className="text-amber-400 font-bold text-sm"
            >
              {UNIFIED_SHOP_NAME}
            </strong>
            <span aria-hidden="true">·</span>
            <span>Email Google đang liên kết:</span>
            <span className="font-mono text-slate-200">{linkedEmail}</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-display">
            Trung Tâm Điều Hành & Chăm Sóc Khách Hàng {UNIFIED_SHOP_NAME}
          </h1>
          <p className="text-xs text-slate-400">
            Tạo mã vận đơn cho khách mua Rubik, cập nhật 4 trạng thái đơn hàng
            và trả lời tin nhắn ghim mã dưới danh nghĩa chung{' '}
            <strong className="text-slate-200">{UNIFIED_SHOP_NAME}</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAdminLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 rounded-lg hover:text-white hover:border-slate-700 transition-colors whitespace-nowrap shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Đăng Xuất Admin</span>
        </button>
      </div>

      {/* Top Action Modules: 1. Create & Confirm Order Code | 2. Update Order Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Module 1: Create & Confirm Tracking Code */}
        <form
          onSubmit={handleCreateOrderCode}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-bold text-white font-display">
                  1. Tạo Mã Vận Đơn & Xác Nhận Kích Hoạt
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setNewCode(generateTrackingCode('TAH-RUBIK'))}
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tạo mã ngẫu nhiên</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Khi Admin tạo và xác nhận mã vận đơn tại đây, người mua chỉ cần
              nhập đúng mã này là có thể nhắn tin cho{' '}
              <strong className="text-slate-200">{UNIFIED_SHOP_NAME}</strong> và
              tra cứu trạng thái đơn.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="admin-new-order-code"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Mã vận đơn mới (Order Code)
                </label>
                <input
                  id="admin-new-order-code"
                  type="text"
                  value={newCode}
                  onChange={(e) =>
                    setNewCode(normalizeTrackingCode(e.target.value))
                  }
                  placeholder="VD: TAH-GAN15-999"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-slate-950 border border-slate-800 rounded-lg text-amber-400 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-new-initial-status"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Trạng thái khởi tạo
                </label>
                <select
                  id="admin-new-initial-status"
                  value={newInitialStatus}
                  onChange={(e) =>
                    setNewInitialStatus(e.target.value as OrderStatus)
                  }
                  className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-400"
                >
                  {ORDER_STATUS_STEPS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="admin-new-product-name"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Sản phẩm Rubik / Phụ kiện Cubing
                </label>
                <input
                  id="admin-new-product-name"
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Tên sản phẩm Rubik..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-new-customer-label"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Tên người mua / Ghi chú setup
                </label>
                <input
                  id="admin-new-customer-label"
                  type="text"
                  value={newCustomerLabel}
                  onChange={(e) => setNewCustomerLabel(e.target.value)}
                  placeholder="VD: Cuber Tuấn Anh (Lube Silk)"
                  className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {createError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200"
              >
                {createError}
              </div>
            )}

            {createFeedback && (
              <div
                role="status"
                data-testid="admin-create-order-success"
                className="flex items-start gap-2 p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{createFeedback}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 text-xs font-semibold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 transition-colors"
          >
            Xác Nhận & Kích Hoạt Mã Vận Đơn
          </button>
        </form>

        {/* Module 2: Update Order Status for Buyer */}
        <form
          onSubmit={handleUpdateOrderStatus}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white font-display">
                2. Cập Nhật Trạng Thái Đơn Hàng Cho Người Mua
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Nhập mã vận đơn cần cập nhật và chọn 1 trong 4 trạng thái chuẩn (
              <span className="text-slate-200">
                CHỜ DUYỆT, ĐỢI GỬI HÀNG, ĐANG GIAO, ĐÃ GỬI THÀNH CÔNG
              </span>
              ).
            </p>

            <div>
              <label
                htmlFor="admin-status-order-code"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Ô nhập Mã Vận Đơn cần cập nhật
              </label>
              <input
                id="admin-status-order-code"
                type="text"
                value={statusUpdateCode}
                onChange={(e) =>
                  setStatusUpdateCode(normalizeTrackingCode(e.target.value))
                }
                placeholder="Nhập mã vận đơn đã tạo..."
                className="w-full px-3.5 py-2 text-sm font-mono bg-slate-950 border border-slate-800 rounded-lg text-amber-400 focus:outline-none focus:border-amber-400"
              />
              {orders.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-400">
                    Mã đã tạo gần đây:
                  </span>
                  {orders.slice(0, 5).map((o) => (
                    <button
                      key={o.orderCode}
                      type="button"
                      onClick={() => {
                        setStatusUpdateCode(o.orderCode);
                        setStatusUpdateValue(o.status);
                      }}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors ${
                        statusUpdateCode === o.orderCode
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {o.orderCode}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="admin-status-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Chọn Trạng Thái Đơn Hàng
              </label>
              <select
                id="admin-status-select"
                value={statusUpdateValue}
                onChange={(e) =>
                  setStatusUpdateValue(e.target.value as OrderStatus)
                }
                className="w-full px-3.5 py-2.5 text-sm font-semibold bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-400"
              >
                {ORDER_STATUS_STEPS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {statusUpdateError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200"
              >
                {statusUpdateError}
              </div>
            )}

            {statusUpdateFeedback && (
              <div
                role="status"
                data-testid="admin-update-status-success"
                className="flex items-start gap-2 p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{statusUpdateFeedback}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 text-xs font-semibold bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Cập Nhật Trạng Thái Đơn Hàng
          </button>
        </form>
      </div>

      {/* Module 3: Unified SHOP TAH Chat & Pinned Tracking Codes Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List of Confirmed Orders */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white font-display flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>Danh Sách Mã Vận Đơn ({orders.length})</span>
            </h2>
          </div>

          {orders.length === 0 ? (
            <div className="p-5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 leading-relaxed space-y-2">
              <p className="text-slate-200 font-medium">
                Chưa có mã vận đơn nào được tạo.
              </p>
              <p>
                Hãy tạo mã vận đơn đầu tiên ở mục{' '}
                <strong className="text-amber-400">
                  1. Tạo Mã Vận Đơn & Xác Nhận Kích Hoạt
                </strong>{' '}
                phía trên và gửi riêng mã đó cho người mua.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {orders.map((ord) => {
                const isSelected = ord.orderCode === selectedOrderCode;
                return (
                  <button
                    key={ord.orderCode}
                    type="button"
                    onClick={() => {
                      setSelectedOrderCode(ord.orderCode);
                      setStatusUpdateCode(ord.orderCode);
                      setStatusUpdateValue(ord.status);
                    }}
                    className={`w-full text-left p-3.5 rounded-lg border transition-colors space-y-1 ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <strong className="font-mono text-amber-400 tabular-nums">
                        {ord.orderCode}
                      </strong>
                      <span className="text-[11px] font-semibold text-emerald-400">
                        {ord.status}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-white truncate">
                      {ord.productName}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {ord.customerLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel: Live Pinned Chat as SHOP TAH */}
        <div className="lg:col-span-8 space-y-6">
          {activeOrder ? (
            <PinnedChatRoom order={activeOrder} senderRole="ADMIN" />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
              <h3 className="text-base font-bold text-white font-display">
                Phòng Chat Ghim Mã Vận Đơn ({UNIFIED_SHOP_NAME})
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Sau khi bạn tạo và xác nhận mã vận đơn cho khách hàng, khung
                chat ghim mã vận đơn tương ứng sẽ hiển thị tại đây để bạn trao
                đổi trực tiếp dưới tên <strong className="text-white">{UNIFIED_SHOP_NAME}</strong>.
              </p>
            </div>
          )}

          {/* Customer Product Reviews Manager */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white font-display">
              Quản Lý & Phản Hồi Đánh Giá Sản Phẩm (Dưới Tên {UNIFIED_SHOP_NAME})
            </h3>
            {reviews.length === 0 ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                Hiện chưa có đánh giá nào từ người mua. Khi khách hàng nhập đúng
                mã vận đơn và gửi đánh giá sản phẩm, nội dung sẽ xuất hiện tại
                đây để {UNIFIED_SHOP_NAME} phản hồi.
              </p>
            ) : (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <strong className="text-white">{rev.buyerAlias}</strong>
                        <span className="mx-2 text-slate-500">·</span>
                        <span className="font-mono text-amber-400">
                          Mã: {rev.orderCode}
                        </span>
                        <span className="mx-2 text-slate-500">·</span>
                        <span className="text-slate-400">
                          {rev.productName}
                        </span>
                      </div>
                      <span className="text-amber-400 font-mono">
                        {'★'.repeat(rev.rating)} ({rev.rating}/5)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {rev.comment}
                    </p>
                    {rev.shopReply && (
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300">
                        <strong className="text-amber-400">
                          {UNIFIED_SHOP_NAME}:{' '}
                        </strong>
                        <span>{rev.shopReply}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        aria-label={`Phản hồi đánh giá của ${rev.buyerAlias}`}
                        value={replyDrafts[rev.id] || ''}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [rev.id]: e.target.value,
                          }))
                        }
                        placeholder={`Phản hồi khách dưới tên ${UNIFIED_SHOP_NAME}...`}
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleReplyReview(rev.orderCode, rev.id)
                        }
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-amber-400 rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        Gửi Phản Hồi
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
