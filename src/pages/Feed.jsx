import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSaved } from '../context/SavedContext';
import { db } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove 
} from 'firebase/firestore';

const CATEGORIES = [
  { id: 'nacional', label: 'Nacional', icon: '🇵🇹' },
  { id: 'internacional', label: 'Internacional', icon: '🌍' },
  { id: 'famosos', label: 'Famosos', icon: '⭐' },
  { id: 'produtos', label: 'Produtos', icon: '📦' },
  { id: 'pessoas', label: 'Pessoas Comuns', icon: '👥' },
];

export default function Feed() {
  const { user, logout } = useAuth();
  const { toggleSave, isSaved } = useSaved();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [country, setCountry] = useState('PT');
  const [category, setCategory] = useState('nacional');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      await addDoc(collection(db, 'posts'), {
        text: newPost,
        author: user.displayName,
        authorPhoto: user.photoURL,
        authorId: user.uid,
        country: country,
        category: category,
        likes: [],
        createdAt: serverTimestamp(),
      });
      setNewPost('');
    } catch (error) {
      console.error("Erro ao criar post:", error);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      console.error("Erro ao apagar post:", error);
    }
  };

  const handleLike = async (postId, currentLikes) => {
    if (!user) return;
    const postRef = doc(db, 'posts', postId);
    const hasLiked = currentLikes?.includes(user.uid);

    try {
      if (hasLiked) {
        await updateDoc(postRef, { likes: arrayRemove(user.uid) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(user.uid) });
      }
    } catch (error) {
      console.error("Erro ao dar like:", error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 p-4 flex justify-between items-center sticky top-0 bg-black/90 backdrop-blur-md z-10">
        <h1 className="text-xl font-bold">Só Cusquices</h1>
        <div className="flex items-center gap-4">
          <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />
          <span className="text-sm font-medium hidden sm:block">{user.displayName}</span>
          <button onClick={logout} className="text-red-400 hover:text-red-300 font-bold text-sm">Sair</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <form onSubmit={handleCreatePost} className="mb-8 bg-gray-900 p-4 rounded-xl border border-gray-800">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder={country === 'PT' ? "O que está a cusquizar?" : "O que está a fofocar?"}
            className="w-full bg-transparent text-white placeholder-gray-500 resize-none outline-none text-lg mb-2"
            rows={2}
          />
          
          <div className="flex flex-wrap gap-4 justify-between items-center">
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => setCountry('PT')}
                className={`px-3 py-1 rounded-lg text-xl transition ${country === 'PT' ? 'bg-gray-700 ring-2 ring-blue-500' : 'bg-gray-800 opacity-50 hover:opacity-100'}`}
              >
                🇵🇹
              </button>
              <button
                type="button"
                onClick={() => setCountry('BR')}
                className={`px-3 py-1 rounded-lg text-xl transition ${country === 'BR' ? 'bg-gray-700 ring-2 ring-green-500' : 'bg-gray-800 opacity-50 hover:opacity-100'}`}
              >
                🇧🇷
              </button>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1 outline-none border border-gray-700"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <button 
              type="submit" 
              disabled={!newPost.trim()}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-full transition"
            >
              {country === 'PT' ? 'Cusquizar' : 'Fofocar'}
            </button>
          </div>
        </form>

        {loading ? (
          <p className="text-center text-gray-500">A carregar...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-gray-500">Ainda não há cusquices. Sê o primeiro!</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const hasLiked = post.likes?.includes(user.uid);
              const catInfo = CATEGORIES.find(c => c.id === post.category);
              return (
                <div key={post.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition">
                  <div className="flex items-start gap-3">
                    <img src={post.authorPhoto} alt={post.author} className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <Link to={`/profile/${post.authorId}`} className="font-bold text-white hover:underline">
                            {post.author}
                          </Link>
                          <span className="text-lg mx-2">{post.country === 'PT' ? '🇵🇹' : '🇧🇷'}</span>
                          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                            {catInfo?.icon} {catInfo?.label || 'Geral'}
                          </span>
                          <span className="text-gray-500 text-sm ml-2">
                            {post.createdAt?.toDate().toLocaleString('pt-PT') || 'Agora'}
                          </span>
                        </div>
                        {post.authorId === user.uid && (
                          <button 
                            onClick={() => handleDeletePost(post.id)}
                            className="text-gray-500 hover:text-red-500 text-sm transition"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      <p className="text-gray-200 mt-2 whitespace-pre-wrap">{post.text}</p>
                      
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <button 
                          onClick={() => handleLike(post.id, post.likes)}
                          className={`flex items-center gap-1 transition ${hasLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-400'}`}
                        >
                          {hasLiked ? '❤️' : '🤍'} {post.likes?.length || 0}
                        </button>

                        <Link to={`/post/${post.id}`} className="flex items-center gap-1 text-gray-500 hover:text-blue-400 transition">
                          💬 Comentar
                        </Link>

                        <button 
                          onClick={() => toggleSave(post.id)}
                          className={`flex items-center gap-1 transition ${isSaved(post.id) ? 'text-yellow-500' : 'text-gray-500 hover:text-yellow-400'}`}
                        >
                          📌 {isSaved(post.id) ? 'Guardado' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}