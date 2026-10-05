"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Gate } from "@/components/ui";
import { STAFF } from "@/lib/roles";
import ProfileEditor from "@/components/profile/ProfileEditor";

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Gate roles={STAFF}>
      <Link href="/people" className="text-sm text-indigo underline focus-ring">← All people</Link>
      <div className="mt-4"><ProfileEditor uid={id} /></div>
    </Gate>
  );
}
