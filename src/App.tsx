import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Box,
  Lock,
  MessageSquare,
  PackageSearch,
  Pin,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ActivePortalSection, TopBar } from './components/TopBar';
import { OrderStatusTracker } from './components/OrderStatusTracker';
import { PinnedChatRoom } from './components/PinnedChatRoom';
import { AdminPortal } from './components/AdminPortal';
import {
  maskTrackingCodeForPublic,
  normalizeTrackingCode,
  OrderRecord,
  ProductReviewRecord,
  UNIFIED_SHOP_NAME,
} from './utils/cubingDomain';
import {
  getAllLocalOrders,
  getAllReviews,
  getReviewsForOrder,
  HERO_IMAGE_URL,
  lookupConfirmedOrderByCode,
  RUBIK_PRODUCTS,
} from './services/orderStore';

export default function App() {
  const [activeSection, setActiveSection] =
    useState<ActivePortalSection>('home');
  const [trackingCodeInput, setTrackingCodeInput] = useState<string>('');
  const [selectedActionMode, setSelectedActionMode] = useState<
    'chat' | 'status'
  >('chat');
  const [lookupError, setLookupError] = useState<string>('');
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  const [verifiedOrder, setVerifiedOrder] = useState<OrderRecord | null>(null);
  const [allReviews, setAllReviews] = useState<ProductReviewRecord[]>(() =>
    getAllReviews()
  );
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>(
    {}
  );

  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const refreshData = () => {
    const latestOrders = getAllLocalOrders();
    setAllReviews(getAllReviews());
    if (verifiedOrder) {
      const updated = latestOrders.find(
        (o) => o.orderCode === verifiedOrder.orderCode
      );
      if (updated) {
        setVerifiedOrder(updated);
      }
    }
  };

  useEffect(() => {
    const handleSync = () => refreshData();
    window.addEventListener('shop-tah-store-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('shop-tah-store-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [verifiedOrder]);

  const handleLookupCode = async (
    rawCode: string,
    targetMode: 'chat' | 'status'
  ) => {
    setLookupError('');
    const normalized = normalizeTrackingCode(rawCode);
    if (!normalized) {
      setLookupError(
        'Vui lòng tự nhập mã vận đơn mà người bán (SHOP TAH) đã gửi riêng cho bạn.'
      );
      return;
    }

    setIsLookingUp(true);
    try {
      const found = await lookupConfirmedOrderByCode(normalized);
      if (!found) {
        setLookupError(
          `Mã vận đơn "${normalized}" không đúng hoặc chưa được ${UNIFIED_SHOP_NAME} tạo và xác nhận trên hệ thống. Vui lòng kiểm tra lại mã người bán đã gửi cho bạn.`
        );
        return;
      }
      setVerifiedOrder(found);
      setTrackingCodeInput(found.orderCode);
      setActiveSection(targetMode);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleLookupCode(trackingCodeInput, selectedActionMode);
  };

  const focusTrackingCodeInput = (mode: 'chat' | 'status') => {
    setSelectedActionMode(mode);
    setLookupError('');
    if (activeSection !== 'home') {
      setActiveSection('home');
      setTimeout(() => {
        document
          .getElementById('lookup-panel')
          ?.scrollIntoView({ behavior: 'smooth' });
        codeInputRef.current?.focus();
      }, 60);
    } else {
      document
        .getElementById('lookup-panel')
        ?.scrollIntoView({ behavior: 'smooth' });
      codeInputRef.current?.focus();
    }
  };

  const handleScrollToSection = (sectionId: string) => {
    if (activeSection !== 'home') {
      setActiveSection('home');
      setTimeout(() => {
        document
          .getElementById(sectionId)
          ?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <ErrorBoundary>
      <div
        id="top"
        className="min-h-screen bg-slate-950 text-slate-100 flex flex-col"
      >
        <TopBar
          activeSection={activeSection}
          onNavigateHome={() => setActiveSection('home')}
          onScrollToSection={handleScrollToSection}
          onOpenAdmin={() => {
            setActiveSection('admin');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        <main className="flex-1">
          {activeSection === 'admin' && (
            <AdminPortal onOrderDataChanged={refreshData} />
          )}

          {activeSection === 'status' && verifiedOrder && (
            <OrderStatusTracker
              order={verifiedOrder}
              reviews={getReviewsForOrder(verifiedOrder.orderCode)}
              onOpenChat={() => setActiveSection('chat')}
              onBackHome={() => setActiveSection('home')}
              onReviewSubmitted={refreshData}
            />
          )}

          {activeSection === 'chat' && verifiedOrder && (
            <section className="max-w-5xl mx-auto px-6 py-8 space-y-6">
              <PinnedChatRoom
                order={verifiedOrder}
                senderRole="BUYER"
                onViewOrderStatus={() => setActiveSection('status')}
                onBackHome={() => setActiveSection('home')}
              />
            </section>
          )}

          {activeSection === 'home' && (
            <div className="space-y-16 pb-16">
              {/* Section 1: Storefront Hero & Confidential Tracking Code Portal */}
              <section
                id="lookup-panel"
                className="max-w-7xl mx-auto px-6 pt-10"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                  {/* Left Column: Private Tracking Code Input & Dual-Action Selector */}
                  <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-7 md:p-9 flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      <div className="text-xs font-medium text-amber-400">
                        <span>Chuyên Gia Rubik & Speedcubing Việt Nam</span>
                        <span className="mx-2" aria-hidden="true">
                          ·
                        </span>
                        <span>Không Cần Đăng Nhập Tài Khoản</span>
                      </div>

                      <h1
                        className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-white font-display leading-tight tracking-tight"
                        style={{ textWrap: 'balance' }}
                      >
                        Đánh Giá Sản Phẩm, Tra Cứu Vận Đơn & Nhắn Trực Tiếp Với{' '}
                        <span className="text-amber-400">
                          {UNIFIED_SHOP_NAME}
                        </span>
                      </h1>

                      <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                        Chỉ cần điền đúng{' '}
                        <strong className="text-white">Mã vận đơn</strong> mà
                        người bán đã gửi riêng cho bạn. Hệ thống tự động ghim mã
                        vận đơn lên thanh chat, lưu giữ toàn bộ tin nhắn cũ kể
                        cả khi bạn chuyển sang máy khác, và cập nhật tiến độ
                        giao hàng theo thời gian thực.
                      </p>
                    </div>

                    {/* Confidential Tracking Code Form (Zero public codes exposed) */}
                    <form
                      onSubmit={handleFormSubmit}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor="buyer-tracking-code-input"
                          className="text-xs font-semibold text-slate-200"
                        >
                          Nhập Mã Vận Đơn Người Bán Gửi Bạn
                        </label>

                        {/* Interactive Segmented Action Selector */}
                        <div
                          role="group"
                          aria-label="Chọn chức năng tra cứu"
                          className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedActionMode('chat')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              selectedActionMode === 'chat'
                                ? 'bg-amber-400 text-slate-950'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            Nhắn Cho Người Bán
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedActionMode('status')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              selectedActionMode === 'status'
                                ? 'bg-amber-400 text-slate-950'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            Xem Tình Trạng Đơn Hàng
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <input
                          ref={codeInputRef}
                          id="buyer-tracking-code-input"
                          type="text"
                          value={trackingCodeInput}
                          onChange={(e) =>
                            setTrackingCodeInput(
                              normalizeTrackingCode(e.target.value)
                            )
                          }
                          placeholder="Tự nhập mã vận đơn do SHOP TAH cung cấp..."
                          className="flex-1 px-4 py-3 text-sm font-mono bg-slate-900 border border-slate-700 rounded-lg text-amber-400 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                        />

                        <button
                          type="submit"
                          disabled={isLookingUp}
                          className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          {selectedActionMode === 'chat' ? (
                            <>
                              <MessageSquare className="w-4 h-4" />
                              <span>Vào Phòng Chat & Ghim Mã</span>
                            </>
                          ) : (
                            <>
                              <PackageSearch className="w-4 h-4" />
                              <span>Kiểm Tra Tình Trạng Đơn</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            Mã vận đơn được bảo mật tuyệt đối và không công khai
                            trên trang web.
                          </span>
                        </div>

                        {trackingCodeInput.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleLookupCode(
                                trackingCodeInput,
                                selectedActionMode === 'chat'
                                  ? 'status'
                                  : 'chat'
                              )
                            }
                            className="text-xs font-medium text-amber-400 hover:underline whitespace-nowrap shrink-0"
                          >
                            {selectedActionMode === 'chat'
                              ? 'Hoặc xem tình trạng đơn hàng của mã này →'
                              : 'Hoặc nhắn trực tiếp cho SHOP TAH với mã này →'}
                          </button>
                        )}
                      </div>

                      {lookupError && (
                        <div
                          role="alert"
                          data-testid="lookup-error-alert"
                          className="flex items-start gap-2 p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200"
                        >
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>{lookupError}</span>
                        </div>
                      )}
                    </form>
                  </div>

                  {/* Right Column: Studio Rubik Hardware Showcase Card */}
                  <div className="lg:col-span-5 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 min-h-[340px] flex flex-col justify-end">
                    {!imageErrorMap['hero'] ? (
                      <img
                        src={HERO_IMAGE_URL}
                        alt="Rubik Flagship MagLev 3x3 và đồng hồ bấm giờ Speedcubing tại SHOP TAH"
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setImageErrorMap((prev) => ({ ...prev, hero: true }))
                        }
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/30 flex items-center justify-center">
                        <Box className="w-16 h-16 text-amber-400/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent" />

                    <div className="relative z-10 p-6 space-y-2">
                      <div className="text-xs font-mono text-amber-400">
                        MOYU WEILONG BALL-CORE · MAGLEV DUAL-ADJUSTMENT
                      </div>
                      <h2 className="text-xl font-bold text-white font-display">
                        Bảo Hành Căn Chỉnh Lực Từ & Lube Theo Mã Vận Đơn
                      </h2>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Mỗi khối Rubik xuất kho từ {UNIFIED_SHOP_NAME} đều đi
                        kèm mã vận đơn riêng biệt giúp bạn gửi ảnh kiểm tra trục
                        lõi Ball-Core, hỏi đáp cách căn chỉnh ốc MagLev và theo
                        dõi hành trình đơn hàng.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Full-Width 4-Column Feature Guarantee Strip Below Hero Split */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                      <Pin className="w-3.5 h-3.5" />
                      <span>Tự Động Ghim Mã Vận Đơn</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Khi nhập đúng mã, hệ thống ghim ngay mã vận đơn lên đầu
                      thanh chat để SHOP TAH nắm rõ đơn hàng.
                    </p>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Giờ Làm Việc Hỗ Trợ Chat</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Tối 6h - 8h (T2 - T6) , 8h (sáng) - 22h (tối) (Cuối tuần).
                      Lưu toàn bộ tin nhắn cũ khi đổi máy.
                    </p>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>1 Mã Vận Đơn · 1 Lần Nhận Xét</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Mỗi mã vận đơn chỉ được gửi 1 lần nhận xét kèm hình ảnh
                      thực tế (tự động từ chối tệp video/clip).
                    </p>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                      <PackageSearch className="w-3.5 h-3.5" />
                      <span>4 Trạng Thái Minh Bạch</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Theo dõi trực tiếp: CHỜ DUYỆT · ĐỢI GỬI HÀNG · ĐANG GIAO ·
                      ĐÃ GỬI THÀNH CÔNG.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 2: Featured Rubik & Speedcubing Hardware Lineup (User's Real Photos) */}
              <section
                id="rubik-lineup"
                className="max-w-7xl mx-auto px-6 space-y-6"
              >
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <p className="text-xs text-amber-400 font-medium">
                      Hình Ảnh Sản Phẩm Thực Tế Tại Shop
                    </p>
                    <h2 className="text-2xl font-bold text-white font-display mt-1">
                      Dòng Sản Phẩm Rubik Được Setup Tại {UNIFIED_SHOP_NAME}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    Khi mua hàng, {UNIFIED_SHOP_NAME} sẽ cấp riêng mã vận đơn để
                    bạn tra cứu và nhắn tin bảo hành
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {RUBIK_PRODUCTS.map((item) => (
                    <article
                      key={item.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between hover:-translate-y-0.5 transition-transform"
                    >
                      <div>
                        <div className="aspect-[4/3] bg-slate-950 relative overflow-hidden border-b border-slate-800">
                          {!imageErrorMap[item.id] ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setImageErrorMap((prev) => ({
                                  ...prev,
                                  [item.id]: true,
                                }))
                              }
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
                              <Box className="w-10 h-10" />
                            </div>
                          )}
                        </div>

                        <div className="p-5 space-y-2">
                          <div className="text-xs text-slate-400 uppercase tracking-wider">
                            <span>{item.category}</span>
                            <span className="mx-1.5" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-amber-400">
                              Chính hãng {UNIFIED_SHOP_NAME}
                            </span>
                          </div>

                          <h3 className="text-base font-semibold text-white font-display leading-snug">
                            {item.name}
                          </h3>

                          <p className="text-xs text-slate-400 leading-relaxed">
                            {item.specs}
                          </p>
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-3 border-t border-slate-800/70 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-xs text-slate-400">
                            Giá niêm yết
                          </span>
                          <strong className="font-mono text-white tabular-nums">
                            {item.priceVnd}
                          </strong>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => focusTrackingCodeInput('chat')}
                            className="px-3 py-2 text-xs font-semibold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
                          >
                            Nhập Mã Nhắn Shop
                          </button>
                          <button
                            type="button"
                            onClick={() => focusTrackingCodeInput('status')}
                            className="px-3 py-2 text-xs font-semibold bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                          >
                            Nhập Mã Check Đơn
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {/* Section 3: Verified Cuber Product Reviews & Feedback (Zero Fake/Sample Reviews) */}
              <section
                id="cuber-reviews"
                className="max-w-7xl mx-auto px-6 space-y-6"
              >
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <p className="text-xs text-amber-400 font-medium">
                      Phản Hồi Thực Tế Từ Người Mua Đã Xác Thực Mã Vận Đơn
                    </p>
                    <h2 className="text-2xl font-bold text-white font-display mt-1">
                      Đánh Giá Chất Lượng Rubik & Dịch Vụ Setup{' '}
                      {UNIFIED_SHOP_NAME}
                    </h2>
                  </div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    Đánh giá thực tế đã ghi nhận: {allReviews.length}
                  </div>
                </div>

                {allReviews.length === 0 ? (
                  <div
                    data-testid="empty-reviews-state"
                    className="bg-slate-900/80 border border-slate-800 rounded-xl p-10 text-center space-y-4"
                  >
                    <div className="space-y-1.5 max-w-xl mx-auto">
                      <h3 className="text-base font-bold text-white font-display">
                        Chưa Có Đánh Giá Nào Được Gửi Lên Hệ Thống
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {UNIFIED_SHOP_NAME} cam kết không sử dụng đánh giá ảo
                        mẫu. Chỉ những khách hàng có mã vận đơn thật do{' '}
                        {UNIFIED_SHOP_NAME} cấp mới có thể gửi đánh giá và hình
                        ảnh thực tế sau khi tra cứu đơn hàng.
                      </p>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => focusTrackingCodeInput('status')}
                        className="px-4 py-2 text-xs font-semibold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 transition-colors"
                      >
                        Nhập Mã Vận Đơn Để Gửi Đánh Giá Đầu Tiên
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {allReviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                            <div>
                              <strong className="text-white text-sm">
                                {rev.buyerAlias}
                              </strong>
                              <span className="mx-2" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono text-amber-400">
                                Mã đơn đã xác thực:{' '}
                                {maskTrackingCodeForPublic(rev.orderCode)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-amber-400 font-mono tabular-nums">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              <span>{rev.rating}.0 / 5.0</span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-400">
                            Sản phẩm:{' '}
                            <span className="text-slate-200 font-medium">
                              {rev.productName}
                            </span>
                          </div>

                          <p className="text-sm text-slate-200 leading-relaxed">
                            “{rev.comment}”
                          </p>

                          {rev.imageUrl && (
                            <img
                              src={rev.imageUrl}
                              alt={`Ảnh đánh giá từ ${rev.buyerAlias}`}
                              referrerPolicy="no-referrer"
                              className="max-h-44 rounded-lg border border-slate-800 object-cover"
                            />
                          )}
                        </div>

                        {rev.shopReply && (
                          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 space-y-1">
                            <div className="font-semibold text-amber-400">
                              Phản hồi chính thức từ {UNIFIED_SHOP_NAME}:
                            </div>
                            <p className="leading-relaxed">{rev.shopReply}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>

        {/* Quiet Editorial Footer */}
        <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-8">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              <strong className="text-white font-display">
                {UNIFIED_SHOP_NAME}
              </strong>
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              <span>
                Hệ Thống Đánh Giá, Phản Hồi & Tra Cứu Vận Đơn Rubik Speedcubing
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="#lookup-panel"
                onClick={(e) => {
                  e.preventDefault();
                  handleScrollToSection('lookup-panel');
                }}
                className="hover:text-white transition-colors"
              >
                Tra Cứu Mã Vận Đơn
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="#admin-portal"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveSection('admin');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors"
              >
                Đăng Nhập Admin ({UNIFIED_SHOP_NAME})
              </a>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
