"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  reportingClassification: string;
  isActive: boolean;
};

export function AccountRegisterTable({ accounts, canManage, currency }: {
  accounts: AccountRow[];
  canManage: boolean;
  currency: string;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const filteredAccounts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return accounts.filter((account) => {
      const matchesSearch = !search || account.code.toLocaleLowerCase().includes(search) || account.name.toLocaleLowerCase().includes(search);
      return matchesSearch && (type === "ALL" || account.type === type);
    });
  }, [accounts, query, type]);

  return <section className="surface-card table-card">
    <div className="table-toolbar">
      <input aria-label="Search accounts" placeholder="Search code or account name" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Filter account type" value={type} onChange={(event) => setType(event.target.value)}>
        <option value="ALL">All account types</option><option value="ASSET">Assets</option><option value="LIABILITY">Liabilities</option><option value="EQUITY">Equity</option><option value="REVENUE">Revenue</option><option value="EXPENSE">Expenses</option>
      </select>
    </div>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Account name</th><th>Type</th><th>Reporting classification</th><th>Status</th>{canManage && <th>Action</th>}</tr></thead><tbody>
      {filteredAccounts.map((account) => <tr key={account.id}><td><strong>{account.code}</strong></td><td>{account.name}</td><td>{account.type}</td><td>{account.reportingClassification}</td><td><span className={`status-badge ${account.isActive ? "active" : "inactive"}`}>{account.isActive ? "ACTIVE" : "INACTIVE"}</span></td>{canManage && <td><Link className="table-action" href={`/accounts/${account.id}/edit`}>Edit</Link></td>}</tr>)}
      {!filteredAccounts.length && <tr><td colSpan={canManage ? 6 : 5} className="table-empty">No accounts match the current search and account-type filter.</td></tr>}
    </tbody></table></div>
    <footer className="table-footer"><span>{filteredAccounts.length === accounts.length ? `${accounts.length} accounts` : `${filteredAccounts.length} of ${accounts.length} accounts`}</span><span>Currency: {currency}</span></footer>
  </section>;
}
