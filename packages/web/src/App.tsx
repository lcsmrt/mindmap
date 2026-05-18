import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.js';
import MapPage from './pages/MapPage.js';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/maps/:id" element={<MapPage />} />
    </Routes>
  );
}
