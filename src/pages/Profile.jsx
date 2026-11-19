import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFollow } from '../context/FollowContext';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import PostCard from '../components/PostCard';
import CommentsSection from '../components/CommentsSection';

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toggleFollow, isFollowing, following: myFollowing } = useFollow();

  const [posts, setPosts] = useState([]);
  const [profileData, setProfileData] = useState({ name: null, photo: null });
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const following = isFollowing(id);
  const isOwnProfile = user?.uid === id;

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('authorId', '==', id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

      setPosts(postsData);

      if (postsData.length > 0) {
        setProfileData({
          name: postsData[0].author,
          photo: postsData[0].authorPhoto,
        });
      } else if (isOwnProfile && user) {
        setProfileData({
          name: user.displayName,
          photo: user.photoURL,
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, isOwnProfile, user]);

  useEffect(() => {
    const qFollowers = query(
      collection(db, 'follows'),
      where('following', 'array-contains', id)
    );
    const unsubscribe = onSnapshot(qFollowers, (snapshot) => {
      setFollowersCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [id]);

  const handleLike = async (postId, currentLikes) => {
    if (!user) return;
    const postRef = doc(db, 'posts', postId);
    const hasLiked = currentLikes?.includes(user.uid);
    try {
      await updateDoc(postRef, {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (error) {
      console.error('Erro ao dar like:', error);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      console.error('Erro ao apagar post:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-center text-gray-500 pt-10">
        A carregar perfil...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 p-4 flex items-center gap-4 sticky top-0 bg-black/90 backdrop-blur-md z-10">
        <Link to="/" className="text-2xl hover:text-gray-300 transition">
          ←
        </Link>
        <h1 className="text-xl font-bold">{profileData.name || 'Perfil'}</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-6 text-center">
          {profileData.photo ? (
            <img
              src={profileData.photo}
              alt={profileData.name}
              className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-2 border-gray-700"
            />
          ) : (
            <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold">
              {profileData.name ? profileData.name.charAt(0) : '?'}
            </div>
          )}

          <h2 className="text-2xl font-bold">{profileData.name || 'Utilizador'}</h2>

          <div className="flex justify-center gap-6 text-sm text-gray-400 mt-3">
            <span>
              <strong className="text-white">{posts.length}</strong> cusquices
            </span>
            <span>
              <strong className="text-white">{followersCount}</strong> seguidores
            </span>
            {isOwnProfile && (
              <span>
                <strong className="text-white">{myFollowing.length}</strong> a seguir
              </span>
            )}
          </div>

          {user && !isOwnProfile && (
            <button
              onClick={() => toggleFollow(id)}
              className={`mt-4 px-6 py-2 rounded-full font-bold transition ${
                following
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {following ? 'A Seguir' : 'Seguir'}
            </button>
          )}
        </div>

        <h3 className="text-lg font-bold mb-4">Publicações</h3>
        {posts.length === 0 ? (
          <p className="text-gray-500 text-center">
            Este utilizador ainda não publicou nada.
          </p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onDelete={isOwnProfile ? handleDeletePost : undefined}
                showAuthor={false}
              >
                <CommentsSection postId={post.id} />
              </PostCard>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}