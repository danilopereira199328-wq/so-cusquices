import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

export async function createNotification({
  recipientId,
  sender,
  type,
  postId = null,
  postPreview = '',
}) {
  if (!recipientId || !sender?.uid || recipientId === sender.uid) return;

  const { addDoc, serverTimestamp } = await import('firebase/firestore');
  await addDoc(collection(db, 'notifications'), {
    recipientId,
    senderId: sender.uid,
    senderName: sender.displayName || 'Utilizador',
    senderPhoto: sender.photoURL || '',
    type,
    postId,
    postPreview: postPreview.slice(0, 70),
    read: false,
    createdAt: serverTimestamp(),
  });
}

export default function NotificationsBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
        )
        .slice(0, 25);
      setNotifications(items);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notifId) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const getLabel = (n) => {
    if (n.type === 'like') return 'gostou da tua cusquice';
    if (n.type === 'comment') return 'comentou na tua cusquice';
    if (n.type === 'follow') return 'começou a seguir-te';
    return 'interagiu contigo';
  };

  const getIcon = (type) => {
    if (type === 'like') return '❤️';
    if (type === 'comment') return '💬';
    if (type === 'follow') return '👤';
    return '🔔';
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-sm transition active:scale-95"
        aria-label="Notificações"
      >
        <span>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-2 sm:right-0 mt-2 w-[calc(100vw-1rem)] sm:w-80 max-h-96 overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl z-30 p-2">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/80">
            <span className="text-sm font-bold text-white">Notificações</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs text-blue-400 hover:underline"
              >
                Marcar tudo como lido
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-6">
              Sem notificações por enquanto.
            </p>
          ) : (
            <div className="divide-y divide-neutral-800/60 mt-1">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  to={n.type === 'follow' ? `/profile/${n.senderId}` : `/profile/${user.uid}`}
                  onClick={() => {
                    if (!n.read) markAsRead(n.id);
                    setOpen(false);
                  }}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl transition ${
                    n.read ? 'hover:bg-neutral-900/60 opacity-75' : 'bg-blue-950/20 hover:bg-neutral-900'
                  }`}
                >
                  <span className="text-base mt-0.5">{getIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-200 leading-snug">
                      <strong className="text-white">{n.senderName}</strong> {getLabel(n)}
                    </p>
                    {n.postPreview && (
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        “{n.postPreview}”
                      </p>
                    )}
                    <span className="text-[10px] text-neutral-500">
                      {n.createdAt?.toDate().toLocaleString('pt-PT') || 'Agora'}
                    </span>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}