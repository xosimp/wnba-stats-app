import './globals.css';
import GlobalImagePreloader from '../components/GlobalImagePreloader';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="">
      <body className="min-h-screen">
        <GlobalImagePreloader>
          {children}
        </GlobalImagePreloader>
      </body>
    </html>
  );
}
