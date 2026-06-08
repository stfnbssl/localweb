import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';

export default function RootLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navigation />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
