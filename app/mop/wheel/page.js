import { redirect } from "next/navigation";

// Колесо переехало во вкладку «Игры» (там же будущие мини-игры и сундук дня).
export default function WheelRedirect() {
  redirect("/mop/games");
}
