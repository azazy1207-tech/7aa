"""Backend tests for Roblox Arabic Marketplace."""
import os
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sharp-pare-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "yusefemad1430@gmail.com"
ADMIN_PASSWORD = "Ahmad1207"

# tiny base64 image
SAMPLE_IMG = "data:image/png;base64," + base64.b64encode(b"PNGDATA").decode()


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def guest1(s):
    r = s.post(f"{API}/auth/guest", json={"name": "TEST_Guest_One"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["session_token"], "user": data["user"]}


@pytest.fixture(scope="session")
def guest2(s):
    r = s.post(f"{API}/auth/guest", json={"name": "TEST_Guest_Two"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["session_token"], "user": data["user"]}


# -------------- health & basic ----------------
def test_health(s):
    r = s.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# -------------- products public ----------------
def test_list_products_seeded(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 4
    cats = {p["category"] for p in data}
    assert {"adopt_me", "grow_garden", "steal_brainrot"}.issubset(cats)


def test_list_products_category_filter(s):
    r = s.get(f"{API}/products", params={"category": "adopt_me"})
    assert r.status_code == 200
    data = r.json()
    assert all(p["category"] == "adopt_me" for p in data)
    assert len(data) >= 1


def test_get_product_by_id(s):
    products = s.get(f"{API}/products").json()
    pid = products[0]["id"]
    r = s.get(f"{API}/products/{pid}")
    assert r.status_code == 200
    assert r.json()["id"] == pid


def test_get_product_404(s):
    r = s.get(f"{API}/products/does_not_exist_xyz")
    assert r.status_code == 404


# -------------- bank info ----------------
def test_get_bank_info(s):
    r = s.get(f"{API}/bank-info")
    assert r.status_code == 200
    data = r.json()
    assert "bank_name" in data and "iban" in data


# -------------- guest auth ----------------
def test_guest_login_and_me_and_logout(s):
    r = s.post(f"{API}/auth/guest", json={"name": "TEST_Ephemeral"})
    assert r.status_code == 200
    data = r.json()
    token = data["session_token"]
    assert token and data["user"]["name"] == "TEST_Ephemeral"
    assert data["user"]["auth_type"] == "guest"

    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["user_id"] == data["user"]["user_id"]

    lo = requests.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert lo.status_code == 200

    me2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me2.status_code == 401


def test_guest_login_empty_name(s):
    r = s.post(f"{API}/auth/guest", json={"name": "   "})
    assert r.status_code == 400


# -------------- phone auth ----------------
def test_phone_auth_creates_user(s):
    phone = f"+9665{uuid.uuid4().hex[:8]}"
    r = s.post(f"{API}/auth/phone", json={"name": "TEST_Phone_User", "phone": phone})
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["auth_type"] == "phone"
    assert data["user"]["phone"] == phone
    assert data["session_token"]


# -------------- admin auth ----------------
def test_admin_login_success(admin_token):
    assert isinstance(admin_token, str) and len(admin_token) > 10


def test_admin_login_wrong_password(s):
    r = s.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_admin_me(s, admin_headers):
    r = s.get(f"{API}/admin/me", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


def test_admin_me_no_token(s):
    r = s.get(f"{API}/admin/me")
    assert r.status_code == 401


# -------------- products CRUD admin ----------------
def test_product_crud_flow(s, admin_headers):
    payload = {
        "name": "TEST_Product_X",
        "description": "for testing",
        "price": 99.5,
        "image": SAMPLE_IMG,
        "category": "adopt_me",
        "stock": 7,
        "is_tradeable": True,
    }
    # create
    r = s.post(f"{API}/products", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    created = r.json()
    pid = created["id"]
    assert created["name"] == "TEST_Product_X" and created["price"] == 99.5

    # verify GET persists
    g = s.get(f"{API}/products/{pid}")
    assert g.status_code == 200 and g.json()["name"] == "TEST_Product_X"

    # update
    u = s.put(f"{API}/products/{pid}", json={"price": 50.0, "stock": 2}, headers=admin_headers)
    assert u.status_code == 200
    assert u.json()["price"] == 50.0 and u.json()["stock"] == 2

    g2 = s.get(f"{API}/products/{pid}").json()
    assert g2["price"] == 50.0

    # non-admin cannot create
    r2 = s.post(f"{API}/products", json=payload)
    assert r2.status_code == 401

    # non-admin cannot delete
    r3 = s.delete(f"{API}/products/{pid}")
    assert r3.status_code == 401

    # delete (admin)
    d = s.delete(f"{API}/products/{pid}", headers=admin_headers)
    assert d.status_code == 200

    # verify gone
    g3 = s.get(f"{API}/products/{pid}")
    assert g3.status_code == 404


# -------------- bank info admin ----------------
def test_bank_info_update(s, admin_headers):
    new_info = {
        "bank_name": "TEST_Bank",
        "account_name": "TEST_Account",
        "account_number": "1234567890",
        "iban": "SA9999999999999999999999",
        "notes": "TEST notes",
    }
    r = s.put(f"{API}/bank-info", json=new_info, headers=admin_headers)
    assert r.status_code == 200
    g = s.get(f"{API}/bank-info").json()
    assert g["bank_name"] == "TEST_Bank"
    assert g["iban"] == "SA9999999999999999999999"
    # restore
    restore = {
        "bank_name": "الراجحي",
        "account_name": "يوسف عماد",
        "account_number": "000000000000",
        "iban": "SA0000000000000000000000",
        "notes": "بعد التحويل أرفق صورة الإيصال واسمك في خانة الشراء.",
    }
    s.put(f"{API}/bank-info", json=restore, headers=admin_headers)


def test_bank_info_non_admin_blocked(s):
    r = s.put(f"{API}/bank-info", json={"bank_name": "X"})
    assert r.status_code == 401


# -------------- orders ----------------
def test_orders_flow(s, admin_headers):
    products = s.get(f"{API}/products").json()
    pid = products[0]["id"]

    payload = {
        "product_id": pid,
        "buyer_name": "TEST_Buyer",
        "buyer_contact": "test@example.com",
        "receipt_image": SAMPLE_IMG,
        "notes": "test order",
    }
    r = s.post(f"{API}/orders", json=payload)
    assert r.status_code == 200
    oid = r.json()["id"]
    assert r.json()["status"] == "pending"

    # admin list
    lst = s.get(f"{API}/orders", headers=admin_headers)
    assert lst.status_code == 200
    ids = [o["id"] for o in lst.json()]
    assert oid in ids

    # non-admin cannot list
    r2 = s.get(f"{API}/orders")
    assert r2.status_code == 401

    # update status
    u = s.put(f"{API}/orders/{oid}/status", json={"status": "approved"}, headers=admin_headers)
    assert u.status_code == 200

    lst2 = s.get(f"{API}/orders", headers=admin_headers).json()
    matched = [o for o in lst2 if o["id"] == oid]
    assert matched and matched[0]["status"] == "approved"

    # invalid status
    bad = s.put(f"{API}/orders/{oid}/status", json={"status": "weird"}, headers=admin_headers)
    assert bad.status_code == 400

    # delete
    d = s.delete(f"{API}/orders/{oid}", headers=admin_headers)
    assert d.status_code == 200


def test_orders_invalid_product(s):
    payload = {
        "product_id": "nonexistent",
        "buyer_name": "TEST_X",
        "receipt_image": SAMPLE_IMG,
    }
    r = s.post(f"{API}/orders", json=payload)
    assert r.status_code == 404


# -------------- trades ----------------
def _make_slots(product_ids):
    return [{"product_id": pid, "product_name": "X", "product_image": "y"} for pid in product_ids]


def test_trades_flow(s, guest1, guest2, admin_headers):
    products = requests.get(f"{API}/products").json()
    assert len(products) >= 2
    off_pid = products[0]["id"]
    req_pid = products[1]["id"]

    h1 = {"Authorization": f"Bearer {guest1['token']}"}
    h2 = {"Authorization": f"Bearer {guest2['token']}"}

    payload = {
        "title": "TEST_Trade",
        "offering": _make_slots([off_pid]),
        "requesting": _make_slots([req_pid]),
        "contact": "discord#1234",
        "notes": "test",
    }
    # auth required (fresh session without cookies)
    r_noauth = requests.post(f"{API}/trades", json=payload)
    assert r_noauth.status_code == 401

    # create
    r = requests.post(f"{API}/trades", json=payload, headers=h1)
    assert r.status_code == 200, r.text
    trade = r.json()
    tid = trade["id"]
    assert len(trade["offering"]) == 9 and len(trade["requesting"]) == 9
    assert trade["creator_user_id"] == guest1["user"]["user_id"]
    assert trade["status"] == "open"

    # empty offering -> 400
    bad = requests.post(
        f"{API}/trades",
        json={"offering": [{"product_id": None}], "requesting": _make_slots([req_pid])},
        headers=h1,
    )
    assert bad.status_code == 400

    # listing open
    lst = requests.get(f"{API}/trades").json()
    assert any(t["id"] == tid for t in lst)

    # creator cannot accept own
    own = requests.post(f"{API}/trades/{tid}/accept", headers=h1)
    assert own.status_code == 400

    # second user accepts
    acc = requests.post(f"{API}/trades/{tid}/accept", headers=h2)
    assert acc.status_code == 200
    data = acc.json()
    assert data["status"] == "matched"
    assert data["matched_with_user_id"] == guest2["user"]["user_id"]

    # cannot accept again (not open)
    again = requests.post(f"{API}/trades/{tid}/accept", headers=h2)
    assert again.status_code == 400

    # creator delete - need new trade (this one already matched). Create another
    r2 = requests.post(f"{API}/trades", json=payload, headers=h1)
    tid2 = r2.json()["id"]
    # non-creator cannot delete
    bad_del = requests.delete(f"{API}/trades/{tid2}", headers=h2)
    assert bad_del.status_code == 403
    # creator delete
    okd = requests.delete(f"{API}/trades/{tid2}", headers=h1)
    assert okd.status_code == 200

    # admin delete endpoint
    r3 = requests.post(f"{API}/trades", json=payload, headers=h1)
    tid3 = r3.json()["id"]
    ad = requests.delete(f"{API}/admin/trades/{tid3}", headers=admin_headers)
    assert ad.status_code == 200
