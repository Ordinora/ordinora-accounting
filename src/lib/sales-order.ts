import { SalesOrderStatus } from "@prisma/client";

const transitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["READY_TO_INVOICE", "CANCELLED"],
  READY_TO_INVOICE: ["CONVERTED", "CANCELLED"],
  CONVERTED: [], CANCELLED: [],
};

export function assertSalesOrderTransition(from: SalesOrderStatus, to: SalesOrderStatus) {
  if (!transitions[from].includes(to)) throw new Error(`A ${from.toLowerCase()} sales order cannot be changed to ${to.toLowerCase()}.`);
}
