import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFollow } from '../context/FollowContext';
import { db } from '../firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import PostCard from '../components/PostCard';
import CommentsSection from '../components/CommentsSection';
import NotificationsBell, { createNotification } from '../components/NotificationsBell';

export const CATEGORIES = [
  { id: 'nacional', label: 'Nacional', icon: '🇵🇹' },
  { id: 'internacional', label: 'Internacional', icon: '🌍' },
  { id: 'famosos', label: 'Famosos', icon: '⭐' },
  { id: 'produtos', label: 'Produtos', icon: '📦' },
];

const MAX_CHARS = 300;
const FEED_LOAD_TIMEOUT_MS = 4000;

export default function Feed() {
  const { user, logout } = useAuth();
  const { following } = useFollow();

  const [posts, setPosts] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [country, setCountry] = useState('PT');
  const [category, setCategory] = useState('nacional');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState('');

  // Filtros e ordenação
  const [feedTab, setFeedTab] = useState('all'); // 'all' | 'following' | 'saved'
  const [filterCountry, setFilterCountry] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'popular'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, FEED_LOAD_TIMEOUT_MS);

    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        clearTimeout(fallbackTimer);
        const postsData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setPosts(postsData);
        setLoading(false);
      },
      (error) => {
        clearTimeout(fallbackTimer);
        console.error('Erro ao carregar feed:', error);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          setBookmarks(snap.data().bookmarks || []);
        } else {
          setBookmarks([]);
        }
      },
      (error) => {
        console.error('Erro ao carregar guardados:', error);
      }
    );
    return () => unsubscribe();
  }, [user?.uid]);

  const hasActiveFilters =
    feedTab !== 'all' ||
    filterCountry !== 'ALL' ||
    filterCategory !== 'ALL' ||
    searchTerm.trim() !== '';

  const clearFilters = () => {
    setFeedTab('all');
    setFilterCountry('ALL');
    setFilterCategory('ALL');
    setSearchTerm('');
  };

  const filteredPosts = useMemo(() => {
    const result = posts.filter((post) => {
      if (
        feedTab === 'following' &&
        !following.includes(post.authorId) &&
        post.authorId !== user?.uid
      ) {
        return false;
      }
      if (feedTab === 'saved' && !bookmarks.includes(post.id)) {
        return false;
      }
      if (filterCountry !== 'ALL' && post.country !== filterCountry) {
        return false;
      }
      if (filterCategory !== 'ALL' && post.category !== filterCategory) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchText = post.text?.toLowerCase().includes(term);
        const matchAuthor = post.author?.toLowerCase().includes(term);
        if (!matchText && !matchAuthor) return false;
      }
      return true;
    });

    if (sortBy === 'popular') {
      return [...result].sort(
        (a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)
      );
    }

    return result;
  }, [
    posts,
    feedTab,
    following,
    bookmarks,
    user?.uid,
    filterCountry,
    filterCategory,
    searchTerm,
    sortBy,
  ]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() || submitting || !user) return;

    setSubmitting(true);
    setPostError('');

    try {
      await addDoc(collection(db, 'posts'), {
        text: newPost.trim(),
        author: user.displayName || 'Utilizador',
        authorPhoto: user.photoURL || '',
        authorId: user.uid,
        country,
        category,
        likes: [],
        createdAt: serverTimestamp(),
      });

      setNewPost('');
    } catch (error) {
      console.error('Erro ao criar post:', error);
      setPostError(error?.message || 'Não foi possível publicar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async (post) => {
    try {
      await deleteDoc(doc(db, 'posts', post.id));
    } catch (error) {
      console.error('Erro ao apagar post:', error);
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

  const handleBookmark = async (postId) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const alreadySaved = bookmarks.includes(postId);

    try {
      await setDoc(
        userRef,
        {
          bookmarks: alreadySaved ? arrayRemove(postId) : arrayUnion(postId),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Erro ao guardar post:', error);
    }
  };

  const handleRepost = async (post) => {
    if (!user) return;
    if (!window.confirm(`Partilhar esta cusquice de ${post.author} no teu feed?`)) return;

    try {
      await addDoc(collection(db, 'posts'), {
        text: post.text,
        author: post.author,
        authorPhoto: post.authorPhoto,
        authorId: post.authorId,
        repostedBy: user.displayName || 'Utilizador',
        repostedById: user.uid,
        country: post.country,
        category: post.category,
        likes: [],
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erro ao partilhar post:', error);
    }
  };

  const remainingChars = MAX_CHARS - newPost.length;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800/90 px-4 py-3 flex justify-between items-center sticky top-0 bg-neutral-950/90 backdrop-blur-md z-20">
        <h1 className="text-xl font-bold tracking-tight">Só Cusquices</h1>
        <div className="flex items-center gap-3 sm:gap-4">
          <NotificationsBell />
          <Link
            to={`/profile/${user?.uid}`}
            className="flex items-center gap-2 hover:opacity-85 transition"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover border border-neutral-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold border border-neutral-700">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span className="text-sm font-medium hidden sm:block">
              {user?.displayName || 'Utilizador'}
            </span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="text-red-400 hover:text-red-300 font-bold text-sm py-1 px-2 rounded-lg transition active:scale-95"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-3 sm:p-4">
        {/* Formulário de Criação */}
        <form
          onSubmit={handleCreatePost}
          className="mb-6 bg-neutral-900/90 p-4 rounded-2xl border border-neutral-800 shadow-lg"
        >
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value.slice(0, MAX_CHARS))}
            placeholder={
              country === 'PT' ? 'O que está a cusquizar?' : 'O que está a fofocar?'
            }
            className="w-full bg-transparent text-white placeholder-neutral-500 resize-none outline-none text-base sm:text-lg mb-2"
            rows={2}
          />

          {postError && (
            <p className="text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2 text-xs mb-3">
              {postError}
            </p>
          )}

          <div className="flex flex-wrap gap-3 justify-between items-center">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCountry('PT')}
                className={`px-3 py-1.5 rounded-xl text-lg transition active:scale-95 ${
                  country === 'PT'
                    ? 'bg-neutral-700 ring-2 ring-blue-500'
                    : 'bg-neutral-800 opacity-60 hover:opacity-100'
                }`}
              >
                🇵🇹
              </button>
              <button
                type="button"
                onClick={() => setCountry('BR')}
                className={`px-3 py-1.5 rounded-xl text-lg transition active:scale-95 ${
                  country === 'BR'
                    ? 'bg-neutral-700 ring-2 ring-emerald-500'
                    : 'bg-neutral-800 opacity-60 hover:opacity-100'
                }`}
              >
                🇧🇷
              </button>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-neutral-800 text-white text-sm rounded-xl px-3 py-1.5 outline-none border border-neutral-700"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <span
                className={`text-xs ${
                  remainingChars < 30 ? 'text-amber-400 font-bold' : 'text-neutral-500'
                }`}
              >
                {remainingChars}
              </span>

              <button
                type="submit"
                disabled={!newPost.trim() || submitting}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-5 sm:px-6 rounded-full transition active:scale-95"
              >
                {submitting
                  ? 'A publicar...'
                  : country === 'PT'
                  ? 'Cusquizar'
                  : 'Fofocar'}
              </button>
            </div>
          </div>
        </form>

        {/* Barra de Filtros e Ordenação */}
        <div className="mb-6 space-y-3 bg-neutral-900/70 p-3.5 rounded-2xl border border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFeedTab('all')}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition active:scale-95 ${
                  feedTab === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Para Ti
              </button>
              <button
                type="button"
                onClick={() => setFeedTab('following')}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition active:scale-95 ${
                  feedTab === 'following'
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                A Seguir ({following.length})
              </button>
              <button
                type="button"
                onClick={() => setFeedTab('saved')}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition active:scale-95 ${
                  feedTab === 'saved'
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                🔖 Guardados ({bookmarks.length})
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {['ALL', 'PT', 'BR'].map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setFilterCountry(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition active:scale-95 ${
                    filterCountry === c
                      ? 'bg-neutral-700 text-white ring-1 ring-neutral-500'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {c === 'ALL' ? 'Todos' : c === 'PT' ? '🇵🇹 PT' : '🇧🇷 BR'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar cusquices ou autores..."
              className="flex-1 bg-neutral-800 text-sm text-white placeholder-neutral-500 rounded-xl px-3 py-2 outline-none border border-neutral-700 focus:border-blue-500 transition"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-neutral-800 text-white text-sm rounded-xl px-3 py-2 outline-none border border-neutral-700"
            >
              <option value="ALL">Todas as categorias</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-neutral-800 text-white text-sm rounded-xl px-3 py-2 outline-none border border-neutral-700"
            >
              <option value="recent">🕒 Mais recentes</option>
              <option value="popular">🔥 Mais gostados</option>
            </select>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-blue-400 hover:underline"
              >
                Limpar filtros ativos
              </button>
            </div>
          )}
        </div>

        {/* Lista de Posts */}
        {loading ? (
          <p className="text-center text-neutral-500 py-8">A carregar...</p>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center text-neutral-500 py-10 space-y-2">
            <p>Nenhuma cusquice encontrada com estes filtros.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-blue-400 hover:underline"
              >
                Mostrar todas as publicações
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onDelete={handleDeletePost}
                onBookmark={handleBookmark}
                onRepost={handleRepost}
                isBookmarked={bookmarks.includes(post.id)}
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