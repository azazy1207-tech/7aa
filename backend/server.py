from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Cookie, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_EMAIL = os.environ['ADMIN_EMAIL']
ADMIN_PASSWORD = os.environ['ADMIN_PASSWORD']
JWT_SECRET = os.environ['JWT_SECRET']
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ========== Models ==========
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: Optional[str] = None
    name: str
    picture: Optional[str] = None
    phone: Optional[str] = None
    auth_type: Literal["google", "phone", "guest"] = "guest"
    created_at: Optional[str] = None


class GuestLoginRequest(BaseModel):
    name: str


class PhoneLoginRequest(BaseModel):
    name: str
    phone: str


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: f"prod_{uuid.uuid4().hex[:10]}")
    name: str
    description: Optional[str] = ""
    price: float
    image: str  # base64 or URL
    category: str  # adopt_me / grow_garden / steal_brainrot
    stock: int = 1
    is_tradeable: bool = True
    created_at: Optional[str] = None


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float
    image: str
    category: str
    stock: int = 1
    is_tradeable: bool = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    category: Optional[str] = None
    stock: Optional[int] = None
    is_tradeable: Optional[bool] = None


class BankInfo(BaseModel):
    bank_name: str = ""
    account_name: str = ""
    account_number: str = ""
    iban: str = ""
    notes: str = ""


class OrderCreate(BaseModel):
    product_id: str
    buyer_name: str
    buyer_contact: Optional[str] = ""  # phone or email/discord
    receipt_image: str  # base64
    notes: Optional[str] = ""


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: f"ord_{uuid.uuid4().hex[:10]}")
    product_id: str
    product_name: str
    product_price: float
    buyer_name: str
    buyer_contact: Optional[str] = ""
    receipt_image: str
    notes: Optional[str] = ""
    status: Literal["pending", "approved", "rejected"] = "pending"
    # Auto-captured from logged-in user (if any)
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    user_auth_type: Optional[str] = None
    created_at: Optional[str] = None


class TradeSlot(BaseModel):
    product_id: Optional[str] = None  # if None, slot is empty
    product_name: Optional[str] = None
    product_image: Optional[str] = None


class TradeCreate(BaseModel):
    title: Optional[str] = "تداول جديد"
    offering: List[TradeSlot]  # max 9
    requesting: List[TradeSlot]  # max 9
    contact: Optional[str] = ""  # discord/whatsapp for matching
    notes: Optional[str] = ""


class Trade(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: f"trade_{uuid.uuid4().hex[:10]}")
    title: str
    creator_user_id: str
    creator_name: str
    offering: List[TradeSlot]
    requesting: List[TradeSlot]
    contact: str = ""
    notes: str = ""
    status: Literal["open", "matched", "closed"] = "open"
    matched_with_user_id: Optional[str] = None
    matched_with_name: Optional[str] = None
    created_at: Optional[str] = None


# ========== Helpers ==========
def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> User:
    # Prefer Bearer over cookie so stale cookies don't shadow an explicit token
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        token = session_token
    if not token:
        raise HTTPException(status_code=401, detail="غير مصرح")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="جلسة غير صالحة")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="انتهت الجلسة")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="المستخدم غير موجود")
    return User(**user_doc)


async def try_get_current_user(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> Optional[User]:
    """Returns the user if authenticated, otherwise None (no error)."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        token = session_token
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        return None
    return User(**user_doc)


async def get_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="غير مصرح للأدمن")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="ليس أدمن")
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="رمز أدمن غير صالح")


async def create_session(user_id: str) -> str:
    session_token = f"sess_{uuid.uuid4().hex}_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": expires_at.isoformat(),
        "created_at": now_iso(),
    })
    return session_token


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token",
        value=token,
        max_age=7 * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
    )


# ========== AUTH ROUTES ==========
@api_router.post("/auth/google/session")
async def auth_google_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id مطلوب")

    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="فشل التحقق من Google")
    data = r.json()

    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data["name"], "picture": data["picture"], "auth_type": "google"}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": data["email"],
            "name": data["name"],
            "picture": data["picture"],
            "auth_type": "google",
            "created_at": now_iso(),
        })

    token = await create_session(user_id)
    set_session_cookie(response, token)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc, "session_token": token}


@api_router.post("/auth/guest")
async def auth_guest(req: GuestLoginRequest, response: Response):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="الاسم مطلوب")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id,
        "name": req.name.strip(),
        "auth_type": "guest",
        "created_at": now_iso(),
    })
    token = await create_session(user_id)
    set_session_cookie(response, token)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc, "session_token": token}


@api_router.post("/auth/phone")
async def auth_phone(req: PhoneLoginRequest, response: Response):
    if not req.name.strip() or not req.phone.strip():
        raise HTTPException(status_code=400, detail="الاسم ورقم الجوال مطلوبان")
    # Check if phone exists
    existing = await db.users.find_one({"phone": req.phone.strip()}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id}, {"$set": {"name": req.name.strip()}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "name": req.name.strip(),
            "phone": req.phone.strip(),
            "auth_type": "phone",
            "created_at": now_iso(),
        })
    token = await create_session(user_id)
    set_session_cookie(response, token)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc, "session_token": token}


@api_router.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    return user.model_dump()


@api_router.post("/auth/logout")
async def auth_logout(
    response: Response,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ========== ADMIN AUTH ==========
@api_router.post("/admin/login")
async def admin_login(req: AdminLoginRequest):
    if req.email.strip().lower() != ADMIN_EMAIL.lower() or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="بيانات الأدمن خاطئة")
    token = jwt.encode(
        {
            "role": "admin",
            "email": ADMIN_EMAIL,
            "exp": datetime.now(timezone.utc) + timedelta(days=7),
        },
        JWT_SECRET,
        algorithm="HS256",
    )
    return {"token": token, "email": ADMIN_EMAIL}


@api_router.get("/admin/me")
async def admin_me(admin=Depends(get_admin)):
    return {"email": admin.get("email"), "role": "admin"}


# ========== PRODUCTS ==========
@api_router.get("/products")
async def list_products(category: Optional[str] = None):
    query = {}
    if category and category != "all":
        query["category"] = category
    docs = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    return doc


@api_router.post("/products")
async def create_product(p: ProductCreate, admin=Depends(get_admin)):
    prod = Product(**p.model_dump())
    doc = prod.model_dump()
    doc["created_at"] = now_iso()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, p: ProductUpdate, admin=Depends(get_admin)):
    update_fields = {k: v for k, v in p.model_dump().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="لا توجد بيانات للتحديث")
    res = await db.products.update_one({"id": product_id}, {"$set": update_fields})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    return doc


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin=Depends(get_admin)):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    return {"ok": True}


# ========== BANK INFO ==========
@api_router.get("/bank-info")
async def get_bank_info():
    doc = await db.settings.find_one({"key": "bank_info"}, {"_id": 0})
    if not doc:
        return BankInfo().model_dump()
    return doc.get("value", BankInfo().model_dump())


@api_router.put("/bank-info")
async def update_bank_info(info: BankInfo, admin=Depends(get_admin)):
    await db.settings.update_one(
        {"key": "bank_info"},
        {"$set": {"key": "bank_info", "value": info.model_dump(), "updated_at": now_iso()}},
        upsert=True,
    )
    return info.model_dump()


# ========== ORDERS ==========
@api_router.post("/orders")
async def create_order(o: OrderCreate, user: Optional[User] = Depends(try_get_current_user)):
    prod = await db.products.find_one({"id": o.product_id}, {"_id": 0})
    if not prod:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    order = Order(
        product_id=o.product_id,
        product_name=prod["name"],
        product_price=prod["price"],
        buyer_name=o.buyer_name,
        buyer_contact=o.buyer_contact or "",
        receipt_image=o.receipt_image,
        notes=o.notes or "",
        user_id=user.user_id if user else None,
        user_email=user.email if user else None,
        user_phone=user.phone if user else None,
        user_auth_type=user.auth_type if user else None,
    )
    doc = order.model_dump()
    doc["created_at"] = now_iso()
    await db.orders.insert_one(doc)
    doc.pop("_id", None)

    # Send Telegram notification with receipt
    try:
        user_line = ""
        if user:
            if user.email:
                user_line += f"\n📧 الإيميل: {user.email}"
            if user.phone:
                user_line += f"\n📱 الجوال: {user.phone}"
            auth_label = {"google": "Google", "phone": "رقم جوال", "guest": "ضيف"}.get(user.auth_type or "guest", "ضيف")
            user_line += f"\n🔐 نوع الحساب: {auth_label}"
        contact_line = f"\n💬 تواصل: {o.buyer_contact}" if o.buyer_contact else ""
        notes_line = f"\n📝 ملاحظات: {o.notes}" if o.notes else ""
        caption = (
            f"🛒 <b>طلب جديد!</b>\n\n"
            f"📦 المنتج: <b>{prod['name']}</b>\n"
            f"💰 السعر: <b>{prod['price']} ر.س</b>\n"
            f"👤 المشتري: <b>{o.buyer_name}</b>"
            f"{user_line}{contact_line}{notes_line}\n\n"
            f"🆔 <code>{order.id}</code>"
        )
        await notify_admins(caption, photo_b64=o.receipt_image)
    except Exception as e:
        logger.warning(f"Failed to send order notification: {e}")

    return {"id": order.id, "status": "pending"}


@api_router.get("/orders")
async def list_orders(admin=Depends(get_admin)):
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: dict, admin=Depends(get_admin)):
    status = body.get("status")
    if status not in ["pending", "approved", "rejected"]:
        raise HTTPException(status_code=400, detail="حالة غير صحيحة")
    res = await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    return {"ok": True}


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, admin=Depends(get_admin)):
    await db.orders.delete_one({"id": order_id})
    return {"ok": True}


# ========== TRADES ==========
@api_router.post("/trades")
async def create_trade(t: TradeCreate, user: User = Depends(get_current_user)):
    # Validate max 9 slots each side
    offering = (t.offering or [])[:9]
    requesting = (t.requesting or [])[:9]
    # Pad to 9
    while len(offering) < 9:
        offering.append(TradeSlot())
    while len(requesting) < 9:
        requesting.append(TradeSlot())

    if not any(s.product_id for s in offering) or not any(s.product_id for s in requesting):
        raise HTTPException(status_code=400, detail="يجب وضع عنصر واحد على الأقل في كل جهة")

    trade = Trade(
        title=t.title or "تداول جديد",
        creator_user_id=user.user_id,
        creator_name=user.name,
        offering=offering,
        requesting=requesting,
        contact=t.contact or "",
        notes=t.notes or "",
    )
    doc = trade.model_dump()
    doc["created_at"] = now_iso()
    await db.trades.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/trades")
async def list_trades(status: Optional[str] = "open"):
    query = {}
    if status and status != "all":
        query["status"] = status
    docs = await db.trades.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/trades/mine")
async def my_trades(user: User = Depends(get_current_user)):
    docs = await db.trades.find(
        {"$or": [{"creator_user_id": user.user_id}, {"matched_with_user_id": user.user_id}]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/trades/{trade_id}")
async def get_trade(trade_id: str):
    doc = await db.trades.find_one({"id": trade_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="التداول غير موجود")
    return doc


@api_router.post("/trades/{trade_id}/accept")
async def accept_trade(trade_id: str, user: User = Depends(get_current_user)):
    trade = await db.trades.find_one({"id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="التداول غير موجود")
    if trade["status"] != "open":
        raise HTTPException(status_code=400, detail="التداول غير متاح")
    if trade["creator_user_id"] == user.user_id:
        raise HTTPException(status_code=400, detail="لا يمكنك قبول تداولك الخاص")
    await db.trades.update_one(
        {"id": trade_id},
        {
            "$set": {
                "status": "matched",
                "matched_with_user_id": user.user_id,
                "matched_with_name": user.name,
                "matched_at": now_iso(),
            }
        },
    )
    doc = await db.trades.find_one({"id": trade_id}, {"_id": 0})
    return doc


@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str, user: User = Depends(get_current_user)):
    trade = await db.trades.find_one({"id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="غير موجود")
    if trade["creator_user_id"] != user.user_id:
        # Allow admin via separate endpoint, here only creator
        raise HTTPException(status_code=403, detail="غير مصرح")
    await db.trades.delete_one({"id": trade_id})
    return {"ok": True}


@api_router.delete("/admin/trades/{trade_id}")
async def admin_delete_trade(trade_id: str, admin=Depends(get_admin)):
    await db.trades.delete_one({"id": trade_id})
    return {"ok": True}



# ========== TELEGRAM NOTIFICATIONS ==========
TG_API = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}" if TELEGRAM_BOT_TOKEN else None


async def tg_send_message(chat_id: int, text: str) -> bool:
    if not TG_API:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.post(
                f"{TG_API}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            )
        return r.status_code == 200
    except Exception as e:
        logger.warning(f"Telegram send_message failed: {e}")
        return False


async def tg_send_photo_b64(chat_id: int, photo_b64: str, caption: str = "") -> bool:
    if not TG_API:
        return False
    try:
        import base64
        if photo_b64.startswith("data:"):
            _, b64data = photo_b64.split(",", 1)
        else:
            b64data = photo_b64
        photo_bytes = base64.b64decode(b64data)
        async with httpx.AsyncClient(timeout=30) as http:
            files = {"photo": ("receipt.png", photo_bytes, "image/png")}
            data = {"chat_id": str(chat_id), "caption": caption, "parse_mode": "HTML"}
            r = await http.post(f"{TG_API}/sendPhoto", files=files, data=data)
        return r.status_code == 200
    except Exception as e:
        logger.warning(f"Telegram send_photo failed: {e}")
        return False


async def get_linked_chats() -> List[int]:
    docs = await db.telegram_chats.find({}, {"_id": 0}).to_list(50)
    return [d["chat_id"] for d in docs]


async def notify_admins(text: str, photo_b64: Optional[str] = None):
    chats = await get_linked_chats()
    for cid in chats:
        if photo_b64:
            await tg_send_photo_b64(cid, photo_b64, caption=text)
        else:
            await tg_send_message(cid, text)


@api_router.post("/admin/telegram/sync")
async def telegram_sync(admin=Depends(get_admin)):
    if not TG_API:
        raise HTTPException(status_code=400, detail="بوت تيليجرام غير مهيأ")
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(f"{TG_API}/getUpdates")
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="فشل الاتصال بتيليجرام")
        data = r.json()
        new_chats = []
        for upd in data.get("result", []):
            msg = upd.get("message") or upd.get("edited_message")
            if not msg:
                continue
            chat = msg.get("chat", {})
            chat_id = chat.get("id")
            if not chat_id:
                continue
            existing = await db.telegram_chats.find_one({"chat_id": chat_id})
            if not existing:
                await db.telegram_chats.insert_one({
                    "chat_id": chat_id,
                    "first_name": chat.get("first_name", ""),
                    "username": chat.get("username", ""),
                    "linked_at": now_iso(),
                })
                new_chats.append(chat_id)
                await tg_send_message(chat_id, "✅ تم ربط حسابك بنجاح! ستصلك إشعارات الطلبات الجديدة هنا.")
        linked = await db.telegram_chats.find({}, {"_id": 0}).to_list(50)
        return {"new_chats": new_chats, "linked": linked, "count": len(linked)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/telegram/status")
async def telegram_status(admin=Depends(get_admin)):
    bot_username = ""
    if TG_API:
        try:
            async with httpx.AsyncClient(timeout=5) as http:
                r = await http.get(f"{TG_API}/getMe")
            if r.status_code == 200:
                bot_username = r.json().get("result", {}).get("username", "")
        except Exception:
            pass
    linked = await db.telegram_chats.find({}, {"_id": 0}).to_list(50)
    return {"bot_username": bot_username, "configured": bool(TG_API), "linked": linked, "count": len(linked)}


@api_router.post("/admin/telegram/test")
async def telegram_test(admin=Depends(get_admin)):
    chats = await get_linked_chats()
    if not chats:
        raise HTTPException(status_code=400, detail="لا توجد حسابات مربوطة")
    ok = 0
    for cid in chats:
        if await tg_send_message(cid, "🎉 <b>رسالة اختبار</b>\n\nالإشعارات تعمل بنجاح!"):
            ok += 1
    return {"sent": ok, "total": len(chats)}


@api_router.delete("/admin/telegram/{chat_id}")
async def telegram_unlink(chat_id: int, admin=Depends(get_admin)):
    await db.telegram_chats.delete_one({"chat_id": chat_id})
    return {"ok": True}


# ========== HEALTH ==========
@api_router.get("/")
async def root():
    return {"message": "Roblox Shop API"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    exists = await db.settings.find_one({"key": "bank_info"})
    if not exists:
        await db.settings.insert_one({
            "key": "bank_info",
            "value": BankInfo(
                bank_name="الراجحي",
                account_name="يوسف عماد",
                account_number="000000000000",
                iban="SA0000000000000000000000",
                notes="بعد التحويل أرفق صورة الإيصال واسمك في خانة الشراء.",
            ).model_dump(),
            "updated_at": now_iso(),
        })
    count = await db.products.count_documents({})
    if count == 0:
        samples = [
            {"name": "Shadow Dragon", "description": "بت نادر من Adopt Me", "price": 150.0,
             "category": "adopt_me", "stock": 3, "is_tradeable": True,
             "image": "https://images.unsplash.com/photo-1636622433525-127afdf3662d?w=400&q=80"},
            {"name": "Frost Dragon", "description": "بت أسطوري من Adopt Me", "price": 120.0,
             "category": "adopt_me", "stock": 2, "is_tradeable": True,
             "image": "https://images.unsplash.com/photo-1639628735078-ed2f038a193e?w=400&q=80"},
            {"name": "Giant Pumpkin", "description": "محصول نادر Grow a Garden", "price": 80.0,
             "category": "grow_garden", "stock": 5, "is_tradeable": True,
             "image": "https://images.unsplash.com/photo-1775193823752-84a3c871f93a?w=400&q=80"},
            {"name": "Brainrot Hacker", "description": "عنصر Steal a Brainrot", "price": 60.0,
             "category": "steal_brainrot", "stock": 10, "is_tradeable": True,
             "image": "https://images.unsplash.com/photo-1660644808219-1f103401bc85?w=400&q=80"},
        ]
        for s in samples:
            p = Product(**s)
            d = p.model_dump()
            d["created_at"] = now_iso()
            await db.products.insert_one(d)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
