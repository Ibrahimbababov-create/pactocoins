import { redirect } from "next/navigation";

// «Мои покупки» переехал внутрь «Истории» отдельным фильтром.
export default function PurchasesRedirect() {
  redirect("/mop/history");
}
