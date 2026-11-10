import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Trophy, Vote } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { community, errorMessage, mediaUrl, studio } from '../../services/platformService';
import { Empty, Field, Loading, Page, Panel, dateOnly, dateTime, toLocalInput } from '../../components/ui';

const PHASE_LABELS = {
  upcoming: 'Starting soon',
  submissions: 'Open for entries',
  voting: 'Voting now',
  ended: 'Finished'
};

const NewChallengeForm = ({ showToast, onCreated }) => {
  const now = new Date();
  const days = (count) => toLocalInput(new Date(now.getTime() + count * 86400000));
  const [fields, setFields] = useState({
    title: '', description: '', submissionsStartAt: days(0), submissionsEndAt: days(5), votingEndAt: days(7)
  });
  const set = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    try {
      const res = await community.createChallenge({
        ...fields,
        submissionsStartAt: new Date(fields.submissionsStartAt).toISOString(),
        submissionsEndAt: new Date(fields.submissionsEndAt).toISOString(),
        votingEndAt: new Date(fields.votingEndAt).toISOString()
      });
      showToast(res.message, 'success');
      setFields((current) => ({ ...current, title: '', description: '' }));
      onCreated();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <Panel title="New Challenge">
      <form onSubmit={submit} className="fw-form">
        <Field label="Theme"><input className="fw-input" value={fields.title} onChange={set('title')} required maxLength={120} /></Field>
        <Field label="Description"><textarea className="fw-input" rows={3} value={fields.description} onChange={set('description')} /></Field>
        <div className="fw-grid-3">
          <Field label="Entries open"><input type="datetime-local" className="fw-input" value={fields.submissionsStartAt} onChange={set('submissionsStartAt')} required /></Field>
          <Field label="Entries close"><input type="datetime-local" className="fw-input" value={fields.submissionsEndAt} onChange={set('submissionsEndAt')} required /></Field>
          <Field label="Voting ends"><input type="datetime-local" className="fw-input" value={fields.votingEndAt} onChange={set('votingEndAt')} required /></Field>
        </div>
        <button type="submit" className="btn btn-primary">Create Challenge</button>
      </form>
    </Panel>
  );
};

export const ChallengesPage = ({ showToast }) => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState(null);

  const load = useCallback(() => {
    community.challenges().then((res) => setChallenges(res.challenges)).catch(() => setChallenges([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Page title="Community Challenges" description="Themed prompts: enter your work, then vote for your favorite.">
      {user?.role === 'admin' && <NewChallengeForm showToast={showToast} onCreated={load} />}
      {!challenges && <Loading />}
      {challenges?.length === 0 && <Empty icon={Trophy} title="No challenges yet">Check back soon.</Empty>}
      <div className="fw-card-grid">
        {(challenges || []).map((challenge) => (
          <Link key={challenge.id} to={`/challenges/${challenge.id}`} className="fw-card">
            <span className={`badge fw-phase-${challenge.phase}`}>{PHASE_LABELS[challenge.phase]}</span>
            <h2>{challenge.title}</h2>
            <p>{challenge.description}</p>
            <span className="fw-field-hint">
              {challenge.phase === 'submissions' && `Entries close ${dateOnly(challenge.submissionsEndAt)}`}
              {challenge.phase === 'voting' && `Voting ends ${dateOnly(challenge.votingEndAt)}`}
              {challenge.phase === 'upcoming' && `Opens ${dateOnly(challenge.submissionsStartAt)}`}
              {challenge.phase === 'ended' && `Ended ${dateOnly(challenge.votingEndAt)}`}
            </span>
          </Link>
        ))}
      </div>
    </Page>
  );
};

export const ChallengeDetailPage = ({ showToast }) => {
  const { id } = useParams();
  const { user, openAuth } = useAuth();
  const [detail, setDetail] = useState(null);
  const [missing, setMissing] = useState(false);
  const [mine, setMine] = useState([]);
  const [choice, setChoice] = useState('');

  const load = useCallback(() => {
    community.challenge(id).then(setDetail).catch(() => setMissing(true));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const phase = detail?.challenge.phase;

  useEffect(() => {
    if (user && phase === 'submissions') {
      studio.mine('published').then((res) => setMine(res.wallpapers)).catch(() => {});
    }
  }, [user, phase]);

  if (missing) return <Page title="Challenge"><Empty icon={Trophy} title="Challenge not found" /></Page>;
  if (!detail) return <Page title="Challenge"><Loading /></Page>;

  const { challenge, submissions, myVoteSubmissionId } = detail;
  const entered = new Set(submissions.map((row) => String(row.wallpaper._id)));
  const available = mine.filter((wp) => !entered.has(String(wp._id)));
  const winners = submissions.filter((row) => row.isWinner);

  const submit = async (event) => {
    event.preventDefault();
    try {
      const res = await community.submit(id, choice);
      showToast(res.message, 'success');
      setChoice('');
      load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const vote = async (submissionId) => {
    if (!user) {
      openAuth('login');
      return;
    }
    if (!window.confirm('You get one vote in this challenge, and can\'t change it. Vote for this wallpaper?')) return;
    try {
      const res = await community.vote(id, submissionId);
      showToast(res.message, 'success');
      load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <Page title={challenge.title} description={challenge.description} actions={<span className={`badge fw-phase-${phase}`}>{PHASE_LABELS[phase]}</span>}>
      <p className="fw-field-hint fw-spaced">
        Entries: {dateTime(challenge.submissionsStartAt)} to {dateTime(challenge.submissionsEndAt)}. Voting ends: {dateTime(challenge.votingEndAt)}.
      </p>

      {phase === 'submissions' && (
        <Panel title="Enter This Challenge">
          {!user ? (
            <button type="button" className="btn btn-outline" onClick={() => openAuth('login')}>Sign in to enter</button>
          ) : available.length === 0 ? (
            <p className="fw-field-hint">{mine.length ? 'All your published wallpapers are already entered.' : 'Publish a wallpaper first, then enter it here.'}</p>
          ) : (
            <form onSubmit={submit} className="fw-inline-form">
              <select className="select-dropdown" aria-label="Your wallpaper" value={choice} onChange={(e) => setChoice(e.target.value)} required>
                <option value="" disabled>Choose a wallpaper</option>
                {available.map((wp) => <option key={wp._id} value={wp._id}>{wp.title}</option>)}
              </select>
              <button type="submit" className="btn btn-primary">Enter</button>
            </form>
          )}
        </Panel>
      )}

      {phase === 'ended' && (
        <Panel title="Winners">
          {winners.length === 0 ? <p className="fw-field-hint">No votes were cast, so there's no winner.</p> : (
            <p><Trophy size={16} aria-hidden="true" /> {winners.map((row) => `"${row.wallpaper.title}" by ${row.wallpaper.uploadedBy}`).join(', ')}</p>
          )}
        </Panel>
      )}

      {submissions.length === 0 ? (
        <Empty icon={Vote} title="No entries yet">Be the first to enter.</Empty>
      ) : (
        <div className="wallpaper-grid">
          {submissions.map((row) => (
            <div key={row.id} className={`fw-entry ${row.isWinner ? 'fw-entry-winner' : ''}`}>
              <Link to={`/wallpaper/${row.wallpaper._id}`}>
                <img src={mediaUrl(row.wallpaper.imageUrl)} alt={row.wallpaper.altText || row.wallpaper.title} loading="lazy" />
              </Link>
              <div className="fw-entry-body">
                <div>
                  <strong>{row.wallpaper.title}</strong>
                  <span className="fw-field-hint">by {row.wallpaper.uploadedBy}</span>
                </div>
                {phase === 'ended' && <span className="badge">{row.votes} {row.votes === 1 ? 'vote' : 'votes'}</span>}
                {phase === 'voting' && !myVoteSubmissionId && !row.isMine && (
                  <button type="button" className="btn btn-outline" onClick={() => vote(row.id)}>Vote</button>
                )}
                {myVoteSubmissionId === row.id && <span className="badge">Your vote</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
};
