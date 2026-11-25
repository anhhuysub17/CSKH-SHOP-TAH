import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ImagePlus,
  MessageSquare,
  PackageCheck,
  Star,
  Truck,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import {
  getOrderStatusStepIndex,
  ORDER_STATUS_STEPS,
  OrderRecord,
  OrderStatus,
  ProductReviewRecord,
  validateMediaFileMetadata,
} from '../utils/cubingDomain';
import {
  fileToCompressedImageDataUrl,
  submitProductReviewByCode,
} from '../services/orderStore';

interface OrderStatusTrackerProps {
  order: OrderRecord;
  reviews: ProductReviewRecord[];
  onOpenChat: () => void;
  onBackHome: () => void;
  onReviewSubmitted: () => void;
}

const STEP_DESCRIPTIONS: Record<OrderStatus, string> = {
  'CHỜ DUYỆT':
    'SHOP TAH đã tiếp nhận mã vận đơn và đang kiểm tra cấu hình Rubik / phụ kiện Lube đi kèm.',
  'ĐỢI GỬI HÀNG':
    'Kỹ thuật viên SHOP TAH đã căn chỉnh lực từ MagLev, tra Lube tiêu chuẩn và đóng gói chống sốc.',
  'ĐANG GIAO':
    'Kiện hàng Rubik đã bàn giao cho đơn vị vận chuyển và đang trên tuyến phát tới tay bạn.',
  'ĐÃ GỬI THÀNH CÔNG':
    'Đơn hàng đã giao thành công! Bạn có thể để lại đánh giá cảm giác xoay hoặc nhắn tin bảo hành trọn đời.',
};

export const OrderStatusTracker: React.FC<OrderStatusTrackerProps> = ({
  order,
  reviews,
  onOpenChat,
  onBackHome,
  onReviewSubmitted,
}) => {
  const currentStepIndex = getOrderStatusStepIndex(order.status);

  const [buyerAlias, setBuyerAlias] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [submitStatus, setSubmitStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const metaCheck = validateMediaFileMetadata(file.type, file.name, file.size);
    if (!metaCheck.valid) {
      setMediaError(metaCheck.error || 'Tệp không hợp lệ.');
      e.target.value = '';
      return;
    }

    try {
      const compressed = await fileToCompressedImageDataUrl(file);
      setImageUrl(compressed);
    } catch (err) {
      setMediaError(
        err instanceof Error ? err.message : 'Lỗi xử lý tệp hình ảnh.'
      );
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMediaError('');
    setSubmitStatus('');

    if (comment.trim().length < 3) {
      setMediaError('Vui lòng nhập nhận xét chi tiết (ít nhất 3 ký tự).');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitProductReviewByCode({
        orderCode: order.orderCode,
        buyerAlias: buyerAlias.trim() || `Cuber #${order.orderCode.slice(-4)}`,
        rating,
        comment,
        imageUrl,
      });
      setComment('');
      setImageUrl('');
      setSubmitStatus(
        'Đã gửi đánh giá sản phẩm thành công! Đánh giá của bạn đã được gắn với mã vận đơn.'
      );
      onReviewSubmitted();
    } catch (err) {
      setMediaError(
        err instanceof Error ? err.message : 'Không thể gửi đánh giá.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Tra cứu mã vận đơn khác</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-display">
            Tình Trạng Đơn Hàng ·{' '}
            <span className="text-amber-400 font-mono tabular-nums">
              {order.orderCode}
            </span>
          </h1>
          <p className="text-sm text-slate-400">
            <span>{order.productName}</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>{order.productCategory}</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>Đơn vị phụ trách: {order.shopName}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenChat}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Nhắn Cho Người Bán (SHOP TAH)</span>
        </button>
      </div>

      {/* 4-Stage Status Pipeline */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400">
              Trạng thái vận đơn thời gian thực do SHOP TAH cập nhật
            </p>
            <p
              data-testid="active-order-status"
              className="text-xl font-bold text-amber-400 mt-1 font-display"
            >
              {order.status}
            </p>
          </div>
          <div className="text-right text-xs text-slate-400 font-mono tabular-nums">
            <span>Cập nhật lần cuối: </span>
            <span>
              {new Date(order.updatedAt).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {ORDER_STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div
                key={step}
                className={`p-4 rounded-lg border transition-colors ${
                  isCurrent
                    ? 'bg-amber-500/10 border-amber-400 text-white'
                    : isCompleted
                      ? 'bg-slate-950/80 border-emerald-500/40 text-slate-200'
                      : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono tabular-nums">
                    0{index + 1}.
                  </span>
                  {index === 0 && <Clock className="w-4 h-4" />}
                  {index === 1 && <PackageCheck className="w-4 h-4" />}
                  {index === 2 && <Truck className="w-4 h-4" />}
                  {index === 3 && <CheckCircle2 className="w-4 h-4" />}
                </div>
                <h3 className="text-sm font-bold font-display">{step}</h3>
                <p className="text-xs mt-1.5 leading-relaxed opacity-85">
                  {STEP_DESCRIPTIONS[step]}
                </p>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <span>Người nhận / Ghi chú: </span>
            <strong className="text-slate-200">{order.customerLabel}</strong>
          </div>
          <div>
            <span>Mã ghim tự động khi chat: </span>
            <strong className="text-amber-400 font-mono">
              {order.orderCode}
            </strong>
          </div>
        </div>
      </div>

      {/* Product Feedback & Evaluation Section for this Tracking Code (Strictly 1 review per orderCode) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {reviews.length >= 1 ? (
          <div
            data-testid="one-review-per-order-lock"
            className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <h2 className="text-lg font-bold text-white font-display">
                Mã Vận Đơn {order.orderCode} Đã Hoàn Tất 1/1 Lượt Nhận Xét
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Theo quy định của <strong className="text-white">{order.shopName}</strong>, mỗi mã vận đơn chỉ được cho <strong className="text-amber-400">1 lần nhận xét</strong> duy nhất nhằm đảm bảo tính minh bạch. Nhận xét của bạn đã được ghi nhận ở cột bên phải.
            </p>
            {submitStatus && (
              <div
                role="status"
                className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-xs text-emerald-200"
              >
                {submitStatus}
              </div>
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenChat}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Cần hỗ trợ thêm? Nhắn trực tiếp cho {order.shopName}</span>
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleReviewSubmit}
            className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-5"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-white font-display">
                  Đánh Giá & Phản Hồi Sản Phẩm Rubik
                </h2>
                <span className="text-xs font-mono text-amber-400">
                  Giới hạn: 1 lần nhận xét / mã vận đơn
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Đánh giá trực tiếp bằng mã vận đơn{' '}
                <span className="font-mono text-slate-200">
                  {order.orderCode}
                </span>{' '}
                (Mỗi mã vận đơn chỉ được phép gửi nhận xét 1 lần duy nhất). Hỗ
                trợ đính kèm hình ảnh thực tế, không hỗ trợ video/clip.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="review-buyer-alias"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Biệt danh Cuber / Tên hiển thị
                </label>
                <input
                  id="review-buyer-alias"
                  type="text"
                  value={buyerAlias}
                  onChange={(e) => setBuyerAlias(e.target.value)}
                  placeholder="VD: Minh Khôi Sub-10"
                  className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-300 mb-1.5">
                  Chấm điểm cảm giác xoay (1 - 5 Sao)
                </span>
                <div className="flex items-center gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`Chấm ${star} sao`}
                      onClick={() => setRating(star)}
                      className={`p-1.5 rounded-md border transition-colors ${
                        star <= rating
                          ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                          : 'bg-slate-950 border-slate-800 text-slate-600'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-mono text-amber-400 tabular-nums">
                    {rating}/5 Sao
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="review-comment"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Nhận xét chi tiết (Độ cắt góc, lực hút nam châm, lõi Ball-Core,
                đóng gói)
              </label>
              <textarea
                id="review-comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm xoay thực tế của bạn với chiếc Rubik này..."
                className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-950 border border-slate-700 rounded-lg text-slate-200 hover:border-amber-400 cursor-pointer transition-colors">
                  <ImagePlus className="w-4 h-4 text-amber-400" />
                  <span>Đính Kèm Hình Ảnh Thực Tế (Không Hỗ Trợ Video/Clip)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <span className="text-[11px] text-slate-400">
                  Hỗ trợ: JPG, PNG, WEBP, GIF
                </span>
              </div>

              {imageUrl && (
                <div className="flex items-center gap-3 p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <img
                    src={imageUrl}
                    alt="Ảnh đánh giá Rubik"
                    referrerPolicy="no-referrer"
                    className="w-16 h-12 object-cover rounded border border-slate-700"
                  />
                  <div className="flex-1 text-xs text-slate-300">
                    Đã đính kèm hình ảnh hợp lệ (Định dạng Image Base64).
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    Xóa ảnh
                  </button>
                </div>
              )}

              {mediaError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-lg bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{mediaError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-xs font-semibold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? 'Đang lưu đánh giá...'
                : 'Gửi Nhận Xét Duy Nhất Cho Mã Vận Đơn Này'}
            </button>
          </form>
        )}

        {/* Existing Reviews for this Tracking Code */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white font-display">
            Lịch Sử Đánh Giá Của Mã {order.orderCode} ({reviews.length})
          </h3>

          {reviews.length === 0 ? (
            <p className="text-xs text-slate-400 leading-relaxed">
              Chưa có đánh giá nào cho mã vận đơn {order.orderCode}. Hãy là
              người đầu tiên gửi phản hồi về sản phẩm {order.productName}!
            </p>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <strong className="text-white">{rev.buyerAlias}</strong>
                    <span className="text-amber-400 font-mono tabular-nums">
                      {'★'.repeat(rev.rating)} ({rev.rating}/5)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {rev.comment}
                  </p>
                  {rev.imageUrl && (
                    <img
                      src={rev.imageUrl}
                      alt={`Ảnh thực tế từ ${rev.buyerAlias}`}
                      referrerPolicy="no-referrer"
                      className="w-full max-h-40 object-cover rounded-lg border border-slate-800"
                    />
                  )}
                  {rev.shopReply && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                      <div className="font-semibold text-amber-400">
                        Phản hồi từ {order.shopName}:
                      </div>
                      <p className="text-slate-300">{rev.shopReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
