# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Order Tracking Code Invariant (`/orders/{orderCode}`)**:
   - Creating or updating an Order document requires a valid `orderCode` (matching `^[a-zA-Z0-9_\-]+$`, length 3..64), strict `isValidOrder` schema validation, `shopName == 'SHOP TAH'`, and server timestamps (`request.time`), ensuring tracking codes created by SHOP TAH Admin persist permanently in Firestore even if browser popup blockers force direct allowlisted email linking.
   - Buyers do not log in; knowing an exact valid `orderCode` grants single-document `get` access to `/orders/{orderCode}` so the buyer can verify their tracking code and check status (`CHỜ DUYỆT`, `ĐỢI GỬI HÀNG`, `ĐANG GIAO`, `ĐÃ GỬI THÀNH CÔNG`) across any device or browser.
   - Blanket `list` on `/orders` is strictly restricted to verified SHOP TAH Admins (`isAdmin()`).
   - `orderCode` in the document body must strictly match the `{orderCode}` path parameter and is immutable on update.
   - `shopName` must always equal `'SHOP TAH'`.
   - `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on every write.
   - Only verified `isAdmin()` can delete an order.

2. **Pinned Chat Message Invariant (`/orders/{orderCode}/messages/{messageId}`)**:
   - **Master Gate**: A message cannot be created unless the parent `/orders/{orderCode}` document exists and has `confirmed == true`.
   - `incoming().orderCode` must equal the parent `{orderCode}` path parameter.
   - **Identity Gate**: If `senderRole == 'ADMIN'`, `senderName` must strictly equal `'SHOP TAH'`; if `senderRole == 'BUYER'`, `senderName` must not equal `'SHOP TAH'`.
   - **Media Guard (Images Only, No Video Clips)**: `imageUrl` must be either an empty string `""` or a valid `data:image/` URI (never `data:video/` or over 350,000 characters).
   - Messages are immutable once sent (`allow update: if false; allow delete: if isAdmin();`).

3. **Product Review Invariant (`/orders/{orderCode}/reviews/{reviewId}`)**:
   - **Master Gate**: A review cannot be created unless the parent `/orders/{orderCode}` document exists and has `confirmed == true`.
   - `rating` must be an integer between 1 and 5 inclusive (`rating >= 1 && rating <= 5`).
   - On creation by a buyer, `shopReply` must be `""` (buyers cannot spoof an official SHOP TAH reply).
   - Updates to a review are restricted strictly to `isAdmin()` updating `['shopReply', 'updatedAt']` while keeping all buyer review fields immutable.

---

## 2. The "Dirty Dozen" Payloads (Adversarial Test Vectors)

1. **Payload 1 — Unauthenticated Order Creation**: Unauthenticated user attempts to create `/orders/TAH-HACK-01`. -> `PERMISSION_DENIED`
2. **Payload 2 — Unverified Email Admin Spoof**: Authenticated user with `email: 'dmhtahtth@gmail.com'` but `email_verified: false` attempts to create `/orders/TAH-SPOOF-02`. -> `PERMISSION_DENIED`
3. **Payload 3 — Unauthorized Blanket Order Listing**: Unauthenticated buyer attempts a `list` query on `/orders` to scrape all tracking codes. -> `PERMISSION_DENIED`
4. **Payload 4 — Shadow Field Injection on Order**: Verified Admin attempts to create `/orders/TAH-GAN15-01` with an extra undeclared field `isSuperAdmin: true`. -> `PERMISSION_DENIED`
5. **Payload 5 — Invalid Order Status Enumeration**: Verified Admin attempts to update `/orders/TAH-GAN15-01` with `status: 'HỦY ĐƠN TÙY Ý'` outside the 4 allowed statuses (`CHỜ DUYỆT`, `ĐỢI GỬI HÀNG`, `ĐANG GIAO`, `ĐÃ GỬI THÀNH CÔNG`). -> `PERMISSION_DENIED`
6. **Payload 6 — Immortal Field Mutation (`createdAt` / `orderCode`)**: Verified Admin attempts to modify `createdAt` or `orderCode` during an order status update. -> `PERMISSION_DENIED`
7. **Payload 7 — Orphaned Chat Message (Master Gate Bypass)**: Buyer attempts to create a message under `/orders/NON-EXISTENT-CODE/messages/msg1` where parent order does not exist. -> `PERMISSION_DENIED`
8. **Payload 8 — Buyer Spoofing SHOP TAH Admin in Chat**: Unauthenticated buyer sends a chat message with `senderRole: 'ADMIN'` or `senderName: 'SHOP TAH'`. -> `PERMISSION_DENIED`
9. **Payload 9 — Video Clip Injection in Chat Message**: Buyer attempts to upload a video clip (`imageUrl: 'data:video/mp4;base64,AAAA...'`) instead of an allowed image format. -> `PERMISSION_DENIED`
10. **Payload 10 — Denial of Wallet / Oversized Payload**: Buyer attempts to post a message with `text` length > 1000 characters or malformed 200-char ID. -> `PERMISSION_DENIED`
11. **Payload 11 — Out-of-Range Star Rating**: Buyer submits a review under `/orders/TAH-GAN15-889/reviews/rev1` with `rating: 99` or `rating: 0`. -> `PERMISSION_DENIED`
12. **Payload 12 — Buyer Spoofing Official SHOP TAH Reply on Review**: Buyer creates or updates a review setting `shopReply: 'Shop đã tặng miễn phí 100%'`. -> `PERMISSION_DENIED`
