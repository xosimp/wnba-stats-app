import { ClientLayout } from '../ClientLayout';
import { Header } from '../Header';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientLayout>
      <Header />
      {children}
    </ClientLayout>
  );
} 