import mongoose from "mongoose";
const { Schema, model } = mongoose;

const PaymentMethodSchema = new Schema(
  {
    type: { type: String, enum: ["card", "bank_account"], required: true },
    brand: String,
    bankName: String,
    last4: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  kycStatus: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
  paymentMethods: [PaymentMethodSchema],
  createdAt: { type: Date, default: Date.now },
});

const AccountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  accountNumber: { type: String, required: true, unique: true },
  currency: { type: String, default: "USD" },
  balance: { type: Number, required: true, default: 0 },
  status: { type: String, enum: ["active", "frozen", "closed"], default: "active" },
  updatedAt: { type: Date, default: Date.now },
});

const TransactionSchema = new Schema({
  accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["payment", "transfer", "deposit", "refund"], required: true },
  direction: { type: String, enum: ["debit", "credit"], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: "USD" },
  category: { type: String, default: "other" },
  merchant: String,
  status: { type: String, enum: ["pending", "completed", "failed", "flagged"], default: "completed" },
  counterpartyId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  createdAt: { type: Date, default: Date.now, index: true },
  metadata: { type: Schema.Types.Mixed },
});
TransactionSchema.index({ accountId: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, category: 1, createdAt: -1 });

const MerchantSchema = new Schema({
  name: { type: String, required: true },
  category: String,
  mcc: String,
});

export const User = model("User", UserSchema);
export const Account = model("Account", AccountSchema);
export const Transaction = model("Transaction", TransactionSchema);
export const Merchant = model("Merchant", MerchantSchema);
