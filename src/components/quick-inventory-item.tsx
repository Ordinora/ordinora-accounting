"use client";

import { PackagePlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createQuickInventoryItem } from "@/app/inventory/actions";

export type InventoryMappingAccount={id:string;code:string;name:string;type:string};
export type QuickInventoryItem={id:string;sku:string;name:string;revenueAccountId:string;inventoryAccountId:string;cogsAccountId:string};

export function QuickInventoryItemButton({accounts,onCreated}:{accounts:InventoryMappingAccount[];onCreated:(item:QuickInventoryItem)=>void}){
 const[open,setOpen]=useState(false),[error,setError]=useState(""),[pending,startTransition]=useTransition();
 const[values,setValues]=useState({sku:"",name:"",description:"",unitName:"unit",inventoryAccountId:"",revenueAccountId:"",cogsAccountId:""});
 const update=(field:keyof typeof values,value:string)=>setValues(current=>({...current,[field]:value}));
 const close=()=>{if(!pending){setOpen(false);setError("")}};
 const create=()=>{
  setError("");
  startTransition(async()=>{
   try{
    const item=await createQuickInventoryItem(values);
    onCreated(item);
    setValues({sku:"",name:"",description:"",unitName:"unit",inventoryAccountId:"",revenueAccountId:"",cogsAccountId:""});
    setOpen(false);
   }catch(reason){
    setError(reason instanceof Error?reason.message:"Unable to create the inventory item.");
   }
  });
 };
 const assets=accounts.filter(account=>account.type==="ASSET"),revenue=accounts.filter(account=>account.type==="REVENUE"),expenses=accounts.filter(account=>account.type==="EXPENSE");
 return <><button type="button" className="button-secondary quick-inventory-trigger" onClick={()=>setOpen(true)}><PackagePlus size={16}/>Quick add inventory item</button>{open&&<div className="quick-inventory-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="quick-inventory-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-item-title"><div className="quick-inventory-title"><div><h2 id="quick-item-title">Quick inventory registration</h2><p>Create the missing item without losing the transaction you are entering.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={close}><X size={18}/></button></div>{error&&<div className="form-error" role="alert">{error}</div>}<div className="form-grid"><label>SKU / item code<input value={values.sku} onChange={event=>update("sku",event.target.value)} placeholder="ITEM-001"/></label><label>Item name<input value={values.name} onChange={event=>update("name",event.target.value)}/></label><label>Unit of measure<input value={values.unitName} onChange={event=>update("unitName",event.target.value)}/></label><label className="span-2">Description<input value={values.description} onChange={event=>update("description",event.target.value)}/></label><label>Inventory asset account<select value={values.inventoryAccountId} onChange={event=>update("inventoryAccountId",event.target.value)}><option value="">Select asset account</option>{assets.map(account=><option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label><label>Sales revenue account<select value={values.revenueAccountId} onChange={event=>update("revenueAccountId",event.target.value)}><option value="">Select revenue account</option>{revenue.map(account=><option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label><label>Cost-of-sales account<select value={values.cogsAccountId} onChange={event=>update("cogsAccountId",event.target.value)}><option value="">Select expense account</option>{expenses.map(account=><option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label></div><div className="form-actions"><button type="button" className="button-secondary" onClick={close}>Cancel</button><button type="button" className="button-primary" disabled={pending||!values.sku.trim()||values.name.trim().length<2||!values.unitName.trim()||!values.inventoryAccountId||!values.revenueAccountId||!values.cogsAccountId} onClick={create}>{pending?"Creating…":"Create and select item"}</button></div></section></div>}</>;
}
