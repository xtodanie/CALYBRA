import { redirect } from "next/navigation";

// This page is deprecated and will be removed. 
// The localized version at /src/app/[locale]/(auth)/signup/page.tsx should be used instead.
export default function SignupPage() {
  redirect("/es/signup");
}
