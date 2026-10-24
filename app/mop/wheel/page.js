import { redirect } from "next/navigation";

// Колесо живёт внутри вкладки «Игры»: /mop/games/wheel.
export default function WheelRedirect() {
  redirect("/mop/games/wheel");
}
