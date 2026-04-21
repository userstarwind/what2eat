import './App.css'
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import FoodList from './components/FoodList';
import FoodCreate from './components/FoodCreate';
import FoodShow from './components/FoodShow';
import FoodEdit from './components/FoodEdit';
import RecommendationForm from './components/RecommendationForm';
import RecommendationResult from './components/RecommendationResult';
import RecommendationHistoryList from './components/RecommendationHistoryList';
import RecommendationHistoryShow from './components/RecommendationHistoryShow';
import HelpPage from './pages/HelpPage';
import AboutPage from './pages/AboutPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<HomePage />}>
        <Route index element={<Navigate to="all" replace />} />
        <Route path="all">
          <Route index element={<FoodList />} />
          <Route path="new" element={<FoodCreate />} />
          <Route path=":foodId" element={<FoodShow />} />
          <Route path=":foodId/edit" element={<FoodEdit />} />
        </Route>
        <Route path="favorites">
          <Route index element={<FoodList />} />
          <Route path="new" element={<FoodCreate />} />
          <Route path=":foodId" element={<FoodShow />} />
          <Route path=":foodId/edit" element={<FoodEdit />} />
        </Route>
        <Route path="recycle">
          <Route index element={<FoodList />} />
          <Route path="new" element={<FoodCreate />} />
          <Route path=":foodId" element={<FoodShow />} />
          <Route path=":foodId/edit" element={<FoodEdit />} />
        </Route>
        <Route path="recommend" element={<RecommendationForm />} />
        <Route path="recommend/results" element={<RecommendationResult />} />
        <Route path="history">
          <Route index element={<RecommendationHistoryList />} />
          <Route path=":historyId" element={<RecommendationHistoryShow />} />
        </Route>
        <Route path="about" element={<AboutPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
