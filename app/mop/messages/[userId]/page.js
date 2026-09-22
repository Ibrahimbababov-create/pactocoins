import { redirect } from "next/navigation";

export default function MopMessageThreadRedirect({ params }) {
  redirect(`/messages/${params.userId}`);
}
