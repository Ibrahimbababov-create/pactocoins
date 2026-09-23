import RatingClient from "@/components/RatingClient";
import { getRatingData } from "@/lib/ratingData";

export default async function AdminRating() {
  const { currentUserId, users, initialTotals } = await getRatingData();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display font-bold">Рейтинг</h1>
      <RatingClient
        currentUserId={currentUserId}
        users={users}
        initialTotals={initialTotals}
      />
    </div>
  );
}
