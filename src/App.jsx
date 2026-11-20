import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FollowProvider } from './context/FollowContext';
import { SavedProvider } from './context/SavedContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import PostDetails from './pages/PostDetails';

function App() {
  return (
    <AuthProvider>
      <FollowProvider>
        <SavedProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
              <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/post/:id" element={<ProtectedRoute><PostDetails /></ProtectedRoute>} />
            </Routes>
          </BrowserRouter>
        </SavedProvider>
      </FollowProvider>
    </AuthProvider>
  );
}

export default App;