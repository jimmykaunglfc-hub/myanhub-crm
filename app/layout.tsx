import './globals.css';
import { ThemeProvider } from './context/ThemeContext';

export const metadata = {
  title: 'MyanHub CRM',
  description: 'Next-Gen Omni-Channel Social CRM Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}