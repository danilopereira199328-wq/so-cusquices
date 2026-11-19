import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFollow } from '../context/FollowContext';
import { db, storage } from '../firebase';
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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import PostCard from '../components/PostCard';
import CommentsSection from '../components/CommentsSection';

export const CATEGORIES = [
  { id: 'nacional', label: 'Nacional', icon: '🇵🇹' },
  { id: 'internacional', label: 'Internacional', icon: '🌍' },
  { id: 'famosos', label: 'Famosos', icon: '⭐' },
  { id: 'produtos', label: 'Produtos', icon: '📦' },
  { id: 'pessoas', label: 'Pessoas Comuns', icon: '👥' },
];

const MAX_FILE_SIZE_MB = 5;
const MAX_CHARS = 300;

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

  // Upload de imagem
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Filtros e ordenação
  const [feedTab, setFeedTab] = useState('all'); // 'all' | 'following' | 'saved'
  const [filterCountry, setFilterCountry] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'popular'
  const [searchTerm, setSearchTerm] = useState('');

  // Ouvir posts
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Ouvir guardados do utilizador
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        setBookmarks(snap.data().bookmarks || []);
      } else {
        setBookmarks([]);
      }
    });
    return () => unsubscribe();
  }, [user]);

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
        post.authorId !== user.uid
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
    user.uid,
    filterCountry,
    filterCategory,
    searchTerm,
    sortBy,
  ]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    setUploadError('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Seleciona apenas um ficheiro de imagem válido.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadError(`A imagem não pode exceder ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearSelectedImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview('');
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if ((!newPost.trim() && !imageFile) || submitting) return;

    setSubmitting(true);
    setUploadError('');

    try {
      let imageUrl = null;
      let storagePath = null;

      if (imageFile) {
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        storagePath = `posts/${user.uid}/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'posts'), {
        text: newPost.trim(),
        imageUrl,
        storagePath,
        author: user.displayName,
        authorPhoto: user.photoURL,
        authorId: user.uid,
        country,
        category,
        likes: [],
        createdAt: serverTimestamp(),
      });

      setNewPost('');
      clearSelectedImage();
    } catch (error) {
      console.error('Erro ao criar post:', error);
      setUploadError('Ocorreu um erro ao publicar. Tenta novamente.');
    } finally {
      setSubmitting(false);
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
        imageUrl: post.imageUrl || null,
        author: post.author,
        authorPhoto: post.authorPhoto,
        authorId: post.authorId,
        repostedBy: user.displayName,
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
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 p-4 flex justify-between items-center sticky top-0 bg-black/90 backdrop-blur-md z-10">
        <h1 className="text-xl font-bold">Só Cusquices</h1>
        <div className="flex items-center gap-4">
          <Link
            to={`/profile/${user.uid}`}
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />
            <span className="text-sm font-medium hidden sm:block">{user.displayName}</span>
          </Link>
          <button
            onClick={logout}
            className="text-red-400 hover:text-red-300 font-bold text-sm"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {/* Formulário de Criação */}
        <form
          onSubmit={handleCreatePost}
          className="mb-6 bg-gray-900 p-4 rounded-xl border border-gray-800"
        >
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value.slice(0, MAX_CHARS))}
            placeholder={
              country === 'PT' ? 'O que está a cusquizar?' : 'O que está a fofocar?'
            }
            className="w-full bg-transparent text-white placeholder-gray-500 resize-none outline-none text-lg mb-2"
            rows={2}
          />

          {imagePreview && (
            <div className="relative mb-3 inline-block">
              <img
                src={imagePreview}
                alt="Pré-visualização"
                className="max-h-60 rounded-xl border border-gray-700 object-cover"
              />
              <button
                type="button"
                onClick={clearSelectedImage}
                className="absolute top-2 right-2 bg-black/75 hover:bg-black text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold"
                title="Remover imagem"
              >
                ✕
              </button>
            </div>
          )}

          {uploadError && <p className="text-red-400 text-xs mb-2">{uploadError}</p>}

          <div className="flex flex-wrap gap-4 justify-between items-center">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCountry('PT')}
                className={`px-3 py-1 rounded-lg text-xl transition ${
                  country === 'PT'
                    ? 'bg-gray-700 ring-2 ring-blue-500'
                    : 'bg-gray-800 opacity-50 hover:opacity-100'
                }`}
              >
                🇵🇹
              </button>
              <button
                type="button"
                onClick={() => setCountry('BR')}
                className={`px-3 py-1 rounded-lg text-xl transition ${
                  country === 'BR'
                    ? 'bg-gray-700 ring-2 ring-green-500'
                    : 'bg-gray-800 opacity-50 hover:opacity-100'
                }`}
              >
                🇧🇷
              </button>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1 outline-none border border-gray-700"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="post-image-input"
              />
              <label
                htmlFor="post-image-input"
                className="cursor-pointer bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-1 rounded-lg border border-gray-700 transition flex items-center gap-1"
              >
                🖼️ Foto
              </label>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-xs ${
                  remainingChars < 30 ? 'text-yellow-400 font-bold' : 'text-gray-500'
                }`}
              >
                {remainingChars}
              </span>

              <button
                type="submit"
                disabled={(!newPost.trim() && !imageFile) || submitting}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-full transition"
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
        <div className="mb-6 space-y-3 bg-gray-900/60 p-3 rounded-xl border border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFeedTab('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                  feedTab === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Para Ti
              </button>
              <button
                onClick={() => setFeedTab('following')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                  feedTab === 'following'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                A Seguir ({following.length})
              </button>
              <button
                onClick={() => setFeedTab('saved')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                  feedTab === 'saved'
                    ? 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/50'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                🔖 Guardados ({bookmarks.length})
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {['ALL', 'PT', 'BR'].map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCountry(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    filterCountry === c
                      ? 'bg-gray-700 text-white ring-1 ring-gray-500'
                      : 'bg-gray-800 text-gray-400'
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
              className="flex-1 bg-gray-800 text-sm text-white placeholder-gray-500 rounded-lg px-3 py-1.5 outline-none border border-gray-700 focus:border-blue-500"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 outline-none border border-gray-700"
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
              className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 outline-none border border-gray-700"
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
          <p className="text-center text-gray-500">A carregar...</p>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center text-gray-500 py-8 space-y-2">
            <p>Nenhuma cusquice encontrada com estes filtros.</p>
            {hasActiveFilters && (
              <button
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
                <CommentsSection postId={post.id} />
              </PostCard>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}