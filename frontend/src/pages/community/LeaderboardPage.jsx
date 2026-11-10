import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';
import { community, mediaUrl } from '../../services/platformService';
import { Empty, Loading, Page, Tabs, VerifiedBadge } from '../../components/ui';

const LeaderboardPage = () => {
  const [period, setPeriod] = useState('week');
  const [creators, setCreators] = useState(null);

  useEffect(() => {
    setCreators(null);
    community.leaderboard(period).then((res) => setCreators(res.creators)).catch(() => setCreators([]));
  }, [period]);

  return (
    <Page title="Top Creators" description="Scored from recent activity: 1 point per view, 3 per download, 5 per like.">
      <Tabs tabs={[{ id: 'week', label: 'This Week' }, { id: 'month', label: 'This Month' }]} active={period} onChange={setPeriod} />
      {!creators && <Loading />}
      {creators?.length === 0 && <Empty icon={Award} title="No activity yet">Rankings appear once wallpapers get views, downloads, and likes.</Empty>}
      {creators?.length > 0 && (
        <div className="fw-table-wrap">
          <table className="fw-table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Creator</th>
                <th scope="col" className="fw-num">Views</th>
                <th scope="col" className="fw-num">Downloads</th>
                <th scope="col" className="fw-num">Likes</th>
                <th scope="col" className="fw-num">Score</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((creator) => (
                <tr key={creator.username}>
                  <td className="fw-rank">{creator.rank}</td>
                  <td>
                    <Link to={`/creator/${encodeURIComponent(creator.username)}`} className="fw-media-row">
                      {creator.avatarUrl ? <img className="fw-avatar" src={mediaUrl(creator.avatarUrl)} alt="" /> : <span className="fw-avatar fw-avatar-letter" aria-hidden="true">{creator.username[0].toUpperCase()}</span>}
                      <span>{creator.username}{creator.isVerified && <> <VerifiedBadge /></>}</span>
                    </Link>
                  </td>
                  <td className="fw-num">{creator.views.toLocaleString()}</td>
                  <td className="fw-num">{creator.downloads.toLocaleString()}</td>
                  <td className="fw-num">{creator.likes.toLocaleString()}</td>
                  <td className="fw-num"><strong>{creator.score.toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
};

export default LeaderboardPage;
