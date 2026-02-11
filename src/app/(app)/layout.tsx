// This file is now deprecated, the logic has been moved to /src/app/[locale]/(app)/layout.tsx
// to handle authentication within the localized routes.
// It can be safely removed, but we keep it to avoid breaking changes in file structure for now.

export default function DeprecatedAppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
