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
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

export default function Feed() {
  const { user, logout } = useAuth();
  const { following } = useFollow();

  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [country, setCountry] = useState('PT');
  const [category, setCategory] = useState('nacional');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estados de upload de imagem
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Estados dos filtros
  const [feedTab, setFeedTab] = useState('all');
  const [filterCountry, setFilterCountry] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (
        feedTab === 'following' &&
        !following.includes(post.authorId) &&
        post.authorId !== user.uid
      ) {
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
  }, [posts, feedTab, following, user.uid, filterCountry, filterCategory, searchTerm]);

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
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview('');
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if ((!newPost.trim() && !imageFile) || submitting) return;

    setSubmitting(true);
    setUploadError('');

    try {
      let imageUrl = null;

      if (imageFile) {
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageRef = ref(storage, `posts/${user.uid}/${Date.now()}_${safeName}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'posts'), {
        text: newPost.trim(),
        imageUrl,
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

  const handleDeletePost = async (postId) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
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
            onChange={(e) => setNewPost(e.target.value)}
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

          {uploadError && (
            <p className="text-red-400 text-xs mb-2">{uploadError}</p>
          )}

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
        </form>

        {/* Barra de Filtros */}
        <div className="mb-6 space-y-3 bg-gray-900/60 p-3 rounded-xl border border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
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
            </div>

            <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* Lista de Posts */}
        {loading ? (
          <p className="text-center text-gray-500">A carregar...</p>
        ) : filteredPosts.length === 0 ? (
          <p className="text-center text-gray-500">
            Nenhuma cusquice encontrada com estes filtros.
          </p>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onDelete={handleDeletePost}
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