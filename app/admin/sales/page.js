import SalesPage from "@/components/SalesPage";

// Аналитика отделов продаж (таблицы оплат из Google). Кто что видит —
// lib/sales/access.js.
export default function Page({ searchParams }) {
  return <SalesPage searchParams={searchParams} basePath="/admin/sales" />;
}
