import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { user, loginWithGoogle } = useAuth();

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black px-4">
      <h1 className="text-5xl font-bold text-white mb-4">Só Cusquices</h1>
      <p className="text-gray-400 mb-8">A rede social onde a fofoca é lei.</p>
       <p className="text-gray-400 mb-8">No Brasil é Fofoca.</p>
      <button
        onClick={loginWithGoogle}
        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full transition"
      >
        Entrar com Google
      </button>
    </div>
  );
}