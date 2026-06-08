import { Routes, Route, Navigate } from 'react-router-dom';
import RootLayout from './components/RootLayout';
import Home from './pages/Home';
import ResearchSystemLayout from './pages/research-system/ResearchSystemLayout';
import ResearchSystemHome from './pages/research-system/ResearchSystemHome';
import Temi from './pages/research-system/Temi';
import Categorie from './pages/research-system/Categorie';
import QueryPage from './pages/research-system/Query';
import Risultati from './pages/research-system/Risultati';

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<Home />} />

        <Route path="research-system" element={<ResearchSystemLayout />}>
          <Route index element={<ResearchSystemHome />} />
          <Route path="temi" element={<Temi />} />
          <Route path="categorie" element={<Categorie />} />
          <Route path="query" element={<QueryPage />} />
          <Route path="risultati" element={<Risultati />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
