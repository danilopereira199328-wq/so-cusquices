import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFollow } from '../context/FollowContext';
import { db, storage } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import PostCard from '../components/PostCard';
import CommentsSection from '../components/CommentsSection';

export default function Profile() {
  const { id } = useParams();
  console.log('ENTROU NO PROFILE COM ID:', id);

  const { user } = useAuth();
  const { toggleFollow, isFollowing, following: myFollowing } = useFollow();

  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [profileData, setProfileData] = useState({ name: null, photo: null, bio: '' });
  const [followersCount, setFollowersCount] = useState(0);
  const [activeTab, setActiveTab] = useState('posts');
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [loading, setLoading] = useState(true);

  const following = isFollowing(id);
  const isOwnProfile = user?.uid === id;

  useEffect(() => {
    setLoading(true);
    setActiveTab('posts');
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const userDocRef = doc(db, 'users', id);
    let unsubAllPosts = null;

    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (unsubAllPosts) {
        unsubAllPosts();
        unsubAllPosts = null;
      }

      if (snap.exists()) {
        const data = snap.data();
        setProfileData((prev) => ({ ...prev, bio: data.bio || '' }));
        setBioInput(data.bio || '');

        if (isOwnProfile && data.bookmarks?.length) {
          const qAll = query(collection(db, 'posts'));
          unsubAllPosts = onSnapshot(qAll, (allSnap) => {
            const matched = allSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((p) => data.bookmarks.includes(p.id))
              .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setSavedPosts(matched);
          });
        } else {
          setSavedPosts([]);
        }
      } else {
        setProfileData((prev) => ({ ...prev, bio: '' }));
        setBioInput('');
        setSavedPosts([]);
      }
    });

    return () => {
      unsubscribe();
      if (unsubAllPosts) unsubAllPosts();
    };
  }, [id, isOwnProfile]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'posts'), where('authorId', '==', id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

      setPosts(postsData);

      if (postsData.length > 0) {
        setProfileData((prev) => ({
          ...prev,
          name: postsData[0].author,
          photo: postsData[0].authorPhoto,
        }));
      } else if (isOwnProfile && user) {
        setProfileData((prev) => ({
          ...prev,
          name: user.displayName,
          photo: user.photoURL,
        }));
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, isOwnProfile, user]);

  useEffect(() => {
    if (!id) return;
    const qLikes = query(collection(db, 'posts'), where('likes', 'array-contains', id));
    const unsubscribe = onSnapshot(qLikes, (snapshot) => {
      const liked = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setLikedPosts(liked);
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const qFollowers = query(
      collection(db, 'follows'),
      where('following', 'array-contains', id)
    );
    const unsubscribe = onSnapshot(qFollowers, (snapshot) => {
      setFollowersCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [id]);

  const handleSaveBio = async () => {
    if (!isOwnProfile || !user) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { bio: bioInput.trim() },
        { merge: true }
      );
      setEditingBio(false);
    } catch (error) {
      console.error('Erro ao guardar bio:', error);
    }
  };

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

  const handleDeletePost = async (post) => {
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      if (post.storagePath) {
        await deleteObject(ref(storage, post.storagePath)).catch(() => {});
      }
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

  const displayedPosts =
    activeTab === 'posts'
      ? posts
      : activeTab === 'likes'
      ? likedPosts
      : savedPosts;

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

          {editingBio ? (
            <div className="mt-3 max-w-md mx-auto space-y-2">
              <textarea
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value.slice(0, 160))}
                placeholder="Escreve algo sobre ti..."
                rows={2}
                className="w-full bg-gray-800 text-sm text-white rounded-lg p-2 outline-none border border-gray-700 focus:border-blue-500"
              />
              <div className="flex justify-center gap-2">
                <button
                  onClick={handleSaveBio}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingBio(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-4 py-1.5 rounded-full"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              {profileData.bio ? (
                <p className="text-gray-300 text-sm max-w-md mx-auto">{profileData.bio}</p>
              ) : isOwnProfile ? (
                <p className="text-gray-500 text-xs italic">Ainda sem biografia.</p>
              ) : null}

              {isOwnProfile && (
                <button
                  onClick={() => setEditingBio(true)}
                  className="mt-2 text-xs text-blue-400 hover:underline"
                >
                  ✏️ Editar bio
                </button>
              )}
            </div>
          )}

          <div className="flex justify-center gap-6 text-sm text-gray-400 mt-4">
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

        <div className="flex gap-2 mb-4 border-b border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
              activeTab === 'posts'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Cusquices ({posts.length})
          </button>
          <button
            onClick={() => setActiveTab('likes')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
              activeTab === 'likes'
                ? 'bg-red-500/20 text-red-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ❤️ Gostos ({likedPosts.length})
          </button>
          {isOwnProfile && (
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                activeTab === 'saved'
                  ? 'bg-yellow-500/20 text-yellow-300'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🔖 Guardados ({savedPosts.length})
            </button>
          )}
        </div>

        {displayedPosts.length === 0 ? (
          <p className="text-gray-500 text-center py-6">
            Nenhuma publicação neste separador.
          </p>
        ) : (
          <div className="space-y-4">
            {displayedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onDelete={isOwnProfile && activeTab === 'posts' ? handleDeletePost : undefined}
                showAuthor={activeTab !== 'posts'}
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