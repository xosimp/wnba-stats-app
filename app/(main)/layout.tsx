import { Header } from '../Header';
import { ClientLayout } from '../ClientLayout';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientLayout>
      <Header />
      <main className="min-h-screen bg-gray-900">
        {children}
      </main>
    </ClientLayout>
  );
} 