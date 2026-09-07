def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_user(client):
    response = client.post("/users", json={"name": "Thiago"})
    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert body["name"] == "Thiago"
    assert "created_at" in body


def test_list_users(client):
    client.post("/users", json={"name": "Ana"})
    client.post("/users", json={"name": "Bruno"})

    response = client.get("/users")
    assert response.status_code == 200
    names = [user["name"] for user in response.json()]
    assert "Ana" in names
    assert "Bruno" in names


def test_create_user_requires_name(client):
    response = client.post("/users", json={"name": "   "})
    assert response.status_code == 422


def test_create_sale_for_existing_user(client):
    user = client.post("/users", json={"name": "Thiago"}).json()

    response = client.post(
        "/sales",
        json={"user_id": user["id"], "item_name": "Perfume Malbec", "quantity": 2},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user_id"] == user["id"]
    assert body["user_name"] == "Thiago"
    assert body["item_name"] == "Perfume Malbec"
    assert body["quantity"] == 2


def test_list_sales_includes_user_name(client):
    user = client.post("/users", json={"name": "Maria"}).json()
    client.post(
        "/sales",
        json={"user_id": user["id"], "item_name": "Camiseta", "quantity": 3},
    )

    response = client.get("/sales")
    assert response.status_code == 200
    sale = next(s for s in response.json() if s["item_name"] == "Camiseta")
    assert sale["user_name"] == "Maria"


def test_create_sale_for_missing_user_returns_404(client):
    response = client.post(
        "/sales",
        json={"user_id": 999999, "item_name": "Qualquer", "quantity": 1},
    )
    assert response.status_code == 404


def test_create_sale_with_zero_quantity_returns_422(client):
    user = client.post("/users", json={"name": "Thiago"}).json()

    response = client.post(
        "/sales",
        json={"user_id": user["id"], "item_name": "Item", "quantity": 0},
    )
    assert response.status_code == 422


def test_create_sale_with_negative_quantity_returns_422(client):
    user = client.post("/users", json={"name": "Thiago"}).json()

    response = client.post(
        "/sales",
        json={"user_id": user["id"], "item_name": "Item", "quantity": -5},
    )
    assert response.status_code == 422
