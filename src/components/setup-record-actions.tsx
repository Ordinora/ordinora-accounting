import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/action-menu";
export function SetupRecordActions({ editHref }: { editHref: string }) {
  return <ActionMenu ariaLabel="Record options"><Link href={editHref}><Eye size={15}/>View</Link><Link href={editHref}><Pencil size={15}/>Update</Link><Link href={`${editHref}#delete-record`} className="danger"><Trash2 size={15}/>Delete</Link></ActionMenu>;
}
