"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteJournalPermanently } from "@/app/journals/actions";

export function DeleteJournalForm({ journalId, reference }: { journalId: string; reference: string }) {
  const [confirmed, setConfirmed] = useState(false);
  return <form action={deleteJournalPermanently} className="permanent-delete-card">
    <div><span className="status-icon error"><Trash2 size={18} /></span><div><h3>Delete transaction permanently</h3><p>Completely removes this transaction, its ledger lines, its reversal pair, and its owned source record. This cannot be undone.</p></div></div>
    <input type="hidden" name="journalId" value={journalId} />
    <input type="hidden" name="confirmation" value={reference} />
    <label>Reason for deletion<input name="reason" minLength={5} maxLength={240} required placeholder="Explain why this transaction must be removed" /></label>
    <label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><strong>I understand this cannot be undone</strong><small>This will permanently delete {reference}{reference.startsWith("REV-") ? " and its original transaction" : " and any reversal paired with it"}.</small></span></label>
    <button className="button-danger" disabled={!confirmed}><Trash2 size={15} /> Delete permanently</button>
  </form>;
}
