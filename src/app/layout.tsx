export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This is the root layout. It should not contain any locale-specific information.
  // The main layout is in [locale]/layout.tsx.
  return children;
}
