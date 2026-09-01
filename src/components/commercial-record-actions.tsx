import Link from "next/link";
import { Eye,Landmark,Pencil,Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/action-menu";
export function CommercialRecordActions({kind,id,journalId}:{kind:"sale"|"purchase";id:string;journalId:string|null}){const base=kind==="sale"?"sales":"purchases";return <ActionMenu><Link href={`/${base}/${id}/edit`}><Eye size={15}/>View</Link><Link href={`/${base}/${id}/edit`}><Pencil size={15}/>Update</Link>{kind==="purchase"&&<Link href={`/purchases/${id}/fixed-assets`}><Landmark size={15}/>Register fixed asset</Link>}{journalId&&<Link href={`/journals/${journalId}#delete-transaction`} className="danger"><Trash2 size={15}/>Delete</Link>}</ActionMenu>}
