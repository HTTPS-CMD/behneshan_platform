import { redirect } from "next/navigation";

export default function ClubIndex() {
  redirect("/dashboard/owner/club/transactions");
}
