# PayFlow — MongoDB Data Model

A payments/transactions demo built around 5 collections. Designed for the patterns a
payments app actually needs: fast "recent transactions" reads, running balances,
category spend rollups, and light fraud signals — all things MongoDB's document
model and aggregation pipeline are good at.

## Why this shape

- **Transactions are the largest, highest-write collection** — they're modeled as
  their own collection (not embedded) so they can be indexed and paginated
  independently of accounts.
- **Accounts embed a denormalized `balance`** that's updated transactionally
  alongside each transaction write, so reading a balance never requires summing
  transaction history at request time.
- **Payment methods are embedded in the user document** (a user rarely has more
  than 5–10) — classic "embed what you always fetch together" MongoDB modeling.

---

## Collections

### `users`

```json
{
  "_id": ObjectId("665f1a2b3c4d5e6f7a8b9c01"),
  "name": "Maria Santoso",
  "email": "maria@example.com",
  "createdAt": ISODate("2024-01-15T08:30:00Z"),
  "kycStatus": "verified",
  "paymentMethods": [
    {
      "_id": ObjectId("665f1a2b3c4d5e6f7a8b9c10"),
      "type": "card",
      "brand": "visa",
      "last4": "4242",
      "isDefault": true
    },
    {
      "_id": ObjectId("665f1a2b3c4d5e6f7a8b9c11"),
      "type": "bank_account",
      "bankName": "BCA",
      "last4": "7781",
      "isDefault": false
    }
  ]
}
```

### `accounts`

```json
{
  "_id": ObjectId("665f2a2b3c4d5e6f7a8b9c02"),
  "userId": ObjectId("665f1a2b3c4d5e6f7a8b9c01"),
  "accountNumber": "PF-100234",
  "currency": "USD",
  "balance": 4231.55,
  "status": "active",
  "updatedAt": ISODate("2026-09-13T02:10:00Z")
}
```

### `transactions`

```json
{
  "_id": ObjectId("665f3a2b3c4d5e6f7a8b9c03"),
  "accountId": ObjectId("665f2a2b3c4d5e6f7a8b9c02"),
  "userId": ObjectId("665f1a2b3c4d5e6f7a8b9c01"),
  "type": "payment",
  "direction": "debit",
  "amount": 42.10,
  "currency": "USD",
  "category": "dining",
  "merchant": "Blue Bottle Coffee",
  "status": "completed",
  "counterpartyId": null,
  "createdAt": ISODate("2026-09-12T14:22:00Z"),
  "metadata": {
    "paymentMethodId": ObjectId("665f1a2b3c4d5e6f7a8b9c10"),
    "geo": { "city": "Surabaya", "country": "ID" }
  }
}
```

`type` ∈ `payment | transfer | deposit | refund` · `direction` ∈ `debit | credit`
`status` ∈ `pending | completed | failed | flagged`

### `merchants`

```json
{
  "_id": ObjectId("665f4a2b3c4d5e6f7a8b9c04"),
  "name": "Blue Bottle Coffee",
  "category": "dining",
  "mcc": "5814"
}
```

### `fraud_signals` (append-only, written by a background rule engine)

```json
{
  "_id": ObjectId("665f5a2b3c4d5e6f7a8b9c05"),
  "transactionId": ObjectId("665f3a2b3c4d5e6f7a8b9c03"),
  "rule": "velocity_check",
  "score": 0.82,
  "reason": "4 transactions from same card within 3 minutes",
  "createdAt": ISODate("2026-09-12T14:22:05Z")
}
```

---

## Indexes

```js
// Fast "recent transactions for this account" — the #1 query in the app
db.transactions.createIndex({ accountId: 1, createdAt: -1 });

// User's full transaction history across accounts
db.transactions.createIndex({ userId: 1, createdAt: -1 });

// Spend-by-category rollups
db.transactions.createIndex({ userId: 1, category: 1, createdAt: -1 });

// Look up an account by number at login/transfer time
db.accounts.createIndex({ accountNumber: 1 }, { unique: true });

db.users.createIndex({ email: 1 }, { unique: true });
```

---

## Example queries & aggregations

**1. Recent transactions for an account (paginated feed)**
```js
db.transactions.find({ accountId: acctId })
  .sort({ createdAt: -1 })
  .limit(20);
```

**2. Monthly spend by category** — drives the "spending breakdown" chart
```js
db.transactions.aggregate([
  { $match: {
      userId: uid,
      direction: "debit",
      createdAt: { $gte: startOfMonth, $lt: startOfNextMonth }
  }},
  { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
  { $sort: { total: -1 } }
]);
```

**3. Running balance sanity check** — recompute a balance from transaction history
(used to verify the denormalized `accounts.balance` hasn't drifted)
```js
db.transactions.aggregate([
  { $match: { accountId: acctId } },
  { $group: {
      _id: null,
      net: {
        $sum: {
          $cond: [{ $eq: ["$direction", "credit"] }, "$amount", { $multiply: ["$amount", -1] }]
        }
      }
  }}
]);
```

**4. Simple velocity-based fraud check** — flag accounts with >3 transactions in 5 minutes
```js
db.transactions.aggregate([
  { $match: { createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } } },
  { $group: { _id: "$accountId", count: { $sum: 1 }, txnIds: { $push: "$_id" } } },
  { $match: { count: { $gt: 3 } } }
]);
```

**5. Top merchants by spend, this quarter**
```js
db.transactions.aggregate([
  { $match: { direction: "debit", createdAt: { $gte: quarterStart } } },
  { $group: { _id: "$merchant", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
]);
```

**6. Atomic transfer between two accounts** (multi-document transaction —
MongoDB supports ACID transactions across documents/collections)
```js
const session = client.startSession();
await session.withTransaction(async () => {
  await accounts.updateOne({ _id: fromId }, { $inc: { balance: -amount } }, { session });
  await accounts.updateOne({ _id: toId },   { $inc: { balance:  amount } }, { session });
  await transactions.insertMany([
    { accountId: fromId, direction: "debit",  amount, type: "transfer", createdAt: new Date() },
    { accountId: toId,   direction: "credit", amount, type: "transfer", createdAt: new Date() }
  ], { session });
});
session.endSession();
```
