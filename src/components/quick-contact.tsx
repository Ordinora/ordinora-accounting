"use client";

import { UserPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createQuickContact, type QuickContact, type ContactKind } from "@/app/contacts/actions";

export function QuickContactButton({kind,onCreated}:{kind:ContactKind;onCreated:(contact:QuickContact)=>void}){
 const[open,setOpen]=useState(false),[error,setError]=useState(""),[pending,startTransition]=useTransition();
 const[values,setValues]=useState({code:"",name:"",email:"",phone:"",address:"",paymentTermsDays:"30"});
 const title=kind==="customer"?"customer":"supplier";
 const update=(field:keyof typeof values,value:string)=>setValues(current=>({...current,[field]:value}));
 const close=()=>{if(!pending){setOpen(false);setError("")}};
 const create=()=>{setError("");startTransition(async()=>{try{
  const contact=await createQuickContact(kind,{...values,paymentTermsDays:Number(values.paymentTermsDays)});
  onCreated(contact);setValues({code:"",name:"",email:"",phone:"",address:"",paymentTermsDays:"30"});setOpen(false);
 }catch(reason){setError(reason instanceof Error?reason.message:`Unable to create the ${title}.`)}})};
 return <><button type="button" className="button-secondary quick-contact-trigger" onClick={()=>setOpen(true)}><UserPlus size={16}/>Quick add {title}</button>{open&&<div className="quick-inventory-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="quick-inventory-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-contact-title"><div className="quick-inventory-title"><div><h2 id="quick-contact-title">Quick {title} registration</h2><p>Create and select the missing {title} without losing this invoice.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={close}><X size={18}/></button></div>{error&&<div className="form-error" role="alert">{error}</div>}<div className="form-grid"><label>{kind==="customer"?"Customer":"Supplier"} code<input value={values.code} onChange={event=>update("code",event.target.value)} placeholder={kind==="customer"?"CUS-001":"SUP-001"}/></label><label>Name<input value={values.name} onChange={event=>update("name",event.target.value)}/></label><label>Email<input type="email" value={values.email} onChange={event=>update("email",event.target.value)}/></label><label>Phone<input value={values.phone} onChange={event=>update("phone",event.target.value)}/></label><label>Payment terms (days)<input type="number" min="0" max="365" value={values.paymentTermsDays} onChange={event=>update("paymentTermsDays",event.target.value)}/></label><label className="span-2">Address<input value={values.address} onChange={event=>update("address",event.target.value)}/></label></div><div className="form-actions"><button type="button" className="button-secondary" onClick={close}>Cancel</button><button type="button" className="button-primary" disabled={pending||!values.code.trim()||values.name.trim().length<2} onClick={create}>{pending?"Creating…":`Create and select ${title}`}</button></div></section></div>}</>;
}
