import { AuthForm } from "@/components/auth/auth-form";

// This page is deprecated and will be removed. 
// The localized version at /src/app/[locale]/(auth)/signup/page.tsx should be used instead.
export default function SignupPage() {
  return <AuthForm type="signup" />;
}
