import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

const entries = [
  {
    category: 'INCIDENT / SUP-0014',
    date: '2026.11.13',
    title: 'Nginx restart and R2 DNS failure',
    titleKo: 'Nginx 재시작과 R2 DNS 확인 실패',
    to: '/records/incidents/014-nginx-restart-dns-failure-after-glibc-update-2026-11-13',
    type: 'incident',
  },
  {
    category: 'RUNBOOK / UPGRADE',
    date: 'OPERATING PROCEDURE',
    title: 'Mastodon upgrade procedure',
    titleKo: 'Mastodon 업그레이드 운영 절차',
    to: '/records/runbooks/upgrade',
    type: 'runbook',
  },
  {
    category: 'UPDATE LOG / 4.7.5',
    date: '2026.11.13–15',
    title: 'Mastodon 4.7.5 security upgrade',
    titleKo: 'Mastodon 4.7.5 보안 업데이트',
    to: '/records/update-log/4-7-5-security-upgrade-2026-11-13',
    type: 'update',
  },
  {
    category: 'OPERATIONS / REFLECTION',
    date: '2026.10.30',
    title: 'Fairness and the limits of moderation',
    titleKo: '중재의 공정성과 한계',
    to: '/records/operations/moderation-fairness-and-limits-2026-10-30',
    type: 'operations',
  },
];

export default function Home() {
  const {i18n} = useDocusaurusContext();
  const ko = i18n.currentLocale === 'ko';

  return (
    <Layout
      title={ko ? '운영 기록' : 'Operations journal'}
      description={ko ? '실제 Mastodon 서버 운영에서 얻은 경험과 판단의 기록' : 'A field journal of production Mastodon operations'}
    >
      <main className="lab-home">
        <header className="lab-home__intro">
          <p className="lab-eyebrow">FIELD NOTES / SINCE 2022</p>
          <h1>{ko ? '운영의 기록, 문제 해결의 과정.' : 'The work behind a running service.'}</h1>
          <p className="lab-home__lead">
            {ko
              ? '실제 Mastodon 서버에서 발생한 장애와 유지보수, 반복 가능한 운영 절차, 그리고 운영자의 판단을 기록합니다.'
              : 'Incidents, maintenance, reusable procedures, and decisions from operating a real Mastodon instance.'}
          </p>
          <p className="lab-home__note">
            {ko
              ? '한국어 화면은 실험 중이며, 원본 기술 문서는 아직 대부분 영어로 제공됩니다.'
              : 'This is an experimental reading interface. The original Markdown remains the source of truth.'}
          </p>
        </header>

        <section aria-labelledby="lab-recent" className="lab-home__records">
          <div className="lab-section-heading">
            <h2 id="lab-recent">{ko ? '대표 기록' : 'Selected records'}</h2>
            <span>01 — 04</span>
          </div>
          <div className="lab-entry-list">
            {entries.map((entry) => (
              <article key={entry.to} className={'lab-entry lab-entry--' + entry.type}>
                <div className="lab-entry__meta">
                  <span>{entry.category}</span>
                  <span>{entry.date}</span>
                </div>
                <h3><Link to={entry.to}>{ko ? entry.titleKo : entry.title}</Link></h3>
                <span aria-hidden="true" className="lab-entry__arrow">↗</span>
              </article>
            ))}
          </div>
        </section>

        <p className="lab-home__outro">
          {ko
            ? '같은 저장소 안에서도 장애 기록은 타임라인, Runbook은 작업 체크리스트로 읽을 수 있도록 실험하고 있습니다.'
            : 'One archive, several reading modes: timelines for incidents, checklists for procedures, and quieter layouts for records.'}
        </p>
      </main>
    </Layout>
  );
}
