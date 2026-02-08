import { AuthForm } from "@/components/auth/auth-form";

// This page is deprecated and will be removed. 
// The localized version at /src/app/[locale]/(auth)/login/page.tsx should be used instead.
export default function LoginPage() {
  return <AuthForm type="login" />;
}
