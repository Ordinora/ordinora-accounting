import Link from "next/link";
import { Eye, Pencil, Trash2, Undo2 } from "lucide-react";
import { ActionMenu } from "@/components/action-menu";

export function TransactionActions({ id, source, status, periodOpen }: { id: string; source: string; status: string; periodOpen: boolean }) {
  const canEdit = source === "MANUAL" && status !== "REVERSED" && periodOpen;
  return <ActionMenu><Link href={`/journals/${id}`}><Eye size={15} />View</Link>{canEdit && <Link href={`/journals/${id}/edit`}><Pencil size={15} />Update</Link>}{status === "POSTED" && <Link href={`/journals/${id}#reverse-transaction`}><Undo2 size={15} />Reverse</Link>}{periodOpen && <Link href={`/journals/${id}#delete-transaction`} className="danger"><Trash2 size={15} />Delete</Link>}</ActionMenu>;
}
