import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/action-menu";
export function ContactActions({kind,id}:{kind:"customer"|"supplier";id:string}){const base=kind==="customer"?"customers":"suppliers";return <ActionMenu ariaLabel={`${kind} options`}><Link href={`/${base}/${id}/edit`}><Eye size={15}/>View</Link><Link href={`/${base}/${id}/edit`}><Pencil size={15}/>Update</Link><Link href={`/${base}/${id}/edit#delete-contact`} className="danger"><Trash2 size={15}/>Delete</Link></ActionMenu>}
