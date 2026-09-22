import { redirect } from "next/navigation";

// Сообщения жили по двум адресам (/messages и /mop/messages) — оставили
// один канонический (/messages, у него ещё есть анонимные сообщения),
// этот превратили в редирект, чтобы старые ссылки не давали 404.
export default function MopMessagesRedirect() {
  redirect("/messages");
}
