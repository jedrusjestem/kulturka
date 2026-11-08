import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../api';
import { Empty, Spinner, useToast } from '../components/ui';
import { PostCard, PostComposer, StoriesBar } from '../components/community';

/** Tablica: najnowsze posty wszystkich członków + story z ostatnich 24 h */
export function Feed({ authorId, composer = true }) {
  const toast = useToast();
  const [posts, setPosts] = useState(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE = 15;
  const load = useCallback(async () => {
    try {
      const p = await api.listPosts({ authorId, limit: PAGE });
      setPosts(p);
      setMore(p.length === PAGE);
    } catch (e) {
      toast.error(e);
      setPosts([]);
    }
  }, [authorId, toast]);
  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const p = await api.listPosts({ authorId, limit: PAGE, before: posts[posts.length - 1]?.created_at });
      setPosts((x) => [...x, ...p]);
      setMore(p.length === PAGE);
    } catch (e) {
      toast.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="stack feed">
      {composer && <PostComposer onPosted={load} />}
      {!posts ? (
        <Spinner center />
      ) : posts.length === 0 ? (
        <div className="card">
          <Empty icon={Sparkles} title={authorId ? 'Brak postów' : 'Tablica jest pusta'}>
            {composer ? 'Napisz pierwszy post – podziel się zdjęciem z próby, pomysłem albo ogłoszeniem.' : null}
          </Empty>
        </div>
      ) : (
        <>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onChanged={load} />
          ))}
          {more && (
            <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Ładowanie…' : 'Pokaż starsze posty'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function Community() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <h1>Społeczność</h1>
          <p>Tablica komisji – posty, zdjęcia i story znikające po 24 h.</p>
        </div>
      </div>
      <StoriesBar />
      <Feed />
    </div>
  );
}
