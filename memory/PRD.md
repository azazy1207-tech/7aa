# RBX SHOP — Roblox Marketplace & Trading Platform

## Original Problem Statement
المستخدم يريد موقع بيع منتجات روبلوكس (ماب Adopt Me, Grow a Garden, Steal a Brainrot) باللغة العربية حيث:
- الأدمن يضيف/يعدل/يحذف المنتجات
- الدفع تحويل بنكي + رفع صورة الإيصال
- تسجيل دخول بـ Google / رقم جوال / كضيف
- قسم تداول بين شخصين مع ٩ مربعات لكل جهة
- بيانات الأدمن: yusefemad1430@gmail.com / Ahmad1207

## Architecture
- **Backend**: FastAPI + MongoDB (motor) — `/app/backend/server.py`
- **Frontend**: React (CRA + craco) + Tailwind, RTL Arabic, Readex Pro + IBM Plex Sans Arabic fonts
- **Auth**: Emergent Google OAuth + guest/phone simple flow + admin JWT
- **Storage**: Base64 images stored in MongoDB (receipts + product photos)

## Core Requirements (static)
1. Product catalog with categories (Adopt Me, Grow a Garden, Steal a Brainrot)
2. Manual bank-transfer checkout with name + receipt image upload
3. Trade section: 9 offering + 9 requesting slots, match between two users
4. Admin panel: products CRUD, orders management, bank info, trades moderation
5. Multi-auth: Google, phone, guest, with admin separate login

## Implemented (Jan 2026)
- ✅ Backend API (19/19 tests passing)
  - Auth: Google / phone / guest, session_token via Bearer + cookie
  - Admin: email/password JWT login
  - Products CRUD with category filter, image, stock, tradeable flag
  - Bank info GET (public) + PUT (admin)
  - Orders: create (open), list/approve/reject/delete (admin)
  - Trades: create (auth), list, accept (different user), delete by creator/admin
- ✅ Frontend
  - Store page with hero, search, category filters, product cards
  - Product detail with bank-transfer info + receipt upload form
  - Trades page with browse + create tabs, 3x3 slot grids, product picker
  - Admin dashboard (products, orders, bank, trades)
  - Auth modal (Google / phone / guest)
  - RTL Arabic layout with custom dark gaming theme (cyan + yellow accents)
- ✅ Sample products auto-seeded on first run

## Backlog / Future
- **P1**: Better wishlist UX in trade — let user mark "I own this" so others can browse what's available
- **P1**: WhatsApp/Discord auto-notify on order received and trade matched
- **P2**: Stripe / direct payment as alternative to bank transfer
- **P2**: Phone OTP verification (currently any number is accepted)
- **P2**: Multi-language toggle (Arabic + English)
- **P2**: User profile + order history page
- **P2**: Image hosting via Cloudinary instead of base64 to reduce DB size

## Test Credentials
See `/app/memory/test_credentials.md`
