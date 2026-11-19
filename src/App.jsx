import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FollowProvider } from './context/FollowContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Feed from './pages/Feed';
import Profile from './pages/Profile';

function App() {
  return (
    <AuthProvider>
      <FollowProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Feed />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:id"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </FollowProvider>
    </AuthProvider>
  );
}

export default App;