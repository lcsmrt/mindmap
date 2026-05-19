import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/home/HomePage.js';
import { MapPage } from './pages/map/MapPage.js';

export const App = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/maps/:id" element={<MapPage />} />
  </Routes>
);

export default App;
