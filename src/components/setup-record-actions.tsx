import Link from "next/link";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
export function SetupRecordActions({ editHref }: { editHref: string }) {
  return <details className="transaction-actions"><summary aria-label="Record options" title="Record options"><MoreHorizontal size={19}/></summary><div className="transaction-action-menu"><Link href={editHref}><Eye size={15}/>View</Link><Link href={editHref}><Pencil size={15}/>Update</Link><Link href={`${editHref}#delete-record`} className="danger"><Trash2 size={15}/>Delete</Link></div></details>;
}
