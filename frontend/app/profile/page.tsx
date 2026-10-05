"use client";
import { Gate, PageHeader } from "@/components/ui";
import ProfileEditor from "@/components/profile/ProfileEditor";

export default function MyProfilePage() {
  return (
    <Gate>
      <PageHeader title="My profile" subtitle="Personal details, institution, training history, skills and documents." />
      <ProfileEditor uid="me" />
    </Gate>
  );
}
