import { matchesName } from "@/lib/translit";

// Одобренные покупки месяца (в очереди и отклонённые сюда не попадают).
export const MONEY_STATUSES = ["approved", "done"];

export async function fetchMonthPurchases(admin, range) {
  const { data } = await admin
    .from("purchase_requests")
    .select(
      "id, created_at, status, price_coins, kzt_amount, actual_kzt_amount, variant_label, user_id, users!purchase_requests_user_id_fkey(name, is_active), reviewer:users!purchase_requests_reviewed_by_fkey(name), rewards(title)"
    )
    .in("status", MONEY_STATUSES)
    .gte("created_at", range.start)
    .lt("created_at", range.end)
    .order("created_at", { ascending: false })
    .limit(2000);
  return data ?? [];
}

export function filterPurchases(rows, nameQuery = "", rewardQuery = "") {
  const n = String(nameQuery ?? "").trim();
  const r = String(rewardQuery ?? "").trim().toLowerCase();
  return rows.filter((p) => {
    if (n && !matchesName(p.users?.name ?? "", n)) return false;
    if (r && !`${p.rewards?.title ?? ""} ${p.variant_label ?? ""}`.toLowerCase().includes(r)) {
      return false;
    }
    return true;
  });
}

export function purchaseTotals(rows) {
  let coins = 0;
  let fact = 0;
  let estimate = 0;
  let estimateCount = 0;
  let bothEstimate = 0;
  let bothFact = 0;
  let bothCount = 0;
  for (const p of rows) {
    coins += p.price_coins ?? 0;
    const hasFact = p.actual_kzt_amount != null;
    const est = p.kzt_amount ?? 0;
    if (hasFact) {
      fact += p.actual_kzt_amount;
      if (est > 0) {
        bothEstimate += est;
        bothFact += p.actual_kzt_amount;
        bothCount += 1;
      }
    } else if (est > 0) {
      estimate += est;
      estimateCount += 1;
    }
  }
  return {
    count: rows.length,
    coins,
    fact,
    estimate,
    estimateCount,
    total: fact + estimate,
    bothCount,
    // плюс: заплатили меньше, чем оценивали
    diff: bothEstimate - bothFact,
  };
}
