"use client";
import Link from "next/link";
import { useState } from "react";
import { AutoReferenceField } from "@/components/auto-reference-field";
type Option = { id: string; code: string; name: string };
export function TransferForm({ action, accounts, currencies, defaultCurrency }: { action: (data: FormData) => Promise<void>; accounts: Option[]; currencies: string[]; defaultCurrency: string }) {
  const [sourceAccount, setSourceAccount] = useState(""), [destinationAccount, setDestinationAccount] = useState("");
  const [sourceCurrency, setSourceCurrency] = useState(defaultCurrency), [destinationCurrency, setDestinationCurrency] = useState(defaultCurrency);
  const [sourceAmount, setSourceAmount] = useState(""), [destinationAmount, setDestinationAmount] = useState("");
  const sameCurrency = sourceCurrency === destinationCurrency;
  const changeSourceAmount = (value: string) => { setSourceAmount(value); if (sameCurrency) setDestinationAmount(value); };
  return <form action={action} className="form-panel"><section className="form-section"><div className="section-heading"><h2>Inter-account transfer</h2><p>Move money between two cash or bank accounts. The transfer date selects the accounting period automatically.</p></div><div className="form-grid">
    <label>Transfer date <em>*</em><input name="transferDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
    <AutoReferenceField example="TRF-2026-0001" />
    <label className="span-2">Description<input name="description" placeholder="Petty cash funding, payroll account transfer, or other purpose" /></label>
  </div></section><section className="form-section"><div className="section-heading"><h2>Money transferred</h2><p>For different currencies, enter the actual amount leaving and the actual amount received.</p></div><div className="form-grid">
    <label>Paid from <em>*</em><select name="sourceAccountId" value={sourceAccount} onChange={(event) => setSourceAccount(event.target.value)} required><option value="">Select source account</option>{accounts.filter((account) => account.id !== destinationAccount).map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
    <label>Source currency <em>*</em><select name="sourceCurrency" value={sourceCurrency} onChange={(event) => { setSourceCurrency(event.target.value); if (event.target.value === destinationCurrency) setDestinationAmount(sourceAmount); }}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
    <label>Amount paid <em>*</em><input name="sourceAmount" inputMode="decimal" value={sourceAmount} onChange={(event) => changeSourceAmount(event.target.value)} placeholder="0.00" required /></label>
    <span />
    <label>Received in <em>*</em><select name="destinationAccountId" value={destinationAccount} onChange={(event) => setDestinationAccount(event.target.value)} required><option value="">Select destination account</option>{accounts.filter((account) => account.id !== sourceAccount).map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
    <label>Destination currency <em>*</em><select name="destinationCurrency" value={destinationCurrency} onChange={(event) => { setDestinationCurrency(event.target.value); if (event.target.value === sourceCurrency) setDestinationAmount(sourceAmount); }}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
    <label>Amount received <em>*</em><input name="destinationAmount" inputMode="decimal" value={sameCurrency ? sourceAmount : destinationAmount} onChange={(event) => setDestinationAmount(event.target.value)} readOnly={sameCurrency} placeholder="0.00" required /></label>
  </div><div className="document-total"><span>From <strong>{sourceCurrency} {Number(sourceAmount || 0).toFixed(2)}</strong></span><span className="grand-total">Received <strong>{destinationCurrency} {Number((sameCurrency ? sourceAmount : destinationAmount) || 0).toFixed(2)}</strong></span></div></section><div className="form-actions"><Link href="/transfers" className="button-secondary">Cancel</Link><button className="button-primary">Post transfer</button></div></form>;
}
