import './globals.css';

export const metadata = {
  title: 'Σ Sigma Terminal Pro',
  description: 'Institutional-grade real-time financial intelligence platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>Σ</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
