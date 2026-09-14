import { Router } from "express";
import mongoose from "mongoose";
import { User, Account, Transaction } from "../models/models.js";

const router = Router();

// --- Accounts -------------------------------------------------------------

router.get("/accounts/:id", async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.status(404).json({ error: "Account not found" });
  res.json(account);
});

// --- Transactions -----------------------------------------------------------

// Recent transactions feed (paginated)
router.get("/accounts/:id/transactions", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const before = req.query.before ? new Date(req.query.before) : new Date();
  const txns = await Transaction.find({
    accountId: req.params.id,
    createdAt: { $lt: before },
  })
    .sort({ createdAt: -1 })
    .limit(limit);
  res.json(txns);
});

// Create a payment (single-account debit)
router.post("/transactions/payment", async (req, res) => {
  const { accountId, amount, merchant, category } = req.body;
  const session = await mongoose.startSession();
  try {
    let txn;
    await session.withTransaction(async () => {
      const account = await Account.findById(accountId).session(session);
      if (!account) throw new Error("Account not found");
      if (account.balance < amount) throw new Error("Insufficient funds");

      account.balance -= amount;
      account.updatedAt = new Date();
      await account.save({ session });

      [txn] = await Transaction.create(
        [
          {
            accountId,
            userId: account.userId,
            type: "payment",
            direction: "debit",
            amount,
            merchant,
            category: category || "other",
            status: "completed",
          },
        ],
        { session }
      );
    });
    res.status(201).json(txn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// Atomic transfer between two accounts
router.post("/transactions/transfer", async (req, res) => {
  const { fromAccountId, toAccountId, amount } = req.body;
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const from = await Account.findById(fromAccountId).session(session);
      const to = await Account.findById(toAccountId).session(session);
      if (!from || !to) throw new Error("Account not found");
      if (from.balance < amount) throw new Error("Insufficient funds");

      from.balance -= amount;
      to.balance += amount;
      await from.save({ session });
      await to.save({ session });

      const [debit, credit] = await Transaction.create(
        [
          { accountId: fromAccountId, userId: from.userId, type: "transfer", direction: "debit", amount, counterpartyId: toAccountId, status: "completed" },
          { accountId: toAccountId, userId: to.userId, type: "transfer", direction: "credit", amount, counterpartyId: fromAccountId, status: "completed" },
        ],
        { session }
      );
      return { debit, credit };
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// --- Analytics --------------------------------------------------------------

// Spend by category for the current month
router.get("/users/:id/spend-by-category", async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await Transaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(req.params.id),
        direction: "debit",
        createdAt: { $gte: startOfMonth },
      },
    },
    { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  res.json(result);
});

// Basic velocity-based fraud check across all accounts
router.get("/fraud/velocity-check", async (req, res) => {
  const windowStart = new Date(Date.now() - 5 * 60 * 1000);
  const result = await Transaction.aggregate([
    { $match: { createdAt: { $gte: windowStart } } },
    { $group: { _id: "$accountId", count: { $sum: 1 }, txnIds: { $push: "$_id" } } },
    { $match: { count: { $gt: 3 } } },
  ]);
  res.json(result);
});

export default router;
