# Monólito Lab — Usuários & Vendas

Laboratório prático para estudar a **migração de um monólito para microsserviços**.

Esta é a **Etapa 1**: um monólito simples e funcional. Nada de Kafka, RabbitMQ,
Redis, Kubernetes, autenticação ou API Gateway. Tudo isso será introduzido
manualmente nas etapas seguintes do exercício.

---

## Arquitetura atual

```
Vue.js 3 (Vite)
      │
      │  HTTP REST (JSON)
      ▼
FastAPI Monolith  ── única aplicação, módulos "users" e "sales" no mesmo processo
      │
      │  SQLAlchemy 2 + Alembic
      ▼
PostgreSQL  ── um único banco, tabelas users e sales com Foreign Key entre elas
```

- **Frontend** e **backend** são projetos completamente separados (containers distintos).
- O **backend é uma única aplicação FastAPI**. `users` e `sales` são apenas
  pacotes Python dentro do mesmo processo.
- Os dois módulos compartilham **o mesmo PostgreSQL** e **o mesmo schema**.

---

## Stack

| Camada         | Tecnologia                                            |
| -------------- | ----------------------------------------------------- |
| Frontend       | Vue 3, Vite, JavaScript, Axios                        |
| Backend        | Python 3.12, FastAPI, SQLAlchemy 2, Pydantic 2        |
| Banco          | PostgreSQL 16                                         |
| Migrations     | Alembic (`alembic upgrade head` roda no start)        |
| Infraestrutura | Docker + Docker Compose                               |

---

## Como executar

Pré-requisito: Docker + Docker Compose.

```bash
docker compose up --build
```

Isso sobe três containers: `postgres`, `backend`, `frontend`.
O backend espera o PostgreSQL ficar saudável, aplica as migrations e então
inicia o FastAPI. Os dados do banco ficam em um volume Docker (`postgres_data`)
e **persistem entre reinícios**.

Para parar:

```bash
docker compose down          # mantém os dados
docker compose down -v       # apaga o volume do banco
```

### Variáveis de ambiente

Os valores default já funcionam. Para customizar, copie o exemplo:

```bash
cp .env.example .env
```

Nunca commite o arquivo `.env` (já está no `.gitignore`).

---

## URLs

| Serviço            | URL                            |
| ------------------ | ------------------------------ |
| Frontend (Vue)     | http://localhost:5173          |
| Backend (FastAPI)  | http://localhost:8000          |
| Swagger / OpenAPI  | http://localhost:8000/docs     |
| Health check       | http://localhost:8000/health   |
| PostgreSQL         | `localhost:5432`               |

---

## Endpoints

| Método | Rota            | Descrição                                    |
| ------ | --------------- | -------------------------------------------- |
| GET    | `/health`       | `{ "status": "ok" }`                         |
| POST   | `/users`        | Cria usuário `{ "name": "Thiago" }`          |
| GET    | `/users`        | Lista usuários                               |
| GET    | `/users/{id}`   | Busca usuário por id (404 se não existir)    |
| POST   | `/sales`        | Cria venda (ver regras abaixo)               |
| GET    | `/sales`        | Lista vendas **com `user_name`** (via JOIN)  |
| GET    | `/sales/{id}`   | Busca venda por id (404 se não existir)      |

### Regras de negócio

**Usuário**

- `name` é obrigatório (string não vazia).

**Venda** — payload:

```json
{ "user_id": 1, "item_name": "Perfume Malbec", "quantity": 2 }
```

- `user_id` obrigatório e o usuário **precisa existir** → senão `404`.
- `item_name` obrigatório.
- `quantity` precisa ser **> 0** → senão `422`.
- Payload malformado → `422` (validação Pydantic).

### Resposta de venda

O `GET /sales` retorna também o nome do usuário, obtido com **JOIN** entre
`sales` e `users`:

```json
{
  "id": 10,
  "user_id": 1,
  "user_name": "Thiago",
  "item_name": "Perfume Malbec",
  "quantity": 2,
  "created_at": "2026-09-07T12:00:00Z"
}
```

---

## Banco de dados

Um único banco PostgreSQL (`monolith`), duas tabelas.

### `users`

| Coluna       | Tipo          | Observações              |
| ------------ | ------------- | ------------------------ |
| `id`         | integer PK    | auto-incremento          |
| `name`       | varchar(255)  | obrigatório              |
| `created_at` | timestamptz   | default `now()`          |

### `sales`

| Coluna       | Tipo          | Observações                          |
| ------------ | ------------- | ------------------------------------ |
| `id`         | integer PK    | auto-incremento                      |
| `user_id`    | integer FK    | **Foreign Key → `users.id`**         |
| `item_name`  | varchar(255)  | obrigatório                          |
| `quantity`   | integer       | obrigatório, `> 0` (regra da API)    |
| `created_at` | timestamptz   | default `now()`                      |

A Foreign Key `sales.user_id → users.id` e o JOIN em `GET /sales` são
**intencionais** (ver seção abaixo).

---

## Testes

Os testes rodam contra o PostgreSQL real (sem SQLite), cada teste dentro de uma
transação que sofre rollback ao final.

Com o ambiente no ar:

```bash
docker compose exec backend pytest
```

Localmente (precisa de um PostgreSQL acessível e `DATABASE_URL` configurada,
além das migrations aplicadas):

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
pytest
```

Casos cobertos:

1. criar usuário;
2. listar usuários;
3. `name` vazio é rejeitado (`422`);
4. criar venda para usuário existente (retorna `user_name`);
5. `GET /sales` traz o nome do usuário via JOIN;
6. venda para usuário inexistente → `404`;
7. `quantity = 0` → `422`;
8. `quantity < 0` → `422`;
9. `GET /health`.

---

## Seed de dados para desenvolvimento

O arquivo [`database/seed.sql`](database/seed.sql) popula o banco com uma carga
inicial via **SQL puro executado diretamente no PostgreSQL** (não usa a API).

> ⚠️ **Exclusivo para desenvolvimento local. É destrutivo.**
> O script começa com
> `TRUNCATE TABLE sales, users RESTART IDENTITY CASCADE;`, ou seja, **apaga todos
> os dados anteriores** de `users` e `sales` e reinicia os ids em 1.
> Nunca rode contra um banco de produção.

Ele **não roda automaticamente**. `docker compose up --build` apenas sobe o
sistema; o seed é um comando explícito.

O que o seed cria (exatamente):

- **100 usuários** — `Usuario 001` … `Usuario 100` (ids 1 a 100);
- **1.000 vendas** — distribuídas aleatoriamente entre os 100 usuários;
  - `item_name`: um de 10 produtos fictícios (perfumes, shampoo, kit presente…);
  - `quantity`: valor de 1 a 10 (nunca 0 ou negativo);
  - `created_at`: espalhado pelos últimos ~180 dias.

Os dados são **reproduzíveis**: `random()` é inicializado com `setseed(0.42)`, então
rodar o seed novamente gera exatamente as mesmas linhas.

### Como executar

Com o ambiente no ar (`docker compose up --build`):

```bash
make seed
```

ou, sem `make`:

```bash
docker compose exec -T postgres psql -U postgres -d monolith < database/seed.sql
```

O próprio script imprime as contagens ao final.

### Como verificar

```bash
docker compose exec -T postgres psql -U postgres -d monolith
```

```sql
SELECT COUNT(*) FROM users;                 -- esperado: 100
SELECT COUNT(*) FROM sales;                 -- esperado: 1000
SELECT COUNT(DISTINCT user_id) FROM sales;  -- esperado: > 1 (várias vendas por usuário)

-- vendas órfãs (FK inválida) — esperado: 0
SELECT COUNT(*)
FROM sales s
LEFT JOIN users u ON u.id = s.user_id
WHERE u.id IS NULL;

-- top 10 usuários por número de vendas (JOIN que desaparece quando os
-- domínios forem separados em bancos diferentes)
SELECT u.id, u.name,
       COUNT(s.id) AS total_sales,
       SUM(s.quantity) AS total_items
FROM users u
LEFT JOIN sales s ON s.user_id = u.id
GROUP BY u.id, u.name
ORDER BY total_sales DESC
LIMIT 10;
```

---

## Limitações arquiteturais intencionais

Este sistema foi feito **de propósito** com forte acoplamento entre os domínios
`User` e `Sale`. Hoje:

- **User e Sale rodam no mesmo processo** (uma única aplicação FastAPI).
- **Usam o mesmo banco** e o mesmo schema.
- Existe uma **Foreign Key** `sales.user_id → users.id` no banco.
- Consultas fazem **JOIN** entre `sales` e `users` (ex.: `user_name` em `GET /sales`).
- O **deploy é único**: não é possível publicar Vendas sem publicar Usuários.
- A **escala é conjunta**: não dá para escalar Vendas independente de Usuários.
- Uma **falha no backend derruba os dois domínios** ao mesmo tempo.
- Uma migration ou transação toca as duas tabelas no mesmo lugar.

Isso é desejável **agora** porque as próximas etapas do laboratório vão extrair,
um domínio de cada vez:

- **User Service**
- **Sales Service**

e usar este monólito como ponto de partida para estudar, na prática:

- extração de microsserviços (Strangler Fig);
- separação de bancos (e o que acontece com a Foreign Key e o JOIN);
- comunicação síncrona (REST entre serviços);
- comunicação assíncrona (eventos);
- Kafka / RabbitMQ;
- consistência distribuída e o **Outbox Pattern**;
- observabilidade (logs, métricas, tracing);
- Docker / Kubernetes;
- System Design.

**Não** transforme este projeto em microsserviços ainda. O objetivo da Etapa 1 é
ter um monólito simples, correto e funcionando.

---

## Estrutura do projeto

```
monolito-microservice/
├── backend/
│   ├── app/
│   │   ├── main.py            # cria o FastAPI, CORS, /health, routers
│   │   ├── config.py          # settings via variáveis de ambiente
│   │   ├── database.py        # engine, SessionLocal, Base, get_db()
│   │   ├── logging_config.py
│   │   ├── models/            # SQLAlchemy 2 (user.py, sale.py)
│   │   ├── schemas/           # Pydantic 2 (user.py, sale.py)
│   │   ├── routers/           # users.py, sales.py
│   │   └── services/          # regras de negócio (users.py, sales.py)
│   ├── alembic/               # env.py + versions/0001_initial.py
│   ├── alembic.ini
│   ├── tests/                 # conftest.py + test_api.py
│   ├── entrypoint.sh          # espera o banco -> alembic upgrade head -> uvicorn
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.js
│   │   ├── App.vue            # menu Usuários / Vendas
│   │   ├── api.js             # instância Axios (VITE_API_URL)
│   │   └── components/
│   │       ├── UsersView.vue
│   │       └── SalesView.vue
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile
├── database/
│   └── seed.sql              # DEV-ONLY: 100 usuários + 1000 vendas (SQL puro)
├── Makefile                  # make seed / make test / make up / make down
├── docker-compose.yml
├── .env.example
└── README.md
```
