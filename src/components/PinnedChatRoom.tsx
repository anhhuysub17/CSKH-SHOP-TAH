import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ImagePlus,
  Pin,
  Send,
  PackageSearch,
  RefreshCw,
} from 'lucide-react';
import {
  ChatMessageRecord,
  OrderRecord,
  UNIFIED_SHOP_NAME,
  validateMediaFileMetadata,
} from '../utils/cubingDomain';
import {
  fileToCompressedImageDataUrl,
  sendOrderChatMessage,
  subscribeToOrderMessages,
} from '../services/orderStore';

interface PinnedChatRoomProps {
  order: OrderRecord;
  senderRole: 'BUYER' | 'ADMIN';
  onViewOrderStatus?: () => void;
  onBackHome?: () => void;
}

export const PinnedChatRoom: React.FC<PinnedChatRoomProps> = ({
  order,
  senderRole,
  onViewOrderStatus,
  onBackHome,
}) => {
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [text, setText] = useState('');
  const [buyerName, setBuyerName] = useState(`Khách hàng #${order.orderCode}`);
  const [imageUrl, setImageUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSending, setIsSending] = useState(false);

  const listContainerRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBuyerName(`Khách hàng #${order.orderCode}`);
    const unsubscribe = subscribeToOrderMessages(order.orderCode, (list) => {
      setMessages(list);
      setTimeout(() => {
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop =
            listContainerRef.current.scrollHeight;
        }
      }, 20);
    });
    return () => unsubscribe();
  }, [order.orderCode]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    const check = validateMediaFileMetadata(file.type, file.name, file.size);
    if (!check.valid) {
      setErrorMsg(check.error || 'Chỉ hỗ trợ gửi hình ảnh, không hỗ trợ clip.');
      e.target.value = '';
      return;
    }

    try {
      const dataUrl = await fileToCompressedImageDataUrl(file);
      setImageUrl(dataUrl);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể đính kèm hình ảnh.'
      );
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!text.trim() && !imageUrl) {
      setErrorMsg('Vui lòng nhập tin nhắn hoặc đính kèm hình ảnh trước khi gửi.');
      return;
    }

    setIsSending(true);
    try {
      await sendOrderChatMessage({
        orderCode: order.orderCode,
        senderRole,
        senderName:
          senderRole === 'ADMIN' ? UNIFIED_SHOP_NAME : buyerName.trim(),
        text,
        imageUrl,
      });
      setText('');
      setImageUrl('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể gửi tin nhắn.'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Auto-Pinned Tracking Code Top Bar */}
      <div
        data-testid="pinned-tracking-code-banner"
        className="bg-slate-950 border-b border-slate-800 px-5 py-4 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBackHome && (
            <button
              type="button"
              onClick={onBackHome}
              aria-label="Quay lại trang tra cứu"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-400 shrink-0">
            <Pin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-amber-400">
                ĐÃ GHIM MÃ VẬN ĐƠN TRÊN THANH CHAT:
              </span>
              <strong
                data-testid="pinned-order-code-value"
                className="font-mono text-sm text-white tabular-nums"
              >
                {order.orderCode}
              </strong>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-emerald-400 font-medium">
                Trạng thái: {order.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              <span>{order.productName}</span>
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              <span>
                Hỗ trợ bởi:{' '}
                <strong className="text-slate-200">{UNIFIED_SHOP_NAME}</strong>
              </span>
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              <span>Lưu tin nhắn cũ đa thiết bị</span>
            </p>
          </div>
        </div>

        {onViewOrderStatus && (
          <button
            type="button"
            onClick={onViewOrderStatus}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-200 rounded-lg hover:border-amber-400 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <PackageSearch className="w-4 h-4 text-amber-400" />
            <span>Xem Tình Trạng Đơn Hàng</span>
          </button>
        )}
      </div>

      {/* Working Hours Announcement Banner inside Chat Frame */}
      <div
        data-testid="chat-working-hours-notice"
        className="bg-amber-500/10 border-b border-amber-400/30 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200"
      >
        <div>
          <strong className="text-amber-400 font-semibold">
            Thông báo giờ làm việc {UNIFIED_SHOP_NAME}:
          </strong>{' '}
          <span>
            Tối 6h - 8h (T2 - T6) , 8h (sáng) - 22h (tối) (T7 - CN)
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          Tin nhắn ngoài khung giờ sẽ được lưu giữ và phản hồi ngay ca trực kế tiếp
        </span>
      </div>

      {/* Persistent Messages List */}
      <div
        ref={listContainerRef}
        data-testid="chat-messages-list"
        className="p-5 space-y-4 max-h-[460px] min-h-[320px] overflow-y-auto bg-slate-950/50"
      >
        {messages.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">
            Chưa có tin nhắn nào cho mã vận đơn {order.orderCode}. Hãy gửi tin
            nhắn hoặc hình ảnh đầu tiên cho {UNIFIED_SHOP_NAME}!
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderRole === senderRole;
            const isShop = msg.senderRole === 'ADMIN';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  isSelf ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1 px-1">
                  <strong
                    className={
                      isShop ? 'text-amber-400 font-semibold' : 'text-slate-300'
                    }
                  >
                    {isShop ? UNIFIED_SHOP_NAME : msg.senderName}
                  </strong>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Mã ghim: {msg.orderCode}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div
                  className={`max-w-xl rounded-xl px-4 py-3 text-sm space-y-2.5 border ${
                    isShop
                      ? 'bg-amber-500/15 border-amber-400/40 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                >
                  {msg.text && (
                    <p className="leading-relaxed whitespace-pre-wrap break-words">
                      {msg.text}
                    </p>
                  )}
                  {msg.imageUrl && (
                    <div className="pt-1">
                      <img
                        src={msg.imageUrl}
                        alt={`Hình ảnh đính kèm cho mã ${msg.orderCode}`}
                        referrerPolicy="no-referrer"
                        className="max-h-56 rounded-lg border border-slate-700 object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chat Input Form (Supports Images Only, Blocks Video Clips) */}
      <form
        onSubmit={handleSend}
        className="p-4 bg-slate-950 border-t border-slate-800 space-y-3"
      >
        {errorMsg && (
          <div
            role="alert"
            data-testid="chat-media-error"
            className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {imageUrl && (
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <img
              src={imageUrl}
              alt="Ảnh xem trước"
              referrerPolicy="no-referrer"
              className="w-16 h-12 object-cover rounded border border-slate-700"
            />
            <div className="flex-1 text-xs text-slate-300">
              Hình ảnh đã sẵn sàng gửi kèm mã vận đơn{' '}
              <strong className="font-mono text-amber-400">
                {order.orderCode}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="text-xs text-rose-400 hover:underline"
            >
              Gỡ ảnh
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:border-amber-400 cursor-pointer transition-colors">
              <ImagePlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Đính Kèm Hình Ảnh (Không Hỗ Trợ Clip/Video)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
            <span className="text-[11px] text-slate-500">
              Chỉ nhận ảnh JPG, PNG, WEBP, GIF
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <RefreshCw className="w-3 h-3 text-emerald-400" />
            <span>
              Tư cách gửi:{' '}
              <strong className="text-white">
                {senderRole === 'ADMIN' ? UNIFIED_SHOP_NAME : buyerName}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            aria-label="Nội dung tin nhắn"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              senderRole === 'ADMIN'
                ? `Nhập phản hồi dưới tên ${UNIFIED_SHOP_NAME} cho mã ${order.orderCode}...`
                : `Nhắn cho ${UNIFIED_SHOP_NAME} về đơn hàng ${order.orderCode}...`
            }
            className="flex-1 px-4 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={isSending}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-amber-400 text-slate-950 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Gửi Tin Nhắn</span>
          </button>
        </div>
      </form>
    </div>
  );
};
