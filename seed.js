import mongoose from "mongoose";
import "dotenv/config";
import { User, Account, Transaction, Merchant } from "./models/models.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/payflow";
const categories = ["dining", "groceries", "transport", "shopping", "subscriptions", "entertainment"];
const merchants = ["Blue Bottle Coffee", "Whole Foods", "Uber", "Amazon", "Spotify", "Netflix", "Shell", "Target"];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected. Clearing old data...");
  await Promise.all([User.deleteMany({}), Account.deleteMany({}), Transaction.deleteMany({}), Merchant.deleteMany({})]);

  const user = await User.create({
    name: "Maria Santoso",
    email: "maria@example.com",
    kycStatus: "verified",
    paymentMethods: [
      { type: "card", brand: "visa", last4: "4242", isDefault: true },
      { type: "bank_account", bankName: "BCA", last4: "7781", isDefault: false },
    ],
  });

  const account = await Account.create({
    userId: user._id,
    accountNumber: "PF-100234",
    currency: "USD",
    balance: 5000,
  });

  const txns = [];
  let balance = 5000;
  for (let i = 0; i < 40; i++) {
    const amount = +(Math.random() * 150 + 5).toFixed(2);
    balance -= amount;
    txns.push({
      accountId: account._id,
      userId: user._id,
      type: "payment",
      direction: "debit",
      amount,
      category: categories[Math.floor(Math.random() * categories.length)],
      merchant: merchants[Math.floor(Math.random() * merchants.length)],
      status: "completed",
      createdAt: new Date(Date.now() - i * 1000 * 60 * 60 * 6),
    });
  }
  await Transaction.insertMany(txns);
  await Account.updateOne({ _id: account._id }, { balance });

  console.log(`Seeded user ${user._id}, account ${account._id}, ${txns.length} transactions.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
