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
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
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
async def create_order(o: OrderCreate):
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
    )
    doc = order.model_dump()
    doc["created_at"] = now_iso()
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
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
    # Seed bank info if missing
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
    # Seed sample products if empty
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
