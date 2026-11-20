import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFollow } from '../context/FollowContext';

const CATEGORIES_MAP = {
  nacional: { label: 'Nacional', icon: '🇵🇹' },
  internacional: { label: 'Internacional', icon: '🌍' },
  famosos: { label: 'Famosos', icon: '⭐' },
  produtos: { label: 'Produtos', icon: '📦' },
};

export default function PostCard({
  post,
  onLike,
  onDelete,
  onBookmark,
  onRepost,
  isBookmarked = false,
  showAuthor = true,
  children,
}) {
  const { user } = useAuth();
  const { toggleFollow, isFollowing } = useFollow();
  const [showComments, setShowComments] = useState(false);

  const hasLiked = post.likes?.includes(user?.uid);
  const catInfo = CATEGORIES_MAP[post.category] || { label: 'Geral', icon: '💬' };
  const authorFollowed = isFollowing(post.authorId);
  const isOwner = user?.uid === post.authorId;

  const handleConfirmDelete = () => {
    if (window.confirm('Tens a certeza que queres apagar esta cusquice?')) {
      onDelete(post);
    }
  };

  return (
    <div className="bg-neutral-900/90 p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors duration-200">
      {post.repostedBy && (
        <p className="text-xs text-neutral-400 mb-2 flex items-center gap-1">
          🔁 Partilhado por <span className="font-semibold text-neutral-300">{post.repostedBy}</span>
        </p>
      )}

      <div className="flex items-start gap-3">
        {showAuthor && (
          <Link to={`/profile/${post.authorId}`} className="shrink-0">
            <img
              src={post.authorPhoto}
              alt={post.author}
              className="w-10 h-10 rounded-full object-cover border border-neutral-700"
            />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center flex-wrap gap-1.5">
              {showAuthor && (
                <Link
                  to={`/profile/${post.authorId}`}
                  className="font-bold text-white hover:underline"
                >
                  {post.author}
                </Link>
              )}

              {showAuthor && user && !isOwner && (
                <button
                  type="button"
                  onClick={() => toggleFollow(post.authorId)}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition active:scale-95 ${
                    authorFollowed
                      ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  }`}
                >
                  {authorFollowed ? 'A seguir' : '+ Seguir'}
                </button>
              )}

              <span className="text-base">{post.country === 'PT' ? '🇵🇹' : '🇧🇷'}</span>
              <span className="text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">
                {catInfo.icon} {catInfo.label}
              </span>
              <span className="text-neutral-500 text-xs">
                {post.createdAt?.toDate().toLocaleString('pt-PT') || 'Agora'}
              </span>
            </div>

            {isOwner && onDelete && (
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="text-neutral-500 hover:text-red-400 text-sm transition p-1 rounded-lg"
                title="Apagar publicação"
              >
                🗑️
              </button>
            )}
          </div>

          {post.text && (
            <p className="text-neutral-100 mt-2 whitespace-pre-wrap break-words leading-relaxed">
              {post.text}
            </p>
          )}

          {post.imageUrl && (
            <div className="mt-3">
              <img
                src={post.imageUrl}
                alt="Imagem da cusquice"
                loading="lazy"
                className="max-h-80 w-full rounded-xl object-cover border border-neutral-800"
              />
            </div>
          )}

          <div className="mt-3 pt-2 border-t border-neutral-800/70 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => onLike(post.id, post.likes, post)}
                className={`flex items-center gap-1 text-sm py-1 px-1.5 rounded-lg transition active:scale-95 ${
                  hasLiked ? 'text-red-500 font-semibold' : 'text-neutral-400 hover:text-red-400'
                }`}
              >
                {hasLiked ? '❤️' : '🤍'} <span>{post.likes?.length || 0}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowComments((prev) => !prev)}
                className="flex items-center gap-1 text-sm py-1 px-1.5 rounded-lg text-neutral-400 hover:text-blue-400 transition active:scale-95"
              >
                💬 <span>{showComments ? 'Ocultar' : 'Comentar'}</span>
              </button>

              {onRepost && !isOwner && (
                <button
                  type="button"
                  onClick={() => onRepost(post)}
                  className="flex items-center gap-1 text-sm py-1 px-1.5 rounded-lg text-neutral-400 hover:text-emerald-400 transition active:scale-95"
                  title="Partilhar no teu feed"
                >
                  🔁 <span className="hidden sm:inline">Partilhar</span>
                </button>
              )}
            </div>

            {onBookmark && (
              <button
                type="button"
                onClick={() => onBookmark(post.id)}
                className={`text-sm py-1 px-2 rounded-lg transition active:scale-95 ${
                  isBookmarked
                    ? 'text-amber-400 font-semibold'
                    : 'text-neutral-400 hover:text-amber-300'
                }`}
                title={isBookmarked ? 'Remover dos guardados' : 'Guardar cusquice'}
              >
                {isBookmarked ? '🔖 Guardado' : '📑 Guardar'}
              </button>
            )}
          </div>

          {showComments && children}
        </div>
      </div>
    </div>
  );
}