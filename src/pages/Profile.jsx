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
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import PostCard from '../components/PostCard';
import CommentsSection from '../components/CommentsSection';
import NotificationsBell, { createNotification } from '../components/NotificationsBell';

function isValidImageUrl(value) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toggleFollow, isFollowing, following: myFollowing } = useFollow();

  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [profileData, setProfileData] = useState({
    name: null,
    photo: null,
    bio: '',
    followersCount: 0,
    followingCount: 0,
  });
  const [activeTab, setActiveTab] = useState('posts');

  // Edição de bio
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [savingBio, setSavingBio] = useState(false);

  // Edição de foto por URL
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [photoInput, setPhotoInput] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);

  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [loading, setLoading] = useState(true);

  const following = isFollowing(id);
  const isOwnProfile = Boolean(user?.uid && user.uid === id);

  useEffect(() => {
    setLoading(true);
    setActiveTab('posts');
    setEditingPhoto(false);
    setPhotoError('');
  }, [id]);

  // Sincronizar dados básicos de imediato no próprio perfil
  useEffect(() => {
    if (isOwnProfile && user) {
      setProfileData((prev) => ({
        ...prev,
        name: prev.name || user.displayName || 'Utilizador',
        photo: prev.photo || user.photoURL || null,
      }));
    }
  }, [isOwnProfile, user]);

  // Ouvir documento do utilizador (bio, bookmarks, customPhotoURL, contadores denormalizados)
  useEffect(() => {
    if (!id) return;
    const userDocRef = doc(db, 'users', id);
    let unsubAllPosts = null;

    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (unsubAllPosts) {
          unsubAllPosts();
          unsubAllPosts = null;
        }

        if (snap.exists()) {
          const data = snap.data();
          setProfileData((prev) => ({
            ...prev,
            name: data.displayName || prev.name,
            photo: data.customPhotoURL || prev.photo,
            bio: data.bio || '',
            followersCount: Math.max(0, data.followersCount ?? 0),
            followingCount: Math.max(0, data.followingCount ?? 0),
          }));
          setBioInput(data.bio || '');
          setPhotoInput(data.customPhotoURL || '');

          if (isOwnProfile && data.bookmarks?.length) {
            const qAll = query(collection(db, 'posts'));
            unsubAllPosts = onSnapshot(
              qAll,
              (allSnap) => {
                const matched = allSnap.docs
                  .map((d) => ({ id: d.id, ...d.data() }))
                  .filter((p) => data.bookmarks.includes(p.id))
                  .sort(
                    (a, b) =>
                      (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
                  );
                setSavedPosts(matched);
              },
              (error) => {
                console.error('Erro ao carregar guardados do perfil:', error);
              }
            );
          } else {
            setSavedPosts([]);
          }
        } else {
          setProfileData((prev) => ({
            ...prev,
            bio: '',
            followersCount: 0,
            followingCount: 0,
          }));
          setBioInput('');
          setPhotoInput('');
          setSavedPosts([]);
        }
      },
      (error) => {
        console.error('Erro ao ouvir dados do perfil:', error);
      }
    );

    return () => {
      unsubscribe();
      if (unsubAllPosts) unsubAllPosts();
    };
  }, [id, isOwnProfile]);

  // Ouvir publicações do utilizador (com fallback e tratamento de erro)
  useEffect(() => {
    if (!id) return;

    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const q = query(collection(db, 'posts'), where('authorId', '==', id));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        clearTimeout(fallbackTimer);
        const postsData = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) =>
              (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
          );

        setPosts(postsData);

        if (postsData.length > 0) {
          setProfileData((prev) => ({
            ...prev,
            name: prev.name || postsData[0].author,
            photo: prev.photo || postsData[0].authorPhoto,
          }));
        } else if (isOwnProfile && user) {
          setProfileData((prev) => ({
            ...prev,
            name: prev.name || user.displayName,
            photo: prev.photo || user.photoURL,
          }));
        }
        setLoading(false);
      },
      (error) => {
        clearTimeout(fallbackTimer);
        console.error('Erro ao carregar publicações do perfil:', error);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [id, isOwnProfile, user]);

  // Ouvir posts com like deste utilizador
  useEffect(() => {
    if (!id) return;
    const qLikes = query(
      collection(db, 'posts'),
      where('likes', 'array-contains', id)
    );
    const unsubscribe = onSnapshot(
      qLikes,
      (snapshot) => {
        const liked = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) =>
              (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
          );
        setLikedPosts(liked);
      },
      (error) => {
        console.error('Erro ao carregar gostos do perfil:', error);
      }
    );
    return () => unsubscribe();
  }, [id]);

  const handleFollowClick = async () => {
    if (!user || isOwnProfile || isTogglingFollow) return;
    const wasFollowing = following;
    setIsTogglingFollow(true);
    try {
      await toggleFollow(id);
      if (!wasFollowing) {
        await createNotification({
          recipientId: id,
          sender: user,
          type: 'follow',
        }).catch((err) => console.error('Erro ao criar notificação de follow:', err));
      }
    } finally {
      setIsTogglingFollow(false);
    }
  };

  const handleSavePhotoUrl = async (e) => {
    e.preventDefault();
    if (!isOwnProfile || !user || savingPhoto) return;

    const trimmed = photoInput.trim();
    if (!trimmed) {
      setPhotoError('Cola um link de imagem válido ou usa a foto da conta Google.');
      return;
    }

    if (!isValidImageUrl(trimmed)) {
      setPhotoError('O link tem de começar por http:// ou https://.');
      return;
    }

    setPhotoError('');
    setSavingPhoto(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          customPhotoURL: trimmed,
          displayName: user.displayName || profileData.name || 'Utilizador',
        },
        { merge: true }
      );
      setProfileData((prev) => ({ ...prev, photo: trimmed }));
      setEditingPhoto(false);
    } catch (error) {
      console.error('Erro ao atualizar foto por URL:', error);
      setPhotoError('Não foi possível guardar a foto.');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleResetGooglePhoto = async () => {
    if (!isOwnProfile || !user || savingPhoto) return;
    setPhotoError('');
    setSavingPhoto(true);
    try {
      const googlePhoto = user.photoURL || null;
      await setDoc(
        doc(db, 'users', user.uid),
        { customPhotoURL: null },
        { merge: true }
      );
      setProfileData((prev) => ({ ...prev, photo: googlePhoto }));
      setPhotoInput('');
      setEditingPhoto(false);
    } catch (error) {
      console.error('Erro ao repor foto Google:', error);
      setPhotoError('Não foi possível repor a foto da conta.');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSaveBio = async () => {
    if (!isOwnProfile || !user || savingBio) return;
    setSavingBio(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { bio: bioInput.trim() },
        { merge: true }
      );
      setEditingBio(false);
    } catch (error) {
      console.error('Erro ao guardar bio:', error);
    } finally {
      setSavingBio(false);
    }
  };

  const handleLike = async (postId, currentLikes, post) => {
    if (!user) return;
    const postRef = doc(db, 'posts', postId);
    const hasLiked = currentLikes?.includes(user.uid);
    try {
      await updateDoc(postRef, {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });

      if (!hasLiked && post?.authorId && post.authorId !== user.uid) {
        await createNotification({
          recipientId: post.authorId,
          sender: user,
          type: 'like',
          postId,
          postPreview: post.text || 'Cusquice',
        }).catch((err) => console.error('Erro ao criar notificação de like:', err));
      }
    } catch (error) {
      console.error('Erro ao dar like:', error);
    }
  };

  const handleDeletePost = async (post) => {
    try {
      await deleteDoc(doc(db, 'posts', post.id));
    } catch (error) {
      console.error('Erro ao apagar post:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-center text-neutral-500 pt-12">
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

  const displayedFollowingCount = isOwnProfile
    ? Math.max(profileData.followingCount, myFollowing.length)
    : profileData.followingCount;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800/90 px-4 py-3 flex items-center justify-between gap-4 sticky top-0 bg-neutral-950/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="text-xl hover:text-neutral-300 transition py-1 px-2 rounded-lg hover:bg-neutral-900"
            title="Voltar ao feed"
          >
            ←
          </Link>
          <h1 className="text-lg sm:text-xl font-bold truncate">
            {profileData.name || 'Perfil'}
          </h1>
        </div>
        {user && <NotificationsBell />}
      </header>

      <main className="max-w-2xl mx-auto p-3 sm:p-4">
        <div className="bg-neutral-900/90 p-5 sm:p-6 rounded-2xl border border-neutral-800 mb-6 text-center shadow-lg">
          <div className="relative w-24 h-24 mx-auto mb-3">
            {profileData.photo ? (
              <img
                src={profileData.photo}
                alt={profileData.name || 'Avatar'}
                className="w-24 h-24 rounded-full object-cover border-2 border-neutral-700"
              />
            ) : (
              <div className="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-neutral-700">
                {profileData.name ? profileData.name.charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </div>

          {isOwnProfile && !editingPhoto && (
            <button
              type="button"
              onClick={() => {
                setPhotoError('');
                setEditingPhoto(true);
              }}
              className="mb-2 inline-block text-xs text-blue-400 hover:text-blue-300 hover:underline transition py-1 px-2"
            >
              🔗 Alterar foto por URL
            </button>
          )}

          {isOwnProfile && editingPhoto && (
            <form
              onSubmit={handleSavePhotoUrl}
              className="mt-2 mb-3 max-w-md mx-auto space-y-2 text-left"
            >
              <input
                type="url"
                value={photoInput}
                onChange={(e) => setPhotoInput(e.target.value)}
                placeholder="https://exemplo.com/minha-foto.jpg"
                className="w-full bg-neutral-800 text-xs sm:text-sm text-white placeholder-neutral-500 rounded-xl px-3 py-2 outline-none border border-neutral-700 focus:border-blue-500 transition"
              />
              {photoError && (
                <p className="text-red-400 text-xs">{photoError}</p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="submit"
                  disabled={savingPhoto}
                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-full transition active:scale-95"
                >
                  {savingPhoto ? 'A guardar...' : 'Guardar URL'}
                </button>
                {user?.photoURL && (
                  <button
                    type="button"
                    onClick={handleResetGooglePhoto}
                    disabled={savingPhoto}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs px-3.5 py-1.5 rounded-full transition active:scale-95"
                  >
                    Usar foto Google
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingPhoto(false);
                    setPhotoError('');
                  }}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-xs px-3.5 py-1.5 rounded-full transition active:scale-95"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <h2 className="text-2xl font-bold">{profileData.name || 'Utilizador'}</h2>

          {editingBio ? (
            <div className="mt-3 max-w-md mx-auto space-y-2">
              <textarea
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value.slice(0, 160))}
                placeholder="Escreve algo sobre ti..."
                rows={2}
                className="w-full bg-neutral-800 text-sm text-white rounded-xl p-2.5 outline-none border border-neutral-700 focus:border-blue-500 transition"
              />
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveBio}
                  disabled={savingBio}
                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-full transition active:scale-95"
                >
                  {savingBio ? 'A guardar...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBioInput(profileData.bio || '');
                    setEditingBio(false);
                  }}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-4 py-1.5 rounded-full transition active:scale-95"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              {profileData.bio ? (
                <p className="text-neutral-300 text-sm max-w-md mx-auto leading-relaxed">
                  {profileData.bio}
                </p>
              ) : isOwnProfile ? (
                <p className="text-neutral-500 text-xs italic">Ainda sem biografia.</p>
              ) : null}

              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setEditingBio(true)}
                  className="mt-2 text-xs text-blue-400 hover:underline"
                >
                  ✏️ Editar bio
                </button>
              )}
            </div>
          )}

          <div className="flex justify-center gap-6 text-sm text-neutral-400 mt-4">
            <span>
              <strong className="text-white">{posts.length}</strong> cusquices
            </span>
            <span>
              <strong className="text-white">{profileData.followersCount}</strong>{' '}
              seguidores
            </span>
            <span>
              <strong className="text-white">{displayedFollowingCount}</strong> a seguir
            </span>
          </div>

          {user && !isOwnProfile && (
            <button
              type="button"
              onClick={handleFollowClick}
              disabled={isTogglingFollow}
              className={`group mt-4 px-6 py-2 rounded-full font-bold text-sm transition active:scale-95 disabled:opacity-60 ${
                following
                  ? 'bg-neutral-800 text-white border border-neutral-700 hover:bg-red-950/60 hover:text-red-300 hover:border-red-700/60'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isTogglingFollow ? (
                'A atualizar...'
              ) : following ? (
                <>
                  <span className="group-hover:hidden">A Seguir ✓</span>
                  <span className="hidden group-hover:inline">Deixar de seguir</span>
                </>
              ) : (
                'Seguir'
              )}
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-4 border-b border-neutral-800 pb-2.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition active:scale-95 whitespace-nowrap ${
              activeTab === 'posts'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            Cusquices ({posts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('likes')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition active:scale-95 whitespace-nowrap ${
              activeTab === 'likes'
                ? 'bg-red-500/20 text-red-400'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            ❤️ Gostos ({likedPosts.length})
          </button>
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition active:scale-95 whitespace-nowrap ${
                activeTab === 'saved'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              🔖 Guardados ({savedPosts.length})
            </button>
          )}
        </div>

        {displayedPosts.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">
            Nenhuma publicação neste separador.
          </p>
        ) : (
          <div className="space-y-4">
            {displayedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onDelete={
                  isOwnProfile && activeTab === 'posts' ? handleDeletePost : undefined
                }
                showAuthor={activeTab !== 'posts'}
              >
                <CommentsSection postId={post.id} postAuthorId={post.authorId} />
              </PostCard>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}