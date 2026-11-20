import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFollow } from '../context/FollowContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toggleFollow, isFollowing } = useFollow();
  const [posts, setPosts] = useState([]);
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const following = isFollowing(id);

  useEffect(() => {
  const q = query(
  collection(db, 'posts'),
  where('authorId', '==', id)
);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
      if (postsData.length > 0) {
        setProfileUser(postsData[0].author);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  if (loading) return <div className="text-center text-gray-500 mt-10">A carregar perfil...</div>;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 p-4 flex items-center gap-4 sticky top-0 bg-black/90 backdrop-blur-md z-10">
        <Link to="/" className="text-2xl">←</Link>
        <h1 className="text-xl font-bold">Perfil</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-6 text-center">
          <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold">
            {profileUser ? profileUser.charAt(0) : '?'}
          </div>
          <h2 className="text-2xl font-bold">{profileUser || 'Utilizador'}</h2>
          <p className="text-gray-500 text-sm mt-2">{posts.length} cusquices</p>
          
          {user && user.uid !== id && (
            <button
              onClick={() => toggleFollow(id)}
              className={`mt-4 px-6 py-2 rounded-full font-bold transition ${
                following ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {following ? 'A Seguir' : 'Seguir'}
            </button>
          )}
        </div>

        <h3 className="text-lg font-bold mb-4">Posts</h3>
        {posts.length === 0 ? (
          <p className="text-gray-500 text-center">Este utilizador ainda não publicou nada.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                <p className="text-gray-200 whitespace-pre-wrap">{post.text}</p>
                <p className="text-gray-500 text-xs mt-2">
                  {post.createdAt?.toDate().toLocaleString('pt-PT')}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}