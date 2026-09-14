# PayFlow Backend

Express + Mongoose API for the PayFlow payments demo.

## Setup

```bash
npm install
```

Create a `.env` file:
```
MONGO_URI=mongodb://localhost:27017/payflow
PORT=4000
```

(Or point `MONGO_URI` at a free MongoDB Atlas cluster.)

## Seed demo data

```bash
npm run seed
```
Creates one user, one account with a $5,000 starting balance, and 40 sample
transactions spread over the last ~10 days. Prints the generated `userId` and
`accountId` — you'll need those for the endpoints below.

## Run

```bash
npm start
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/accounts/:id` | Get account + balance |
| GET | `/api/accounts/:id/transactions?limit=20&before=<ISO date>` | Paginated transaction feed |
| POST | `/api/transactions/payment` | `{ accountId, amount, merchant, category }` — debit an account |
| POST | `/api/transactions/transfer` | `{ fromAccountId, toAccountId, amount }` — atomic transfer |
| GET | `/api/users/:id/spend-by-category` | Current month's spend, grouped by category |
| GET | `/api/fraud/velocity-check` | Accounts with >3 transactions in the last 5 minutes |

Full schema reference and aggregation examples are in `../mongodb-data-model.md`.
