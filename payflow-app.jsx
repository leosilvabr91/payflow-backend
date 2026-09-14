import React, { useState, useMemo } from "react";
import { ArrowUpRight, ArrowDownLeft, Send, Coffee, ShoppingBag, Car, Home, Music, Zap, ChevronRight, Check } from "lucide-react";

// ---- Mock data, shaped exactly like the MongoDB documents in mongodb-data-model.md ----

const CATEGORY_META = {
  dining: { label: "Dining", icon: Coffee, color: "#A6432D" },
  groceries: { label: "Groceries", icon: ShoppingBag, color: "#0F6B4C" },
  transport: { label: "Transport", icon: Car, color: "#3A5A78" },
  subscriptions: { label: "Subscriptions", icon: Music, color: "#8A5A9E" },
  shopping: { label: "Shopping", icon: ShoppingBag, color: "#C48A1F" },
  utilities: { label: "Utilities", icon: Zap, color: "#5C6B5D" },
};

const initialAccount = {
  accountNumber: "PF-100234",
  currency: "USD",
  balance: 4231.55,
};

const seedTransactions = [
  { _id: "t1", direction: "debit", amount: 42.1, category: "dining", merchant: "Blue Bottle Coffee", createdAt: "2026-09-13T09:22:00Z", status: "completed" },
  { _id: "t2", direction: "credit", amount: 1200.0, category: "deposit", merchant: "Payroll — Acme Inc.", createdAt: "2026-09-12T08:00:00Z", status: "completed" },
  { _id: "t3", direction: "debit", amount: 86.4, category: "groceries", merchant: "Whole Foods", createdAt: "2026-09-11T18:41:00Z", status: "completed" },
  { _id: "t4", direction: "debit", amount: 15.99, category: "subscriptions", merchant: "Spotify", createdAt: "2026-09-11T07:03:00Z", status: "completed" },
  { _id: "t5", direction: "debit", amount: 24.5, category: "transport", merchant: "Uber", createdAt: "2026-09-10T20:12:00Z", status: "completed" },
  { _id: "t6", direction: "debit", amount: 132.0, category: "shopping", merchant: "Target", createdAt: "2026-09-09T15:30:00Z", status: "completed" },
  { _id: "t7", direction: "debit", amount: 61.2, category: "utilities", merchant: "PLN Electric", createdAt: "2026-09-08T11:00:00Z", status: "completed" },
  { _id: "t8", direction: "debit", amount: 9.5, category: "dining", merchant: "Kopi Kenangan", createdAt: "2026-09-07T09:15:00Z", status: "completed" },
];

const merchants = ["Blue Bottle Coffee", "Whole Foods", "Uber", "Target", "Spotify", "Kopi Kenangan", "Shell", "PLN Electric"];
const categoryKeys = Object.keys(CATEGORY_META);

function formatMoney(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function PayFlowApp() {
  const [account, setAccount] = useState(initialAccount);
  const [transactions, setTransactions] = useState(seedTransactions);
  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMerchant, setPayMerchant] = useState(merchants[0]);
  const [payCategory, setPayCategory] = useState(categoryKeys[0]);
  const [toast, setToast] = useState(null);
  const [flash, setFlash] = useState(null);

  const spendByCategory = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const grouped = {};
    transactions.forEach((t) => {
      if (t.direction !== "debit") return;
      if (new Date(t.createdAt) < start) return;
      grouped[t.category] = (grouped[t.category] || 0) + t.amount;
    });
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const maxSpend = Math.max(...spendByCategory.map(([, v]) => v), 1);

  function submitPayment(e) {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;
    if (amount > account.balance) {
      setToast({ type: "error", text: "Insufficient funds for this payment." });
      setTimeout(() => setToast(null), 2600);
      return;
    }
    // Mirrors POST /api/transactions/payment — atomic balance decrement + txn insert
    const txn = {
      _id: "t" + Math.random().toString(36).slice(2, 9),
      direction: "debit",
      amount,
      category: payCategory,
      merchant: payMerchant,
      createdAt: new Date().toISOString(),
      status: "completed",
    };
    setTransactions((prev) => [txn, ...prev]);
    setAccount((prev) => ({ ...prev, balance: +(prev.balance - amount).toFixed(2) }));
    setShowPay(false);
    setPayAmount("");
    setFlash(txn._id);
    setToast({ type: "success", text: `Paid ${formatMoney(amount)} to ${payMerchant}` });
    setTimeout(() => setFlash(null), 1400);
    setTimeout(() => setToast(null), 2600);
  }

  return (
    <div style={styles.app}>
      <div style={styles.shell}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>PayFlow · Account {account.accountNumber}</div>
            <div style={styles.balanceLabel}>Available balance</div>
            <div style={styles.balance}>{formatMoney(account.balance)}</div>
          </div>
          <button style={styles.payButton} onClick={() => setShowPay(true)}>
            <Send size={16} strokeWidth={2.25} />
            Send payment
          </button>
        </div>

        <div style={styles.grid}>
          {/* Transaction ledger */}
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Recent activity</div>
            <div style={styles.ledger}>
              {transactions.map((t) => {
                const meta = CATEGORY_META[t.category] || { label: t.category, icon: ArrowUpRight, color: "#5C6B5D" };
                const Icon = t.category === "deposit" ? ArrowDownLeft : meta.icon;
                const isCredit = t.direction === "credit";
                return (
                  <div
                    key={t._id}
                    style={{
                      ...styles.row,
                      background: flash === t._id ? "#F1EDE2" : "transparent",
                    }}
                  >
                    <div style={{ ...styles.rowIcon, background: isCredit ? "#0F6B4C" : meta.color }}>
                      <Icon size={15} color="#FAF9F5" strokeWidth={2.25} />
                    </div>
                    <div style={styles.rowBody}>
                      <div style={styles.rowMerchant}>{t.merchant}</div>
                      <div style={styles.rowMeta}>{formatDate(t.createdAt)}</div>
                    </div>
                    <div style={{ ...styles.rowAmount, color: isCredit ? "#0F6B4C" : "#1A1A1A" }}>
                      {isCredit ? "+" : "−"}
                      {formatMoney(t.amount).replace("$", "$")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Spend breakdown */}
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Spend by category</div>
            <div style={styles.panelSub}>This month</div>
            <div style={styles.bars}>
              {spendByCategory.map(([cat, val]) => {
                const meta = CATEGORY_META[cat] || { label: cat, color: "#5C6B5D" };
                return (
                  <div key={cat} style={styles.barRow}>
                    <div style={styles.barLabelRow}>
                      <span style={styles.barLabel}>{meta.label}</span>
                      <span style={styles.barValue}>{formatMoney(val)}</span>
                    </div>
                    <div style={styles.barTrack}>
                      <div style={{ ...styles.barFill, width: `${(val / maxSpend) * 100}%`, background: meta.color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.divider} />

            <div style={styles.panelTitle}>Payment methods</div>
            <div style={styles.methodRow}>
              <div style={styles.methodChip}>VISA •••• 4242</div>
              <div style={styles.methodChip}>BCA •••• 7781</div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPay && (
        <div style={styles.overlay} onClick={() => setShowPay(false)}>
          <form style={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submitPayment}>
            <div style={styles.modalTitle}>Send payment</div>
            <label style={styles.label}>Amount</label>
            <input
              style={styles.input}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              autoFocus
            />
            <label style={styles.label}>Merchant</label>
            <select style={styles.input} value={payMerchant} onChange={(e) => setPayMerchant(e.target.value)}>
              {merchants.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <label style={styles.label}>Category</label>
            <select style={styles.input} value={payCategory} onChange={(e) => setPayCategory(e.target.value)}>
              {categoryKeys.map((c) => (
                <option key={c} value={c}>{CATEGORY_META[c].label}</option>
              ))}
            </select>
            <div style={styles.modalActions}>
              <button type="button" style={styles.cancelButton} onClick={() => setShowPay(false)}>Cancel</button>
              <button type="submit" style={styles.confirmButton}>
                Confirm <ChevronRight size={15} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ ...styles.toast, borderColor: toast.type === "error" ? "#A6432D" : "#0F6B4C" }}>
          {toast.type === "success" && <Check size={15} color="#0F6B4C" />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#EFEDE6",
    fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
    color: "#1A1A1A",
    padding: "32px 16px",
    boxSizing: "border-box",
  },
  shell: { maxWidth: 720, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    background: "#FAF9F5",
    border: "1px solid #DEDACE",
    borderRadius: 4,
    padding: "28px 28px",
    marginBottom: 16,
  },
  eyebrow: { fontSize: 12, letterSpacing: "0.02em", color: "#7A7566", marginBottom: 14, fontFamily: "'IBM Plex Mono', monospace" },
  balanceLabel: { fontSize: 13, color: "#5C574A", marginBottom: 4 },
  balance: { fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em", fontFamily: "'IBM Plex Mono', monospace" },
  payButton: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#1A1A1A", color: "#FAF9F5", border: "none",
    borderRadius: 3, padding: "12px 18px", fontSize: 14, fontWeight: 500,
    cursor: "pointer",
  },
  grid: { display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 },
  panel: { background: "#FAF9F5", border: "1px solid #DEDACE", borderRadius: 4, padding: "22px 24px" },
  panelTitle: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  panelSub: { fontSize: 12, color: "#8A8471", marginBottom: 16 },
  ledger: { display: "flex", flexDirection: "column", marginTop: 12 },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "10px 6px", borderBottom: "1px solid #EAE7DC", borderRadius: 3, transition: "background 0.3s ease" },
  rowIcon: { width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rowBody: { flex: 1, minWidth: 0 },
  rowMerchant: { fontSize: 14, fontWeight: 500 },
  rowMeta: { fontSize: 12, color: "#8A8471", marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 },
  bars: { display: "flex", flexDirection: "column", gap: 12 },
  barRow: {},
  barLabelRow: { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 },
  barLabel: { color: "#3A3626" },
  barValue: { fontFamily: "'IBM Plex Mono', monospace", color: "#5C574A" },
  barTrack: { height: 6, background: "#EAE7DC", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  divider: { height: 1, background: "#EAE7DC", margin: "20px 0 16px" },
  methodRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  methodChip: { fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", background: "#EFEDE6", border: "1px solid #DEDACE", borderRadius: 3, padding: "6px 10px" },
  overlay: { position: "fixed", inset: 0, background: "rgba(26,26,26,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#FAF9F5", borderRadius: 6, padding: 28, width: 340, boxShadow: "0 12px 40px rgba(0,0,0,0.2)" },
  modalTitle: { fontSize: 17, fontWeight: 600, marginBottom: 18 },
  label: { display: "block", fontSize: 12, color: "#5C574A", marginBottom: 6, marginTop: 14 },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 3, border: "1px solid #DEDACE", fontSize: 14, background: "#FFFFFF", fontFamily: "inherit" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 },
  cancelButton: { background: "transparent", border: "1px solid #DEDACE", borderRadius: 3, padding: "10px 16px", fontSize: 14, cursor: "pointer" },
  confirmButton: { display: "flex", alignItems: "center", gap: 6, background: "#1A1A1A", color: "#FAF9F5", border: "none", borderRadius: 3, padding: "10px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#FAF9F5", border: "1px solid", borderRadius: 4, padding: "10px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.15)" },
};
