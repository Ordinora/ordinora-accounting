import Link from "next/link";
import { Eye, MoreHorizontal, Pencil, Trash2, Undo2 } from "lucide-react";

export function TransactionActions({ id, source, status, periodOpen }: { id: string; source: string; status: string; periodOpen: boolean }) {
  const canEdit = source === "MANUAL" && status !== "REVERSED" && periodOpen;
  return <details className="transaction-actions"><summary aria-label="Transaction options" title="Transaction options"><MoreHorizontal size={19} /></summary><div className="transaction-action-menu"><Link href={`/journals/${id}`}><Eye size={15} />View</Link>{canEdit && <Link href={`/journals/${id}/edit`}><Pencil size={15} />Update</Link>}{status === "POSTED" && <Link href={`/journals/${id}#reverse-transaction`}><Undo2 size={15} />Reverse</Link>}{periodOpen && <Link href={`/journals/${id}#delete-transaction`} className="danger"><Trash2 size={15} />Delete</Link>}</div></details>;
}
